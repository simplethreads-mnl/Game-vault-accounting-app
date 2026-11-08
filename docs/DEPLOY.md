# Putting Game Vault online (free)

When you're done, Game Vault will have its own web address, something like
`https://game-vault-yourname.vercel.app`. You can open it on your phone, iPad and laptop, and
every device shows the same books. It takes about 15 minutes, and you don't need any coding
tools.

**What it costs: $0.**

- **Vercel** (hosting): the free Hobby plan.
- **Neon** (database): the free plan with 0.5 GB of storage. That's years of transactions for a small shop.

> **Heads-up on Vercel's terms:** the free Hobby plan is meant for *personal, non-commercial*
> use, and bookkeeping for your business is arguably commercial. Many people run small internal
> tools on it anyway. If you'd rather be strictly within the rules, Netlify's free plan allows
> commercial use. Ask Claude for Netlify steps instead; the app works there too.

---

## Step 1: Create a Vercel account (2 min)

1. Go to **vercel.com** and choose **Sign Up**.
2. Pick **Hobby** (free), then **Continue with GitHub**. Use the GitHub account that can see the
   `game-vault-accounting-app` repository.

## Step 2: Import the app (3 min)

1. On the Vercel dashboard, click **Add New… → Project**.
2. Find **game-vault-accounting-app** and click **Import**.
   If you don't see it, click **Adjust GitHub App Permissions** and give Vercel access to that repository.
3. Depending on Vercel's current layout, you'll see one of two screens:
   - **A form with "Environment Variables":** add `OWNER_PASSWORD` (the password you'll sign in with,
     at least 10 characters, not one you use anywhere else) and optionally `APP_USER` (your name for the
     audit trail). Then click **Deploy**.
   - **"Project created… Optional Integrations: Prisma Postgres":** **don't** add Prisma Postgres
     (this guide uses Neon, which the app is tested with and which has no monthly operations cap).
     Just click **Deploy**. You'll add the password in step 3.5.
4. **The first deploy will fail** with "DATABASE_URL is not set", because there's no database yet. That's
   expected. Continue to step 3.

## Step 3: Add the free database (3 min)

1. In your new Vercel project, open the **Storage** tab.
2. Click **Create Database → Neon (Serverless Postgres) → Continue**.
3. Choose the **Free** plan and the region closest to you (e.g. *US East*), then **Create**.
4. When asked which environments to connect, keep **Production** and **Preview** ticked, then **Connect**.
   This adds `DATABASE_URL` and `DATABASE_URL_UNPOOLED` to your project automatically.
5. If you didn't add your password in step 2, add it now: **Settings → Environment Variables**, then add
   `OWNER_PASSWORD` (and optionally `APP_USER`) for **All Environments**, then **Save**.

## Step 4: Deploy again (3 min)

1. Open the **Deployments** tab, click the **⋯** menu on the latest deployment, then **Redeploy**.
2. Wait for **Ready**. During this deploy Vercel automatically:
   - creates all the database tables,
   - loads the chart of accounts (with no fake demo data),
   - builds the app.
3. Click **Visit**. You'll see the Game Vault sign-in page. Sign in with your `OWNER_PASSWORD`.

## Step 5: Put it on your phone and iPad (1 min per device)

- **iPhone / iPad (Safari):** open your Game Vault address, tap the **Share** button, then
  **Add to Home Screen**, then **Add**.
- **Android (Chrome):** open the address, tap the **⋮** menu, then **Add to Home screen** (or **Install app**).
- **Laptop (Chrome / Edge):** click the **install** icon at the right of the address bar, or bookmark the page.

It opens full-screen with its own icon, like a regular app. Sign in once on each device and it
remembers you for 14 days.

---

## Starting your real books

1. **Opening cash:** New transaction → **Owner contribution**, for the cash and bank money the business has today.
2. **Stock you already own:** New transaction → **Device purchase**, once per console or phone, with what you paid.
   Choose *Broken* for units that still need repair.
3. **Parts on the shelf:** Inventory → **Buy parts**, once per part type, with quantity and cost.
4. From then on, record sales, repairs and expenses as they happen.

## Everyday notes

- **The first visit after a quiet spell can take 1–2 seconds.** The free database sleeps when nobody
  is using it and wakes on the next request. The menu item you tapped shows a small spinner meanwhile.
- **Change your password:** Vercel → your project → Settings → Environment Variables → edit
  `OWNER_PASSWORD` → Save, then redeploy (step 4.1). Every device is signed out and needs the new password.
- **Wrong password 5 times** blocks sign-in from that connection for 15 minutes.
- **Updates:** when new code is pushed to the repository, Vercel redeploys on its own within a couple of minutes.

## Backups (please do this)

Your books live in the Neon database:

- Neon's free plan can **restore the database to any point in the last 24 hours** (Neon console → your project → **Restore**).
- For longer-term safety, export a report as **Excel** or **CSV** from the **Reports** page at the end of each month and keep the files.

## If something goes wrong

| What you see | What to do |
|---|---|
| Sign-in page says "Login isn't set up yet" | `OWNER_PASSWORD` is missing. Add it (step 2.3) and redeploy. |
| Deploy fails with "Can't reach database" / `DATABASE_URL` | The database isn't connected. Redo step 3, then redeploy. |
| "Too many attempts" | Wait 15 minutes, then try again with the correct password. |
| Anything else | Vercel → Deployments → click the failed deployment → copy the red error lines and send them to Claude. |
