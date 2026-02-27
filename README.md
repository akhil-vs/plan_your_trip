# PlanYourTrip - Travel Route Planner

A full-stack travel planning web application with interactive Mapbox maps, worldwide location search, route visualization, and POI discovery (attractions, restaurants, stays).

## Features

- **Interactive Map** - Full-viewport Mapbox map with streets/satellite/outdoors styles
- **Multi-Stop Routes** - Add unlimited waypoints, visualize routes with distance and duration
- **Worldwide Search** - Search locations globally with Mapbox autocomplete
- **Discover Attractions** - Find tourist attractions near your route (OpenTripMap)
- **Find Stays** - Search hotels, hostels, apartments with filters (Geoapify)
- **Food & Dining** - Restaurant and cafe suggestions with cuisine filters (Geoapify)
- **Drag & Drop** - Reorder waypoints by dragging in the sidebar
- **User Accounts** - Sign up, save trips, edit and revisit them
- **Adjustable Radius** - Configure search radius (1-50 km) for POI discovery

## Tech Stack

- **Framework:** Next.js 15 (App Router) + TypeScript
- **Styling:** Tailwind CSS 4 + shadcn/ui
- **Map:** Mapbox GL JS via react-map-gl
- **State:** Zustand
- **Auth:** NextAuth.js v5
- **Database:** Prisma + PostgreSQL (required for Vercel; use Neon/Docker for local)

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Get API keys (all free)

- **Mapbox** - Sign up at [mapbox.com](https://www.mapbox.com/) and get an access token
- **OpenTripMap** - Register at [dev.opentripmap.org](https://dev.opentripmap.org/) for an API key
- **Geoapify** - Sign up at [myprojects.geoapify.com](https://myprojects.geoapify.com/) for an API key

### 3. Configure environment

Copy `.env.example` to `.env` and fill in your keys:

```bash
cp .env.example .env
```

```env
MAPBOX_ACCESS_TOKEN=pk.your_mapbox_token_here
NEXT_PUBLIC_MAPBOX_TOKEN=pk.your_mapbox_token_here
OPENTRIPMAP_API_KEY=your_opentripmap_key
GEOAPIFY_API_KEY=your_geoapify_key
NEXTAUTH_SECRET=any_random_secret_string
NEXTAUTH_URL=http://localhost:3000
# PostgreSQL required (SQLite does not work on Vercel). Use Neon free tier or Docker.
DATABASE_URL=postgresql://user:password@host:5432/dbname?sslmode=require
```

Note: Both `MAPBOX_ACCESS_TOKEN` and `NEXT_PUBLIC_MAPBOX_TOKEN` should be set to the same Mapbox token.

**Vercel deployment:** See [DEPLOYMENT.md](./DEPLOYMENT.md) for env vars and database setup. The first is used server-side for API proxying, the second is used client-side for map rendering.

### 4. Set up database

Use a PostgreSQL database (Neon free tier, Docker, or Vercel Postgres). Then:

```bash
npx prisma db push
```

### 5. Run development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Usage

1. Create an account or sign in
2. Click "New Trip" from the dashboard
3. Search for destinations in the sidebar search box
4. Add multiple stops - the route will be calculated automatically
5. Switch tabs to discover attractions, stays, and food near your route
6. Adjust the search radius and travel mode as needed
7. Save your trip to revisit later
# PlanYourTrip
