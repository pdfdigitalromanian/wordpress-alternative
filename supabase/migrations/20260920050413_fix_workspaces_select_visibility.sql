-- Root cause of "new row violates row-level security policy for table
-- workspaces" on a perfectly valid insert (diagnosed via debug_whoami /
-- debug_policies below): Postgres fires AFTER ROW triggers at the end of
-- the statement, which is AFTER the RETURNING projection is computed. The
-- previous workspaces_select policy (`is_workspace_member(id)`) depends
-- entirely on the owner membership row that the workspaces_create_owner_
-- membership trigger inserts — so on `INSERT ... RETURNING *`, the SELECT
-- policy was evaluated before that membership row existed, and Postgres
-- treats "can't see the row you just inserted" as the same RLS violation
-- as a failed WITH CHECK.
--
-- Fix: the creator can always see a workspace they created, independent
-- of the membership row's visibility timing. This doesn't weaken
-- authorization (created_by = auth.uid() is exactly the owner) and
-- removes the race entirely rather than special-casing insert/select
-- ordering.
alter policy workspaces_select on workspaces
  using (created_by = auth.uid() or is_workspace_member(id));

-- Remove the debug helpers added while diagnosing this — not needed
-- going forward and shouldn't ship as callable RPCs.
drop function if exists debug_whoami();
drop function if exists debug_policies(text);
