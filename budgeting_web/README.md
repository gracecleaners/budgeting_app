# Budget Tracker

A modern, offline-capable personal finance platform: income & expenses,
transfers, budgets, savings goals, debts, recurring transactions,
subscriptions, analytics, a financial health score, and alerts.

**Stack**: Next.js 16 (App Router) · Neon serverless Postgres · Drizzle ORM ·
Tailwind CSS v4 · deployable to Netlify as a single site.

## Features

- **Multi-user auth** — email + password (scrypt-hashed), httpOnly session
  cookies, rate limiting, per-user data isolation on every query
- **Accounts/wallets** — cash, bank, Mobile Money, savings, investments;
  transfers between accounts (never counted as income/expense)
- **Transactions** — 6 types, search, filters, pagination; soft delete
- **Budgets** — overall / per-category / per-account, weekly/monthly/custom
  windows, four status levels, dashboard alerts at 75/90/100%
- **Savings goals** — targets, target dates, contributions & withdrawals
  (atomic with the ledger), suggested monthly contribution
- **Debts** — money you owe *and* money owed to you, payments reduce balances
- **Recurring & subscriptions** — auto-generated due transactions, monthly
  cost normalization, due-soon alerts
- **Analytics** — spending/income/savings analysis, cash-flow trend, net
  worth, financial health score with factor breakdown (informational only)
- **Notifications** — daily digest of budget/bill/debt alerts, unread badge
- **Dark mode** — light/dark/system, saved per user, no flash on load
- **Offline** — PWA installable; reads cached per user for offline viewing
- **Mobile-first** — bottom nav, quick-add FAB, 44px tap targets, safe areas

## Getting started

```bash
cd budgeting_web
npm install
cp .env.example .env.local   # add your Neon DATABASE_URL
npm run db:push              # create tables
npm run db:seed              # demo data
npm run dev                  # http://localhost:3000
```

**Demo login**: `demo@budget.local` / `demo1234`

## Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Dev server |
| `npm run build` | Production build |
| `npm test` | Unit tests (35: money, finance, budgets, goals, recurring) |
| `npm run db:push` | Push schema changes to the database |
| `npm run db:generate` | Generate SQL migration files into `drizzle/` |
| `npm run db:seed` | Reseed demo data (deletes previous demo user) |

## Deploying to Netlify

1. Push to GitHub and import the repo in Netlify — the root `netlify.toml`
   sets base directory, build command, and the Next.js runtime plugin.
2. Set the environment variable `DATABASE_URL` to your **Neon pooled**
   connection string (Site configuration → Environment variables).
3. Deploy. API routes run as Netlify functions automatically.

## API overview

All endpoints return `{ success, data, message }` and require the session
cookie (except auth endpoints). Money is integer cents (`amountCents`).

```
POST /api/auth/signup|login|logout     GET /api/auth/me     POST /api/auth/password
GET|POST|PATCH /api/accounts
GET|POST /api/categories
GET|POST /api/transactions             GET|PATCH|DELETE /api/transactions/[id]
GET|POST /api/budgets                  PATCH|DELETE /api/budgets/[id]
GET|POST|PATCH /api/savings            GET|POST /api/savings/[id]/contributions
GET|POST|PATCH /api/debts              GET|POST /api/debts/[id]/payments
GET|POST|DELETE /api/recurring         PUT /api/recurring (run due)
GET|POST|PATCH /api/subscriptions
GET /api/dashboard?range=month|3m|...  GET /api/analytics?range=6m|...
GET|PATCH|POST /api/notifications      GET|PATCH /api/profile
```

## Development rules honored

- No hardcoded financial data; secrets never committed (`.env*` ignored)
- Per-user isolation enforced server-side; soft deletes preserve history
- Money math in integer cents; transfers never inflate income/expenses
- Contributions/payments and their ledger entries write in DB transactions
- Financial health score is labeled informational, not professional advice
