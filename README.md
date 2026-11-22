# Side Gains

Daily at-home calisthenics quests for a crew of friends.

- **Daily quest:** everyone gets the same quest each day (Common → Legendary), always under 100 reps and doable at home. Each quest opens at 12 AM and closes at 10 PM, local time.
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
| Accounts | Supabase Auth, email login link, invite-only | You decide who's in |

Access rules (in [`supabase-schema.sql`](supabase-schema.sql)) make sure each person can only change their own entries and votes. Only admins can set custom quests.

> If the page has no database settings, it shows a read-only preview. When it's opened as a claude.ai artifact, it uses that platform's built-in storage instead.

## Setup (about 10 minutes)

### 1. Create the database
1. Make a free account at [supabase.com](https://supabase.com) and create a new project.
2. Open **SQL Editor → New query**, paste the contents of [`supabase-schema.sql`](supabase-schema.sql), and click **Run**.

### 2. Make it invite-only
1. Go to **Authentication → Sign In / Providers** and turn off **Allow new users to sign up**. Keep **Email** enabled.
2. Go to **Authentication → Users → Add user → Send invitation** and invite yourself and each friend by email.

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
1. Open the site, sign in with your email link, and join the crew.
2. In the Supabase SQL Editor, run:
   ```sql
   insert into public.admins (uid) select id from auth.users where email = 'you@example.com';
   ```
3. Reload the page. You'll see **Set a custom quest** on the quest card.

## Free-tier limits to know about
- **Storage:** 1 GB in total. That's roughly 50–100 short phone clips. Delete old videos from **Storage → videos** now and then, or paste YouTube or Drive links for long sets.
- **Inactivity:** free projects pause after about a week with no activity. Daily use keeps it awake. If it does pause, you can restore it from the dashboard.

## Design
`figma-board.html` is the source for the Figma design system: colour tokens, rarity tiers, quest cards, the form library pose sheet and the burpee motion study.
