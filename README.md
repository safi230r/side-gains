# Side Gains

Two mystery workout packs a day for a crew of friends. Rip them, film them, beat each other.

**Try it without an account:** open `side-gains.html?demo`. It uses a made-up crew and sends nothing anywhere. Add `&now=2026-11-26T18:40:00Z` to pretend it's another moment, or `&few` for a crew of two.

## What's in it

- **Two drops a day** at random times between 8 AM and 8:30 PM, at least 2½ hours apart. Both close at 10 PM. The database picks the times, and nobody can read them early, not even the admin.
- **Foil packs:** swipe to tear one open, watch the slot machine, flip the card. Cards are Common, Rare, Epic or Legendary, with a live 3D athlete doing the move.
- **Videos count straight away.** If anyone says "doesn't count" within 24 hours, with a reason, it's out. You can film it again until the quest closes.
- **Easy, Normal and Hard** versions of every quest, with points to match.
- **Stickers and comments** on videos.
- **Duels:** race to the next drop, battle for points until Sunday, or max reps in 60 seconds. The winner takes 25, 50 or 100 of the loser's points.
- **Crew shaker:** a weekly rep goal everyone fills together. **Squads** are shuffled every Monday once four people have joined.
- **Sunday ceremony** at 10 PM: podium, awards, red card, and a recap image to share.
- **Winner's power:** last week's winner picks one future move in secret, or vetoes one live quest.
- **Monthly seasons** with six ranks and a hall of fame.
- **Profiles:** player card, pins, personal bests, card binder, muscle map, streak and freezes.
- **Streak freeze:** every 7 days earns one, two at most. It covers a missed day by itself.
- **Punishments:** pitch and vote; last place films it by the end of the next week or loses 100 points.
- **Form library** with 3D demos, habits, water, box breathing.

## Files

| File | What it is |
| --- | --- |
| `side-gains.html` | The page and its settings |
| `app.js` | Pages, storage, notifications |
| `engine.js` | All the rules and scoring. No page code, so it can be tested |
| `fx.js`, `show.js` | Visuals: lighting, 3D athletes, foil, pack rip, ceremony |
| `video.js` | Shrinks and splits big videos |
| `catalog.js` | Exercise poses, form cues, tips |
| `app.css`, `img/` | Styling and the Figma artwork |
| `supabase-schema.sql` | Database setup for a new project |
| `supabase-update-2.sql` | Only the changes, for a project that already ran the old schema |
| `notify-function.ts` | The notification service. Generated: run `node tools/build-notify.mjs` after changing `engine.js` or `tools/notify-handler.ts` |

There's no build step for the site itself.

## Videos

- Up to **200 MB** each. Supabase's free plan refuses single files over 50 MB, so anything over 16 MB is first shrunk to 720p on the phone. If a device can't do that, the file is uploaded in parts and joined again when someone watches it.
- **Deleted after two days** by an hourly clean-up. Results, points and cards stay.

## Settings

In `side-gains.html`:

- `level`: `"starter"` or `"standard"`.
- `tz`: the crew's time zone. Drops hit everyone at the same moment.
- `rejects`: how many "doesn't count" votes throw a video out. Default 1.

To change the drop hours, edit `sg_plan` in the SQL and `CFG` in `engine.js` so they match.

## Setup

### 1. Database
Make a free project at [supabase.com](https://supabase.com), open **SQL Editor → New query**, paste `supabase-schema.sql` and run it. For a project that already runs the old version, run `supabase-update-2.sql` instead. The two-drop system starts the day after.

### 2. Sign-ups
**Authentication → Sign In / Providers**: turn on "Allow new users to sign up" and turn off "Confirm email". People sign up with a username and password. There's no password reset by email; set a new one in **Authentication → Users**.

### 3. Notification service
**Edge Functions → Deploy a new function → Via editor**. Name it `notify`, paste `notify-function.ts`, deploy, then turn off "Verify JWT" in its settings. It sends the alerts and deletes old videos.

### 4. Connect and publish
Put your Project URL and anon key in `side-gains.html` (the anon key is safe to publish). In the SQL, change the project address in `sg_call`. Then publish the folder with GitHub Pages and add the address under **Authentication → URL Configuration**.

### 5. Admin
After creating your account, run this with your username and domain:
```sql
insert into public.admins (uid) select id from auth.users where email = 'yourname@<your-username>.github.io';
```
Reload and **Set a custom quest** appears on open quests.

## Free-tier limits

- **Storage:** 1 GB. With two-day deletion that's plenty for a small crew.
- **Downloads:** 5 GB a month. Shrinking videos is what keeps this workable.
- **Inactivity:** free projects pause after about a week without use.

## Design

The Figma file "Side Gains — Design System" has a "v2 · Foil Season" page with the colours, type, card components, key screens and artwork.
