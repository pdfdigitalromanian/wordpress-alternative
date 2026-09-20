-- M2: pages (draft documents), releases (immutable published snapshots),
-- and the active-release pointer that separates editing from publishing
-- (Part A SS10). Autosaving a draft never touches `releases` or
-- `sites.active_release_id` — only `publish_site()` does, atomically.

create table pages (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references sites (id) on delete cascade,
  slug text not null check (slug = '' or slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  title text not null check (char_length(title) between 1 and 200),
  -- Puck's Data shape: { content: [...], root: { props: {...} } }.
  -- Structural validation beyond "is an object" is deferred to the
  -- application layer (Puck's own config validates on load/save); this
  -- is a deliberate simplification, not an oversight.
  draft_document jsonb not null default '{"content":[],"root":{"props":{}}}'::jsonb,
  draft_updated_at timestamptz not null default now(),
  draft_updated_by uuid references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid not null references auth.users (id),
  unique (site_id, slug)
);

create index pages_site_id_idx on pages (site_id);

create table releases (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references sites (id) on delete cascade,
  label text,
  created_at timestamptz not null default now(),
  created_by uuid not null references auth.users (id)
);

create index releases_site_id_idx on releases (site_id, created_at desc);

-- One row per page as it existed at the moment of publish — the slug,
-- title and document are copied in, not referenced, so a later edit (or
-- even deletion) of the live page can never change what an old release
-- rendered.
create table release_pages (
  id uuid primary key default gen_random_uuid(),
  release_id uuid not null references releases (id) on delete cascade,
  page_id uuid references pages (id) on delete set null,
  slug text not null,
  title text not null,
  document jsonb not null,
  unique (release_id, page_id),
  unique (release_id, slug)
);

create index release_pages_release_id_idx on release_pages (release_id);

alter table sites
  add column active_release_id uuid references releases (id) on delete set null;

create trigger pages_set_updated_at
  before update on pages
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------

alter table pages enable row level security;
alter table releases enable row level security;
alter table release_pages enable row level security;

create policy pages_select on pages
  for select using (
    is_workspace_member((select workspace_id from sites where sites.id = pages.site_id))
  );

create policy pages_insert on pages
  for insert
  with check (
    workspace_role_of((select workspace_id from sites where sites.id = pages.site_id))
      in ('owner', 'administrator', 'editor')
  );

-- Draft autosave and any other page edit go through this policy directly
-- (not the publish RPC below) — editors can update pages, viewers cannot.
create policy pages_update on pages
  for update
  using (
    workspace_role_of((select workspace_id from sites where sites.id = pages.site_id))
      in ('owner', 'administrator', 'editor')
  )
  with check (
    workspace_role_of((select workspace_id from sites where sites.id = pages.site_id))
      in ('owner', 'administrator', 'editor')
  );

create policy pages_delete on pages
  for delete using (
    workspace_role_of((select workspace_id from sites where sites.id = pages.site_id))
      in ('owner', 'administrator', 'editor')
  );

-- releases/release_pages are written exclusively by the SECURITY DEFINER
-- functions below (so publish/rollback are atomic and permission-checked
-- in one place) — these RLS policies only need to cover reads.
create policy releases_select on releases
  for select using (
    is_workspace_member((select workspace_id from sites where sites.id = releases.site_id))
  );

create policy release_pages_select on release_pages
  for select using (
    is_workspace_member((
      select workspace_id from sites
      join releases on releases.site_id = sites.id
      where releases.id = release_pages.release_id
    ))
  );

-- ---------------------------------------------------------------------
-- Publish / rollback: atomic, permission-checked, immutable snapshots.
-- ---------------------------------------------------------------------

create function publish_site(target_site_id uuid, release_label text default null)
returns releases
language plpgsql
security definer
set search_path = public
as $$
declare
  target_workspace_id uuid;
  new_release releases;
begin
  select workspace_id into target_workspace_id from sites where id = target_site_id;
  if target_workspace_id is null then
    raise exception 'Site not found';
  end if;

  if workspace_role_of(target_workspace_id) not in ('owner', 'administrator', 'editor') then
    raise exception 'Insufficient permissions to publish this site';
  end if;

  insert into releases (site_id, label, created_by)
  values (target_site_id, release_label, auth.uid())
  returning * into new_release;

  insert into release_pages (release_id, page_id, slug, title, document)
  select new_release.id, id, slug, title, draft_document
  from pages
  where site_id = target_site_id;

  update sites set active_release_id = new_release.id where id = target_site_id;

  return new_release;
end;
$$;

grant execute on function publish_site(uuid, text) to authenticated;

create function rollback_site(target_site_id uuid, target_release_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target_workspace_id uuid;
  release_belongs_to_site boolean;
begin
  select workspace_id into target_workspace_id from sites where id = target_site_id;
  if target_workspace_id is null then
    raise exception 'Site not found';
  end if;

  if workspace_role_of(target_workspace_id) not in ('owner', 'administrator', 'editor') then
    raise exception 'Insufficient permissions to roll back this site';
  end if;

  select exists (
    select 1 from releases where id = target_release_id and site_id = target_site_id
  ) into release_belongs_to_site;

  if not release_belongs_to_site then
    raise exception 'That release does not belong to this site';
  end if;

  -- This changes which release is live. It does not touch inventory,
  -- orders, payments, or any Medusa-owned state, and it does not create
  -- a new release — it points the site back at an existing immutable one.
  update sites set active_release_id = target_release_id where id = target_site_id;
end;
$$;

grant execute on function rollback_site(uuid, uuid) to authenticated;
