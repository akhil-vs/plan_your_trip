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
| `NEXTAUTH_URL` | `https://your-app.vercel.app` (must be your live HTTPS URL) | Yes |
| `ADMIN_EMAILS` | `you@domain.com` or `a@x.com,b@y.com` | **Required for admin UI** |
| `DATABASE_URL` | `postgresql://...` | Yes |
| `RESEND_API_KEY` | `re_xxxxx` | Optional* |
| `INVITE_EMAIL_FROM` | `Viazo <team@yourdomain.com>` | Optional* |

\* Needed if you want automatic collaboration invite emails. Without these, invites are still created and shareable via invite link.

### Critical: `NEXTAUTH_URL` in production

In **Vercel → Settings → Environment Variables**, set `NEXTAUTH_URL` to your **public HTTPS origin** (no trailing slash), e.g. `https://your-app.vercel.app` or your custom domain. It must match how users open the app. Using `http://localhost` only in Production will break auth cookies and redirects.

### Admin panel (`/admin`)

The admin menu and `/api/admin/*` routes only work if:

1. **`ADMIN_EMAILS`** is set in the Vercel project for the **same environment** you deploy to (Production vs Preview). Use the **exact login email(s)** (comma-separated), e.g. `founder@company.com`.
2. After adding or changing `ADMIN_EMAILS`, **redeploy** (or wait for the next deployment) so serverless functions pick up the new value.

If `ADMIN_EMAILS` is missing in production, `isAdmin` is always false and the admin panel will not appear.

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
# DATABASE_URL=postgresql://postgres:postgres@localhost:5432/viazo

# Option 2: Neon free tier - create a project at neon.tech and use its connection string
```

Then run `npx prisma db push` to create tables.

---

## Quick checklist

- [ ] All required env vars set in Vercel
- [ ] `NEXTAUTH_URL` set to `https://your-app.vercel.app`
- [ ] `DATABASE_URL` set to a PostgreSQL connection string (not `file:./dev.db`)
- [ ] (`Optional`) `RESEND_API_KEY` + `INVITE_EMAIL_FROM` set for invite emails
- [ ] Prisma schema uses `provider = "postgresql"`
- [ ] Migrations or `prisma db push` run against production DB
- [ ] Project redeployed after changes
