-- Side Gains: database, storage and access rules for the standalone version.
-- Paste this whole file into Supabase → SQL Editor → New query, and run it once.

-- 1. One table holds every document the app stores (members, submissions, votes, habits, ...).
create table if not exists public.docs (
  coll       text        not null,
  id         text        not null,
  data       jsonb       not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (coll, id)
);

-- 2. Crew admins: can set custom quests and fix anyone's entries.
create table if not exists public.admins (
  uid uuid primary key references auth.users (id) on delete cascade
);

alter table public.docs   enable row level security;
alter table public.admins enable row level security;

-- Signed-in crew members can read everything.
drop policy if exists "crew reads docs" on public.docs;
create policy "crew reads docs" on public.docs
  for select to authenticated using (true);

drop policy if exists "crew reads admins" on public.admins;
create policy "crew reads admins" on public.admins
  for select to authenticated using (true);

-- Everyone writes only their own documents (the doc id is their user id).
-- Custom quests are admin-only. Admins can write anything, for moderation.
create or replace function public.sg_can_write(c text, i text)
returns boolean language sql stable security definer set search_path = public as $$
  select
    (c in ('members','subs','votes','pens','ideas','ivotes','habits') and i = auth.uid()::text)
    or exists (select 1 from public.admins a where a.uid = auth.uid());
$$;

drop policy if exists "own docs insert" on public.docs;
create policy "own docs insert" on public.docs
  for insert to authenticated with check (public.sg_can_write(coll, id));

drop policy if exists "own docs update" on public.docs;
create policy "own docs update" on public.docs
  for update to authenticated using (public.sg_can_write(coll, id)) with check (public.sg_can_write(coll, id));

drop policy if exists "own docs delete" on public.docs;
create policy "own docs delete" on public.docs
  for delete to authenticated using (public.sg_can_write(coll, id));

-- 3. Live updates: everyone sees new submissions and votes without reloading.
do $$ begin
  alter publication supabase_realtime add table public.docs;
exception when duplicate_object then null; end $$;

-- 4. Private video storage (50 MB per file). Only signed-in crew can watch.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('videos', 'videos', false, 52428800, array['video/mp4','video/webm','video/quicktime'])
on conflict (id) do update set file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "crew watches videos" on storage.objects;
create policy "crew watches videos" on storage.objects
  for select to authenticated using (bucket_id = 'videos');

drop policy if exists "crew uploads own videos" on storage.objects;
create policy "crew uploads own videos" on storage.objects
  for insert to authenticated with check (bucket_id = 'videos' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "crew deletes own videos" on storage.objects;
create policy "crew deletes own videos" on storage.objects
  for delete to authenticated using (bucket_id = 'videos' and (storage.foldername(name))[1] = auth.uid()::text);

-- 5. After you've signed in once, make yourself the admin (swap in your email):
-- insert into public.admins (uid) select id from auth.users where email = 'you@example.com';

-- 6. Push notifications (added later). Safe to re-run.
-- Private table for the push signing keys; no policies, so only the server (service role) can read it.
create table if not exists public.push_keys (
  id          int  primary key,
  public_key  text not null,
  private_key text not null
);
alter table public.push_keys enable row level security;

-- Push subscriptions live in docs (coll = 'push'); each person can only read and write their own.
drop policy if exists "crew reads docs" on public.docs;
create policy "crew reads docs" on public.docs
  for select to authenticated using (coll <> 'push' or id = auth.uid()::text);

create or replace function public.sg_can_write(c text, i text)
returns boolean language sql stable security definer set search_path = public as $$
  select
    (c in ('members','subs','votes','pens','ideas','ivotes','habits','push') and i = auth.uid()::text)
    or exists (select 1 from public.admins a where a.uid = auth.uid());
$$;

-- Every 10 minutes, ask the notify function to send "quest dropped" to anyone whose local open hour has arrived.
create extension if not exists pg_net;
create extension if not exists pg_cron;
select cron.unschedule('side-gains-quest-drop') where exists (select 1 from cron.job where jobname = 'side-gains-quest-drop');
select cron.schedule('side-gains-quest-drop', '*/10 * * * *', $cron$
  select net.http_post(
    url := 'https://crljnytspdeltxvlohto.supabase.co/functions/v1/notify?action=tick',
    headers := '{"Content-Type":"application/json"}'::jsonb,
    body := '{}'::jsonb
  );
$cron$);
