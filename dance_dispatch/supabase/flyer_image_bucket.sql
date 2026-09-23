-- Create the public bucket used by the submit-event flyer uploader.
insert into storage.buckets (id, name, public)
values ('FLYER_IMAGE_BUCKET', 'FLYER_IMAGE_BUCKET', true)
on conflict (id) do nothing;

create policy "Authenticated users can upload flyers to their folder"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'FLYER_IMAGE_BUCKET'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);

create policy "Authenticated users can manage their flyer uploads"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'FLYER_IMAGE_BUCKET'
  and owner_id = (select auth.uid()::text)
)
with check (
  bucket_id = 'FLYER_IMAGE_BUCKET'
  and owner_id = (select auth.uid()::text)
);

create policy "Authenticated users can delete their flyer uploads"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'FLYER_IMAGE_BUCKET'
  and owner_id = (select auth.uid()::text)
);
