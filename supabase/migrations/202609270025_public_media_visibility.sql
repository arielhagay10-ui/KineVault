-- A failed approval must never make a staged demonstration anonymously readable.
-- Public catalog pages receive short-lived signed URLs after canonical publication.
update storage.buckets set public = false where id = 'exercise-public';
create policy published_exercise_media_read on storage.objects
for select to anon, authenticated using (
  bucket_id = 'exercise-public' and exists (
    select 1 from public.exercise_media media
    join public.exercises exercise on exercise.current_content_id = media.content_id
    where exercise.status = 'published' and media.storage_bucket = bucket_id
      and media.storage_path = name
  )
);
