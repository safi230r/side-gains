# Side Gains

Daily at-home calisthenics quests for a crew of friends.

- **Daily quest:** everyone gets the same quest each day (Common → Legendary), one move a day, doable at home. It starts on the **starter** level (light and quick, about 2–5 minutes). When the crew is ready, set `level: "standard"` in `SIDEGAINS_CONFIG` for harder quests. Each quest is open for submissions from 12 PM to 10 PM, local time. To change the hours, edit `openHour` and `closeHour` (24-hour clock) in `SIDEGAINS_CONFIG` at the top of `side-gains.html`.
- **Mystery drop:** the move stays hidden behind a shadowy athlete covered in drifting question marks until opening time. Then it's revealed with a slot-machine roll, with sound, haptics and confetti in the rarity's colours. The silhouette, app icon and other artwork were generated in Figma.
- **Sound effects:** synthesized clicks, chimes and fanfares across the app. Mute them with the speaker button in the header.
- **Notifications:** each person chooses, from the bell button, whether to get a phone notification when the quest drops and when someone submits a video. On iPhone, add the site to your Home Screen first.
- **Video proof:** film your set and upload it. The rest of the crew votes on whether it counts.
- **Scoring:** fastest approved finishers get bonus points (+50% / +25% / +10%), plus a streak bonus.
- **Weekly race:** a leaderboard with a live chart of points from Monday to Sunday.
- **Crew-voted punishments:** everyone pitches a punishment, the crew votes, and last place on the weekly board has to film it.
- **Form library:** animated demos of every move, with form cues and what doesn't count.
- **Life tab:** habit tracker, water glasses, box-breathing timer, posture reset and a tip of the day.

The whole app is one file, [`side-gains.html`](side-gains.html). There's no build step.

## How data is stored

The app has its own database, so it doesn't depend on any one person's device. It uses [Supabase](https://supabase.com)'s free tier:

| What | Where | Who can see it |
| --- | --- | --- |
| Members, submissions, votes, punishments, habits | Postgres table `docs` | Signed-in crew only |
| Videos | Private Storage bucket `videos`, up to 50 MB per file | Signed-in crew only |
| Accounts | Supabase Auth, username and password | Anyone with the link can create an account |
| Notification subscriptions | `docs` rows with `coll = 'push'` | Only that person (and the server) |

Access rules (in [`supabase-schema.sql`](supabase-schema.sql)) make sure each person can only change their own entries and votes. Only admins can set custom quests.

> If the page has no database settings, it shows a read-only preview. When it's opened as a claude.ai artifact, it uses that platform's built-in storage instead.

## Setup (about 10 minutes)

### 1. Create the database
1. Make a free account at [supabase.com](https://supabase.com) and create a new project.
2. Open **SQL Editor → New query**, paste the contents of [`supabase-schema.sql`](supabase-schema.sql), and click **Run**.

### 2. Allow username sign-ups
Go to **Authentication → Sign In / Providers**. Turn **on** "Allow new users to sign up" and turn **off** "Confirm email". People sign up with a username and password. Behind the scenes the username becomes `username@<your-github-domain>`, which never receives email.

> There's no password reset by email. If someone forgets their password, delete them in **Authentication → Users** and let them sign up again, or set a new password there.

### 3. Connect the page
1. Go to **Project Settings → API** and copy the **Project URL** and the **anon public** key.
2. Paste them into `side-gains.html` near the top:
   ```js
   window.SIDEGAINS_CONFIG = {
     supabaseUrl: "https://YOUR-PROJECT.supabase.co",
     supabaseAnonKey: "eyJ...",
   };
   ```
   The anon key is safe to publish. The access rules in the database are what protect the data.

### 4. Put it online with GitHub Pages
1. In this repo, go to **Settings → Pages**, choose **Deploy from a branch**, select `main` and `/ (root)`, then save.
2. Your site will be at `https://<your-username>.github.io/<repo-name>/`.
3. Back in Supabase, open **Authentication → URL Configuration**:
   - Set **Site URL** to that address.
   - Add `https://<your-username>.github.io/<repo-name>/side-gains.html` under **Redirect URLs**.

### 5. Become the admin
1. Open the site and create your account.
2. In the Supabase SQL Editor, run this with your own username and domain:
   ```sql
   insert into public.admins (uid) select id from auth.users where email = 'yourname@<your-username>.github.io';
   ```
3. Reload the page. You'll see **Set a custom quest** on the quest card.

### 6. Notifications (optional)
1. The schema file already creates the key table and the 10-minute schedule.
2. Go to **Edge Functions → Deploy a new function → Via editor**. Name it `notify`, paste [`notify-function.ts`](notify-function.ts), and deploy.
3. In the function's **Settings**, turn **off** "Verify JWT". The function checks logins itself.
4. [`sw.js`](sw.js), [`manifest.webmanifest`](manifest.webmanifest) and the `icon-*.png` files must sit next to `side-gains.html`.

## Free-tier limits to know about
- **Storage:** 1 GB in total. That's roughly 50–100 short phone clips. Delete old videos from **Storage → videos** now and then, or paste YouTube or Drive links for long sets.
- **Inactivity:** free projects pause after about a week with no activity. Daily use keeps it awake. If it does pause, you can restore it from the dashboard.

## Design
`figma-board.html` is the source for the Figma design system: colour tokens, rarity tiers, quest cards, the form library pose sheet and the burpee motion study.
