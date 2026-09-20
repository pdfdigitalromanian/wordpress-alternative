-- M1: workspace/site ownership model.
--
-- Ownership chain: workspaces -> workspace_memberships (role) -> sites.
-- A site belongs to exactly one workspace. Access to a workspace's sites
-- is gated entirely through workspace_memberships, checked by RLS on
-- every table, not by application-level convention.
--
-- Role check helpers are SECURITY DEFINER so RLS policies can query
-- workspace_memberships without recursively re-triggering RLS on that
-- same table (the classic self-referential RLS trap). They run as the
-- migration owner, which has BYPASSRLS on this project, and each pins
-- search_path explicitly to avoid search-path hijacking.

create type workspace_role as enum ('owner', 'administrator', 'editor', 'viewer');

create table workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 200),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  created_by uuid not null references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table workspace_memberships (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role workspace_role not null,
  created_at timestamptz not null default now(),
  unique (workspace_id, user_id)
);

create table sites (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 200),
  slug text not null check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, slug)
);

create index workspace_memberships_user_id_idx on workspace_memberships (user_id);
create index sites_workspace_id_idx on sites (workspace_id);

-- Registered hostnames a public request may resolve through. Public
-- rendering must reject any Host header without a matching row here —
-- never construct a canonical URL or resolve a site from an unverified
-- header (Part A SS13).
create table site_domains (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references sites (id) on delete cascade,
  hostname text not null unique check (hostname = lower(hostname)),
  is_primary boolean not null default false,
  verified_at timestamptz,
  created_at timestamptz not null default now()
);

create index site_domains_site_id_idx on site_domains (site_id);

-- ---------------------------------------------------------------------
-- updated_at maintenance
-- ---------------------------------------------------------------------

create function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger workspaces_set_updated_at
  before update on workspaces
  for each row execute function set_updated_at();

create trigger sites_set_updated_at
  before update on sites
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------
-- Role-check helpers used by RLS policies
-- ---------------------------------------------------------------------

create function is_workspace_member(target_workspace_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from workspace_memberships
    where workspace_id = target_workspace_id
      and user_id = auth.uid()
  );
$$;

create function workspace_role_of(target_workspace_id uuid)
returns workspace_role
language sql
security definer
set search_path = public
stable
as $$
  select role from workspace_memberships
  where workspace_id = target_workspace_id
    and user_id = auth.uid()
  limit 1;
$$;

-- A new workspace's creator becomes its owner automatically and
-- atomically — the application never inserts this row itself, so there
-- is no window where a workspace exists with no owner membership.
create function create_owner_membership()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into workspace_memberships (workspace_id, user_id, role)
  values (new.id, new.created_by, 'owner');
  return new;
end;
$$;

create trigger workspaces_create_owner_membership
  after insert on workspaces
  for each row execute function create_owner_membership();

-- ---------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------

alter table workspaces enable row level security;
alter table workspace_memberships enable row level security;
alter table sites enable row level security;
alter table site_domains enable row level security;

create policy workspaces_select on workspaces
  for select using (is_workspace_member(id));

create policy workspaces_insert on workspaces
  for insert with check (created_by = auth.uid());

create policy workspaces_update on workspaces
  for update
  using (workspace_role_of(id) in ('owner', 'administrator'))
  with check (workspace_role_of(id) in ('owner', 'administrator'));

create policy workspaces_delete on workspaces
  for delete using (workspace_role_of(id) = 'owner');

create policy memberships_select on workspace_memberships
  for select using (is_workspace_member(workspace_id));

create policy memberships_insert on workspace_memberships
  for insert
  with check (workspace_role_of(workspace_id) in ('owner', 'administrator'));

create policy memberships_update on workspace_memberships
  for update
  using (workspace_role_of(workspace_id) in ('owner', 'administrator'))
  with check (workspace_role_of(workspace_id) in ('owner', 'administrator'));

-- Owners can't be demoted/removed by this policy (role <> 'owner' guard);
-- ownership transfer is a deliberate future operation, not an accidental
-- side effect of an administrator editing membership rows.
create policy memberships_delete on workspace_memberships
  for delete using (
    workspace_role_of(workspace_id) in ('owner', 'administrator')
    and role <> 'owner'
  );

create policy sites_select on sites
  for select using (is_workspace_member(workspace_id));

create policy sites_insert on sites
  for insert
  with check (workspace_role_of(workspace_id) in ('owner', 'administrator'));

create policy sites_update on sites
  for update
  using (workspace_role_of(workspace_id) in ('owner', 'administrator', 'editor'))
  with check (workspace_role_of(workspace_id) in ('owner', 'administrator', 'editor'));

create policy sites_delete on sites
  for delete using (workspace_role_of(workspace_id) in ('owner', 'administrator'));

-- Domain management is an owner/administrator operation; anyone with
-- workspace access can read the mapping (needed to show it in the admin).
create policy site_domains_select on site_domains
  for select using (
    is_workspace_member((select workspace_id from sites where sites.id = site_domains.site_id))
  );

create policy site_domains_insert on site_domains
  for insert
  with check (
    workspace_role_of((select workspace_id from sites where sites.id = site_domains.site_id))
      in ('owner', 'administrator')
  );

create policy site_domains_update on site_domains
  for update
  using (
    workspace_role_of((select workspace_id from sites where sites.id = site_domains.site_id))
      in ('owner', 'administrator')
  )
  with check (
    workspace_role_of((select workspace_id from sites where sites.id = site_domains.site_id))
      in ('owner', 'administrator')
  );

create policy site_domains_delete on site_domains
  for delete using (
    workspace_role_of((select workspace_id from sites where sites.id = site_domains.site_id))
      in ('owner', 'administrator')
  );

-- The public renderer resolves a Host header to a site through this
-- table using the server-side secret key (RLS-exempt), never through a
-- client-supplied site ID. This view exists so that path can select the
-- minimum needed columns without depending on RLS internals.
create view public_site_by_hostname as
  select site_domains.hostname, sites.id as site_id, sites.workspace_id
  from site_domains
  join sites on sites.id = site_domains.site_id
  where site_domains.verified_at is not null;
