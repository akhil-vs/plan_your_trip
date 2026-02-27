# Deploying to Vercel

API calls from your Vercel deployment fail for two main reasons. Fix both before redeploying.

## 1. Environment Variables

Add **all** of these in the Vercel dashboard:

**Project → Settings → Environment Variables** (add for Production, Preview, Development):

| Variable | Example | Required |
|----------|---------|----------|
| `MAPBOX_ACCESS_TOKEN` | `pk.eyJ1...` | Yes |
| `NEXT_PUBLIC_MAPBOX_TOKEN` | Same as above | Yes |
| `OPENTRIPMAP_API_KEY` | Your OpenTripMap key | Yes |
| `GEOAPIFY_API_KEY` | Your Geoapify key | Yes |
| `NEXTAUTH_SECRET` | Random 32+ char string | Yes |
| `NEXTAUTH_URL` | `https://your-app.vercel.app` | Yes |
| `DATABASE_URL` | `postgresql://...` | Yes |

### Critical: NEXTAUTH_URL

Set `NEXTAUTH_URL` to your **production URL**, e.g.:

```
https://your-app-name.vercel.app
```

Using `http://localhost:3000` in production will break auth and API behavior.

---

## 2. Database (SQLite Does Not Work on Vercel)

`file:./dev.db` (SQLite) **does not work** on Vercel. Serverless functions use an ephemeral, read-only filesystem.

You must use a **hosted PostgreSQL** database.

### Option A: Vercel Postgres (easiest)

1. In your Vercel project: **Storage → Create Database → Postgres**
2. Connect it to your project
3. Vercel will add `POSTGRES_URL` (or similar). Use it as `DATABASE_URL`
4. Or use the connection string from the database’s **Settings** tab

### Option B: Neon (free tier)

1. Sign up at [neon.tech](https://neon.tech)
2. Create a project and copy the connection string
3. Set `DATABASE_URL` in Vercel to that string

### After adding the database

1. The Prisma schema uses PostgreSQL. Ensure `DATABASE_URL` in Vercel points to your Postgres instance.
2. Run `npx prisma db push` against your production database (or use `prisma migrate deploy` if you use migrations).
3. Redeploy on Vercel.

---

## 3. Verifying

1. Redeploy after setting env vars and fixing the database
2. Open DevTools (F12) → **Network**
3. Try search, directions, or saving a trip
4. Inspect failed requests (status and response body)

Typical failures:

- **500** – Env vars missing, invalid DB connection, or other server error
- **404** – Route or deployment issue (less common)

---

## Local development with PostgreSQL

If you switched from SQLite, use PostgreSQL locally as well:

```bash
# Option 1: Docker
docker compose up -d
# DATABASE_URL=postgresql://postgres:postgres@localhost:5432/planyourtrip

# Option 2: Neon free tier - create a project at neon.tech and use its connection string
```

Then run `npx prisma db push` to create tables.

---

## Quick checklist

- [ ] All 7 env vars set in Vercel
- [ ] `NEXTAUTH_URL` set to `https://your-app.vercel.app`
- [ ] `DATABASE_URL` set to a PostgreSQL connection string (not `file:./dev.db`)
- [ ] Prisma schema uses `provider = "postgresql"`
- [ ] Migrations or `prisma db push` run against production DB
- [ ] Project redeployed after changes
