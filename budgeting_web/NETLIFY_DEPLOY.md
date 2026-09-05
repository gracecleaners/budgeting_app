# Netlify Deployment

The backend now lives inside the Next.js app as API route handlers
(`app/api/**`), deployed as Netlify functions. Django + SQLite is no longer
needed at runtime — `budgeting_api/` is kept only as reference.

## Stack

- **Next.js 16** frontend + API routes (one deployable unit)
- **Drizzle ORM** over **Neon serverless Postgres** (`@neondatabase/serverless`)
- **Netlify** hosting (OpenNext adapter is auto-installed by Netlify)

## Local development

1. `npm install`
2. Create a Neon project at https://console.neon.tech and copy the **pooled**
   connection string.
3. Create `.env.local`:
   ```
   DATABASE_URL=postgresql://...neon.tech/db?sslmode=require
   ```
4. Push the schema and seed data:
   ```bash
   npm run db:push
   npm run db:seed
   ```
5. `npm run dev` — dashboard at http://localhost:3000, API at http://localhost:3000/api/*

## Deploying to Netlify

1. Push this repo to GitHub.
2. In Netlify: **Add new site → Import an existing project**.
3. Set **Base directory** to `budgeting_web` (monorepo).
4. Environment variables (Site configuration → Environment variables):
   - `DATABASE_URL` — your Neon pooled connection string (required)
   - `DISABLE_PWA=1` — optional, if the service worker causes issues
5. Build command `npm run build` and publish directory `.next` are
   auto-detected. Deploy.

## Applying schema changes

After editing `lib/db/schema.ts`:

```bash
npm run db:generate   # writes SQL into drizzle/
npm run db:migrate    # applies pending migrations to DATABASE_URL
```

## API endpoints (same contract as the old Django API)

| Method | Path | Notes |
|---|---|---|
| GET/POST | `/api/categories` | list (with `spent`), create |
| GET/PATCH/DELETE | `/api/categories/{id}` | |
| GET/POST | `/api/budgets` | list (with `progress`), create; unique per (category, period) |
| GET/PATCH/DELETE | `/api/budgets/{id}` | |
| GET/POST | `/api/transactions` | `?ordering=-date` and `?type=income|expense` filters |
| GET/PATCH/DELETE | `/api/transactions/{id}` | |
| GET | `/api/summary` | totals, months tracked, average monthly expense |

The frontend (`lib/api.ts`) calls relative `/api` paths by default, so no
`NEXT_PUBLIC_API_URL` or CORS configuration is needed. Override it only if
you host the API elsewhere.
