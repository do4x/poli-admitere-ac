-- Supabase Storage setup for the private "solutions" bucket.
-- Applied via the Supabase SQL editor / MCP (storage.* is not managed by
-- Prisma migrations). Object paths are {userId}/{problemId}/{timestamp}.pdf;
-- RLS ties every operation to the folder prefix = auth.uid().

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('solutions', 'solutions', false, 10485760, array['application/pdf'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "solutions_insert_own" on storage.objects;
create policy "solutions_insert_own" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'solutions'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );

drop policy if exists "solutions_select_own" on storage.objects;
create policy "solutions_select_own" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'solutions'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );

drop policy if exists "solutions_delete_own" on storage.objects;
create policy "solutions_delete_own" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'solutions'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );
