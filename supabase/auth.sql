-- Self-service account deletion. SECURITY DEFINER because auth.users is not
-- writable by the "authenticated" role; the function can only ever delete
-- the caller (auth.uid()), and EXECUTE is revoked from everyone else.
create or replace function public.delete_user()
returns void
language sql
security definer
set search_path = ''
as $$
  delete from auth.users where id = auth.uid();
$$;

revoke execute on function public.delete_user() from public;
revoke execute on function public.delete_user() from anon;
grant execute on function public.delete_user() to authenticated;
