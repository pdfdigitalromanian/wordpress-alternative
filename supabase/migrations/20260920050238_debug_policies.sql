create function debug_policies(target_table text)
returns setof pg_policies
language sql
security definer
set search_path = public
stable
as $$
  select * from pg_policies where tablename = target_table;
$$;

grant execute on function debug_policies(text) to authenticated, anon;
