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

-- 7. Foil Season (same as supabase-update-2.sql)
-- Side Gains "Foil Season" update. Paste into Supabase → SQL Editor → New query and run it once.
-- Safe to run again. Two random drops a day start the day after the first run.

-- A. Who can write what: adds reactions, comments, duels and winner's powers.
create or replace function public.sg_can_write(c text, i text)
returns boolean language sql stable security definer set search_path = public as $$
  select
    (c in ('members','subs','votes','pens','ideas','ivotes','habits','push','reacts','comments','duels','powers') and i = auth.uid()::text)
    or exists (select 1 from public.admins a where a.uid = auth.uid());
$$;

-- B. Who can read what: a drop stays invisible to everyone, including admins, until its moment comes.
drop policy if exists "crew reads docs" on public.docs;
create policy "crew reads docs" on public.docs
  for select to authenticated using (
    case
      when coll = 'push' then id = auth.uid()::text
      when coll = 'drops' then coalesce((data->>'at')::bigint, 0) <= (extract(epoch from now()) * 1000)::bigint
      else true
    end
  );

-- C. Settings marker the site looks for. "since" is the first day with two quests.
insert into public.docs (coll, id, data)
values ('meta', 'engine', jsonb_build_object('v', 2, 'drops', true, 'tz', 'Europe/London',
        'since', to_char((now() at time zone 'Europe/London')::date + 1, 'YYYY-MM-DD')))
on conflict (coll, id) do nothing;

-- D. Planning: two random minutes between 8:00 and 20:30, at least 2.5 hours apart. Both close at 22:00.
create or replace function public.sg_ms(d date, m int)
returns bigint language sql stable set search_path = public as $$
  select (extract(epoch from ((d + make_interval(mins => m)) at time zone 'Europe/London')) * 1000)::bigint;
$$;

create or replace function public.sg_plan(d date)
returns void language plpgsql security definer set search_path = public as $$
declare
  first_min constant int := 480;  -- 8:00
  last_min  constant int := 1230; -- 20:30
  gap_min   constant int := 150;
  close_min constant int := 1320; -- 22:00
  span int := last_min - first_min - gap_min;
  u float8 := random() * span;
  v float8 := random() * span;
  k text := to_char(d, 'YYYY-MM-DD');
begin
  if exists (select 1 from docs where coll = 'drops' and id = k || 'a') then return; end if;
  insert into docs (coll, id, data) values
    ('drops', k || 'a', jsonb_build_object('at', sg_ms(d, floor(first_min + least(u, v))::int), 'close', sg_ms(d, close_min), 'seed', gen_random_uuid()::text)),
    ('drops', k || 'b', jsonb_build_object('at', sg_ms(d, floor(first_min + greatest(u, v) + gap_min)::int), 'close', sg_ms(d, close_min), 'seed', gen_random_uuid()::text))
  on conflict (coll, id) do nothing;
end $$;

-- E. One-time keys, so no notification is ever sent twice.
create table if not exists public.sg_sent (key text primary key, at timestamptz not null default now());
alter table public.sg_sent enable row level security;

-- F. Uploaded videos older than two days. The notify service deletes them.
create or replace function public.sg_old_videos()
returns setof text language sql stable security definer set search_path = public as $$
  select name from storage.objects where bucket_id = 'videos' and created_at < now() - interval '48 hours' order by created_at limit 400;
$$;

-- G. The heartbeat: plans days, releases drops, and triggers reminders and clean-up.
create extension if not exists pg_net;
create extension if not exists pg_cron;

create or replace function public.sg_call(action text, id text)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform net.http_post(
    url := 'https://crljnytspdeltxvlohto.supabase.co/functions/v1/notify',
    headers := '{"Content-Type":"application/json"}'::jsonb,
    body := jsonb_build_object('action', action, 'id', id));
end $$;

create or replace function public.sg_tick()
returns void language plpgsql security definer set search_path = public as $$
declare
  loc timestamp := now() at time zone 'Europe/London';
  today date := loc::date;
  m int := extract(hour from loc)::int * 60 + extract(minute from loc)::int;
  dow int := extract(isodow from loc)::int;
  since date;
  r record;
begin
  select (data->>'since')::date into since from docs where coll = 'meta' and id = 'engine';
  if since is null then return; end if;
  if today >= since then perform sg_plan(today); end if;
  if today + 1 >= since then perform sg_plan(today + 1); end if;
  for r in
    update docs set data = data || '{"live": true}'::jsonb, updated_at = now()
    where coll = 'drops' and not (data ? 'live') and (data->>'at')::bigint <= (extract(epoch from now()) * 1000)::bigint
    returning id
  loop
    perform sg_call('drop', r.id);
  end loop;
  if m between 1260 and 1263 then perform sg_call('closing', to_char(today, 'YYYY-MM-DD')); end if;
  if dow in (6, 7) and m between 1080 and 1083 then perform sg_call('punish', to_char(today, 'YYYY-MM-DD')); end if;
  if dow = 7 and m between 1320 and 1323 then perform sg_call('ceremony', to_char(today, 'YYYY-MM-DD')); end if;
  if m % 60 = 17 then perform sg_call('cleanup', ''); end if;
end $$;

-- Only the schedule and the server may run these.
revoke all on function public.sg_plan(date) from public, anon, authenticated;
revoke all on function public.sg_call(text, text) from public, anon, authenticated;
revoke all on function public.sg_tick() from public, anon, authenticated;
revoke all on function public.sg_old_videos() from public, anon, authenticated;
grant execute on function public.sg_old_videos() to service_role;

-- H. Schedules: every minute, plus a nightly tidy-up of logs.
select cron.unschedule(jobname) from cron.job where jobname in ('side-gains-quest-drop', 'side-gains-tick', 'side-gains-tidy');
select cron.schedule('side-gains-tick', '* * * * *', 'select public.sg_tick()');
select cron.schedule('side-gains-tidy', '23 4 * * *', $cron$
  delete from cron.job_run_details where end_time < now() - interval '2 days';
  delete from public.sg_sent where at < now() - interval '21 days';
$cron$);
