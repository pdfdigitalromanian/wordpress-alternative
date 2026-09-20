-- Temporary debug helper for M1 RLS troubleshooting. Removed in a
-- follow-up migration once the workspace-insert issue is diagnosed.
create function debug_whoami()
returns jsonb
language sql
stable
as $$
  select jsonb_build_object(
    'uid', auth.uid(),
    'role', auth.role(),
    'jwt', auth.jwt()
  );
$$;

grant execute on function debug_whoami() to authenticated, anon;
