# Blessed Ave Cafe — Full System Plan

## What We're Building

A complete digital system for Blessed Ave Cafe made up of three interconnected pieces:

1. **Customer Website** — public-facing site with menu browsing, online pre-ordering (pickup/delivery), and QR-code table ordering
2. **Admin Web App** — browser-based dashboard for managing the cafe from any device
3. **Admin Mobile App** — React Native companion app for managing on the go

---

## System Architecture

### Tech Stack

| Layer | Technology | Why |
|---|---|---|
| Customer website | Next.js (React) | Fast, SEO-friendly, handles both marketing pages and ordering flows |
| Admin web app | Next.js (separate app or sub-route) | Shares components and types with the website |
| Mobile admin app | React Native + Expo | Cross-platform (iOS + Android), shares business logic with web |
| Backend API | Node.js + Express | REST API consumed by all three frontends |
| Database | PostgreSQL | Relational — fits orders, inventory, and financial data well |
| ORM | Prisma | Type-safe DB queries, easy migrations |
| Payments | Stripe | Industry standard, supports online + in-person (Stripe Terminal) |
| Auth | JWT + refresh tokens | Lightweight, works across web and mobile |
| Real-time | Socket.io | Live order updates to POS and kitchen display |
| File storage | AWS S3 or Cloudflare R2 | Menu item images, receipts, reports |
| Deployment | Vercel (frontend) + Railway (API + DB) | Simple, scalable, low ops overhead |

---

## Module Breakdown

### 1. Menu Management
- Categories (e.g. Coffee, Food, Drinks)
- Items with name, description, price, photo
- Modifiers/options (size, milk type, extras) with price adjustments
- Availability toggles (sold out, time-of-day)
- Admin can update menu in real time; website pulls fresh data

### 2. Customer Website — Online Ordering
- Landing page with brand, hours, location
- Menu browsing with categories and search
- Cart with modifier selection
- Checkout: name, pickup time or delivery address, notes
- Stripe payment (card, Apple Pay, Google Pay)
- Order confirmation page + email receipt
- Order status tracking (received → preparing → ready)

### 3. Customer Website — QR Table Ordering
- Each table gets a unique QR code that encodes a table number
- Scanning opens the ordering flow pre-filled with the table
- Same menu/cart/modifier experience as online ordering
- Payment at table via Stripe or "pay at counter" option
- Orders go directly to the kitchen queue

### 4. POS — Staff Order Taking
- Staff log in on a tablet or desktop browser
- Take orders manually (walk-in customers paying in person)
- Search menu, add items, apply discounts or comps
- Accept payment: cash, card (Stripe Terminal), or mark as paid
- Open/close till, end-of-day cash reconciliation

### 5. Kitchen Display / Order Queue
- Real-time feed of all incoming orders (online, QR, POS)
- Staff mark items or whole orders as: received → preparing → ready → collected
- Orders are colour-coded by age (turns red if waiting too long)
- Sound alert on new order

### 6. Inventory
- Ingredient/supply catalogue with unit of measure
- Stock levels — manually updated or auto-decremented per sale (recipe mapping)
- Low stock alerts (configurable threshold per item)
- Supplier contacts and purchase order logging
- Waste/adjustment logging

### 7. Financials & Reporting
- Daily, weekly, monthly sales summaries
- Revenue by category and item
- Payment method breakdown (cash vs card vs online)
- Refunds and voids log
- Profit/loss overview (sales vs cost of goods from inventory)
- CSV/PDF export for accountant or Xero/QuickBooks import
- GST/tax summary (configurable rate)

### 8. Staff & Scheduling
- Staff accounts with roles: Owner, Manager, Staff
- Role-based permissions (e.g. only managers can apply discounts or run reports)
- Shift scheduling: weekly roster view, assign staff to shifts
- Clock in/out (optional, for labour cost tracking)
- Activity log: who did what and when

---

## Database Schema (Key Tables)

```
users           — staff accounts, roles
menu_categories — top-level groupings
menu_items      — items with price, description, image
item_modifiers  — options attached to items
orders          — every order (source: online/qr/pos)
order_items     — line items per order
payments        — payment records per order
tables          — cafe table list with QR tokens
inventory_items — ingredients and supplies
inventory_log   — stock movements (sale, purchase, waste)
suppliers       — supplier contact list
purchase_orders — orders placed to suppliers
shifts          — scheduled shifts per staff member
clock_events    — clock in/out records
```

---

## Build Phases

### Phase 1 — Core Ordering (Weeks 1–4)
- Set up monorepo (website + API + shared types)
- Database schema + Prisma migrations
- Menu management in admin
- Customer website: menu display + online ordering + Stripe checkout
- Basic order confirmation and email receipt

### Phase 2 — POS & Kitchen (Weeks 5–7)
- Staff auth and role system
- POS order entry interface
- QR code generation per table + table ordering flow
- Kitchen display with real-time Socket.io updates

### Phase 3 — Inventory (Weeks 8–10)
- Inventory catalogue and stock level management
- Low stock alerts
- Basic recipe mapping (auto-decrement on sale)
- Supplier and purchase order log

### Phase 4 — Financials & Reporting (Weeks 11–13)
- Sales dashboard with charts
- Revenue breakdowns and filters
- Export to CSV/PDF
- Tax summary

### Phase 5 — Staff & Mobile App (Weeks 14–17)
- Staff scheduling and roster view
- Clock in/out
- React Native mobile app (mirrors key admin web features)
- Expo build + TestFlight / Play Store submission

### Phase 6 — Polish & Launch (Weeks 18–20)
- End-to-end testing
- Performance optimisation
- Custom domain, SSL, production deployment
- Staff training documentation

---

## Folder Structure (Monorepo)

```
blessed-ave/
├── apps/
│   ├── web/          ← customer website (Next.js)
│   ├── admin/        ← admin web app (Next.js)
│   ├── mobile/       ← admin mobile app (React Native + Expo)
│   └── api/          ← backend REST API (Node + Express)
├── packages/
│   ├── db/           ← Prisma schema + migrations
│   ├── types/        ← shared TypeScript types
│   └── utils/        ← shared helper functions
└── package.json      ← monorepo root (pnpm workspaces)
```

---

## Estimated Costs (Monthly, Production)

| Service | Cost |
|---|---|
| Vercel (frontend hosting) | Free–$20 |
| Railway (API + PostgreSQL) | ~$10–30 |
| Stripe fees | 1.7% + 30¢ per transaction |
| Cloudflare R2 (images) | ~$0–5 |
| Expo (mobile builds) | Free–$29 |
| **Total fixed** | **~$20–55/month** |

---

## Next Steps

1. **Confirm the plan** — review this document and flag anything to add, change, or cut
2. **Set up the monorepo** — initialise the project structure and tooling
3. **Start Phase 1** — database schema first, then the customer website + ordering flow
4. **Stripe account** — you'll need a Stripe account set up before payment features can be wired in

---

*Generated: May 2026 — Blessed Ave Cafe POS Project*
