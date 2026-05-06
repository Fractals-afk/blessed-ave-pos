# Blessed Ave Cafe — Full System

A complete ordering, POS, inventory and admin system for Blessed Ave Cafe.

## What's included

| App | Path | Description |
|---|---|---|
| Customer Website | `apps/web` | Public menu, online ordering, QR table ordering, order tracking |
| Admin Web App | `apps/admin` | Dashboard, POS, kitchen display, inventory, reports, staff |
| Mobile Admin App | `apps/mobile` | React Native app for on-the-go management |
| Backend API | `apps/api` | Node.js + Express REST API + Socket.io |
| Database | `packages/db` | PostgreSQL + Prisma ORM |
| Shared Types | `packages/types` | TypeScript types shared across all apps |

---

## Prerequisites

- Node.js 20+
- pnpm 9+ (`npm install -g pnpm`)
- PostgreSQL 15+ (local or hosted on Railway/Supabase)
- A [PayMongo](https://paymongo.com) account (Philippine payment gateway — GCash, Maya, card)

---

## First-time setup

```bash
# 1. Install all dependencies
pnpm install

# 2. Set up environment variables
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.local.example apps/web/.env.local
cp apps/admin/.env.local.example apps/admin/.env.local

# 3. Edit apps/api/.env and fill in your DATABASE_URL, JWT secrets, PayMongo keys

# 4. Run database migrations
pnpm db:migrate

# 5. Seed the database (creates owner account + sample menu)
pnpm db:seed
```

Default admin login after seeding:
- Email: `admin@blessedave.com`
- Password: `blessed2024!`

---

## Development

```bash
# Run everything at once (API + web + admin)
pnpm dev

# Or run individually:
pnpm --filter @blessed-ave/api dev        # API on :4000
pnpm --filter @blessed-ave/web dev        # Customer site on :3000
pnpm --filter @blessed-ave/admin dev      # Admin app on :3001
pnpm --filter @blessed-ave/mobile start   # Expo mobile app
```

---

## Environment variables

### `apps/api/.env`

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_SECRET` | Long random string for access tokens |
| `JWT_REFRESH_SECRET` | Long random string for refresh tokens |
| `PAYMONGO_SECRET_KEY` | From PayMongo dashboard |
| `PAYMONGO_PUBLIC_KEY` | From PayMongo dashboard |
| `PAYMONGO_WEBHOOK_SECRET` | From PayMongo webhook settings |
| `CLIENT_URL` | Customer website URL (e.g. `https://order.blessedave.com`) |
| `ADMIN_URL` | Admin dashboard URL (e.g. `https://admin.blessedave.com`) |
| `SMTP_*` | Email settings for order confirmations |
| `S3_*` | Cloudflare R2 or AWS S3 for menu images |

### `apps/web/.env.local` and `apps/admin/.env.local`

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_API_URL` | URL of the API (e.g. `https://api.blessedave.com`) |
| `NEXT_PUBLIC_PAYMONGO_PUBLIC_KEY` | PayMongo public key |

---

## PayMongo setup

1. Sign up at [paymongo.com](https://paymongo.com)
2. Go to **Developers → API Keys** and copy your live secret + public keys
3. Go to **Developers → Webhooks** and create a webhook pointing to:
   `https://api.blessedave.com/api/payments/webhook`
   Subscribe to events: `source.chargeable`, `payment.paid`
4. Copy the webhook secret into `PAYMONGO_WEBHOOK_SECRET`

---

## Deployment

### API + Database → Railway

1. Create a new Railway project
2. Add a **PostgreSQL** service — Railway gives you a `DATABASE_URL`
3. Add a **Node.js** service pointing to `apps/api`
4. Set all environment variables from `apps/api/.env.example`
5. Deploy

### Customer Website → Vercel

1. Import the repo into Vercel
2. Set root to `apps/web`
3. Add `NEXT_PUBLIC_API_URL` and `NEXT_PUBLIC_PAYMONGO_PUBLIC_KEY`
4. Deploy

### Admin Web App → Vercel

Same as above but root is `apps/admin`.

### Mobile App → Expo EAS

```bash
# Install EAS CLI
npm install -g eas-cli

# Login
eas login

# Configure (first time)
eas build:configure

# Build for iOS
pnpm --filter @blessed-ave/mobile build:ios

# Build for Android
pnpm --filter @blessed-ave/mobile build:android
```

---

## Project structure

```
blessed-ave/
├── apps/
│   ├── api/           Node.js + Express API
│   ├── web/           Customer website (Next.js)
│   ├── admin/         Admin web app (Next.js)
│   └── mobile/        Admin mobile app (React Native + Expo)
├── packages/
│   ├── db/            Prisma schema + seed
│   ├── types/         Shared TypeScript types
│   └── utils/         Shared utilities
└── package.json       pnpm workspace root
```

---

## Key URLs (once deployed)

| URL | Description |
|---|---|
| `https://blessedave.com` | Customer-facing website |
| `https://blessedave.com/order` | Online ordering |
| `https://blessedave.com/table/:token` | QR table ordering |
| `https://blessedave.com/order/:id` | Order status tracking |
| `https://admin.blessedave.com` | Admin web app |
| `https://api.blessedave.com/health` | API health check |

---

## QR Table Ordering

1. Go to **Admin → Tables & QR**
2. Click **View QR** on any table
3. Download the PNG and print it — place it on the table
4. Customers scan with their phone camera and can order directly

---

*Built for Blessed Ave Cafe — May 2026*
