-- Bug found by supabase/tests/publish-rollback.mjs: a user with NO
-- membership in a site's workspace could still call publish_site() and
-- rollback_site(). Cause: `workspace_role_of()` returns NULL for a
-- non-member, and in PL/pgSQL `IF NULL THEN ... END IF` evaluates NULL as
-- false — the `raise exception` branch was silently skipped, not merely
-- "denied", so execution fell through to the privileged operation. RLS
-- policies elsewhere are unaffected (Postgres treats NULL in a USING/
-- WITH CHECK expression as "row denied", the opposite behavior) — this
-- was specific to explicit `IF ... THEN raise` role checks in PL/pgSQL.
create or replace function publish_site(target_site_id uuid, release_label text default null)
returns releases
language plpgsql
security definer
set search_path = public
as $$
declare
  target_workspace_id uuid;
  caller_role workspace_role;
  new_release releases;
begin
  select workspace_id into target_workspace_id from sites where id = target_site_id;
  if target_workspace_id is null then
    raise exception 'Site not found';
  end if;

  caller_role := workspace_role_of(target_workspace_id);
  if caller_role is null or caller_role not in ('owner', 'administrator', 'editor') then
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

create or replace function rollback_site(target_site_id uuid, target_release_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target_workspace_id uuid;
  caller_role workspace_role;
  release_belongs_to_site boolean;
begin
  select workspace_id into target_workspace_id from sites where id = target_site_id;
  if target_workspace_id is null then
    raise exception 'Site not found';
  end if;

  caller_role := workspace_role_of(target_workspace_id);
  if caller_role is null or caller_role not in ('owner', 'administrator', 'editor') then
    raise exception 'Insufficient permissions to roll back this site';
  end if;

  select exists (
    select 1 from releases where id = target_release_id and site_id = target_site_id
  ) into release_belongs_to_site;

  if not release_belongs_to_site then
    raise exception 'That release does not belong to this site';
  end if;

  update sites set active_release_id = target_release_id where id = target_site_id;
end;
$$;
