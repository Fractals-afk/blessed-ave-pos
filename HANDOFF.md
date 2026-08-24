# Handoff — 2026-08-24

## What happened this session

1. **Moved the repo off Google Drive.** Working copy was at
   `F:\My Drive\Projects\Blessed AVE POS` — Drive's streaming filesystem made
   `git status`/`du` hang for 2+ minutes, real corruption risk (evidenced by a
   leftover `.git.broken-backup/` from a prior break). Fresh-cloned from GitHub
   into `C:\Projects\Blessed AVE POS` instead. GitHub is now the only
   cross-device sync mechanism for this repo — see "Second PC" below.
   Old Drive folder still exists, untouched, as a fallback. Delete it once
   you've used the new location for a while and trust it.

2. **Fixed README/DEPLOY.md conflict.** README described a Railway+Vercel+
   PayMongo deploy that was never real. Trimmed to point at DEPLOY.md (the
   actual Docker-on-Hostinger-VPS setup) and noted payment is manual
   (cash/GCash/Maya QR, staff-confirmed), no payment API wired.

3. **Ran a 4-agent integrity check** (security, database, admin UI/UX,
   dependency audit) across the whole app. Full findings are in the chat
   transcript; four were fixed and shipped this session (see below). The rest
   are listed under "Known issues, not yet fixed."

4. **Shipped 4 fixes to production** (commit `dc642f7`, live on the VPS):
   - `apps/api/src/routes/staff.ts` — closed a privilege-escalation hole:
     any MANAGER could create/promote an OWNER account. Now only an existing
     OWNER can grant the OWNER role.
   - `apps/api/src/socket.ts` — Socket.io had zero auth. Anyone reaching the
     API host could join the `kitchen`/`admin` rooms and see live order data,
     customer names/phones, totals. Now verifies JWT on handshake, gates
     `join:kitchen` (OWNER/MANAGER/KITCHEN/STAFF) and `join:admin`
     (OWNER/MANAGER). Client side (`kitchen/page.tsx`, `pos/page.tsx`) now
     sends the stored access token on socket connect.
   - `packages/db/prisma/schema.prisma` + new migration
     `20260824000000_add_order_indexes` — the `Order` table had **zero
     indexes**. The kitchen display's hot-path query
     (`WHERE status IN (...) ORDER BY createdAt`, polled every few seconds)
     was doing a full table scan. Added indexes on `(status, createdAt)`,
     `tableId`, `staffId`.
   - Deploy required a manual extra step beyond the documented sequence:
     `apps/web/out` and `apps/admin/out` (the Next.js static exports nginx
     serves) don't get rebuilt by `docker compose build blessed-api` — they
     need their own `docker run ... pnpm build` pass. This was missed on the
     first deploy attempt and briefly left the kitchen display unable to
     receive live orders (old client, no auth token, silently rejected by
     the new socket gate). Caught and fixed same session — see DEPLOY.md,
     the "Redeploying after code changes" section already documents this
     correctly, it was just missed in the moment.

## Known issues, not yet fixed (from the integrity check)

**Security — apps/api:**
- No rate limiting on `/api/auth/login` or `/api/staff/:id/reset-password`
  — brute-forceable.
- Refresh tokens stored **plaintext** in the DB
  (`schema.prisma` → `RefreshToken.token`). Should be hashed at rest.
- Refresh tokens never rotate — a stolen one is valid for the full 7 days.
- JWT role isn't re-checked against the DB mid-token-life — a
  deactivated/demoted staffer keeps access up to 15 min (the access token
  TTL). Low severity alone, but compounds with the OWNER-escalation class
  of bug if a similar hole is ever reintroduced.
- `GET /api/orders/:id` is unauthenticated and returns full PII + payment
  info to anyone with the order ID (intentional for customer tracking
  links, but consider trimming the response).
- Dead PayMongo webhook wiring in `index.ts` (raw-body middleware on an
  unmounted route, currently 404s) — harmless today, but confusing dead
  code inviting someone to wire a real unauthenticated handler onto it
  later. Worth deleting along with the `PAYMONGO_*` env vars.

**Database:**
- Inventory stock fields (`currentStock`, `quantityChange`, etc.) are
  `Float` — will drift over months of subtraction. Money is correctly
  `Int` centavos already; stock should probably follow the same pattern
  or use `Decimal`.

**Admin UI (apps/admin/src):**
- POS payment actions (`placeOrder`, `confirmCashPayment`,
  `confirmQrPayment`, `refundOrder` in `pos/page.tsx`) use raw `fetch`
  instead of the app's `apiFetch` with token-refresh-and-retry. An expired
  token mid-checkout just throws a generic "Failed" toast with no prompt
  to relogin — cashier stuck mid-transaction with a customer waiting.
- No double-tap guard on the kitchen "Mark Ready" button — possible
  duplicate status transitions on a flaky touchscreen connection.
- Three separate, fully copy-pasted login pages (`/login`, `/pos/login`,
  `/kitchen/login`) — any auth UX change needs tripling.
- Touch targets on kitchen action buttons (~28-30px) and POS cart qty
  buttons (36px) are under the ~44px comfort threshold for a rush-mode
  touchscreen.
- VAT rate (1.12) and senior/PWD discount (0.2) hardcoded inline in
  multiple places in `pos/page.tsx` instead of one constant.

**Tooling / upgrades:**
- pnpm pinned at 11.1.2, 11.23.0 available — low-risk bump.
- `pnpm --filter './apps/*' build` fails on this pnpm/Windows combo
  ("No projects matched the filters") — use `pnpm -r build` instead, or
  switch the script to package-name filters.
- Express 4→5 and Prisma 5→6 are worth planning (Express 5's built-in
  async error handling is a real reliability win for a payment-handling
  API). Next.js 14→15 and the Expo SDK bump can wait longer.
- The `apps/api/dist` and `packages/db/generated` directories are
  force-included in git (`.gitignore` has `!apps/api/dist/` etc.) despite
  Docker rebuilding from source on deploy — they're dead weight that
  drifts from `src` between commits (they had drifted significantly
  before this session's `pnpm build` refreshed them locally). Worth
  removing from git tracking at some point; not urgent, not touched this
  session to keep the diff focused.

## Second PC setup (prep only, not done)

Repo isn't cloned there yet. When you're at that machine:
```bash
git clone https://github.com/Fractals-afk/blessed-ave-pos.git
```
Then copy `.env` files across manually (`apps/api/.env`,
`apps/web/.env.local`, `apps/admin/.env.local`) — gitignored on purpose,
not in the repo. Then `pnpm install`, verify `pnpm typecheck && pnpm build`.

Going forward: pull before starting work, push when done, on both machines.

## VPS access

SSH key for `root@76.13.223.235` (shared Hostinger VPS, also hosts
Philippine-Golf-Hub and fairway-villa) lives at
`F:\My Drive\Projects\Philippine-Golf-Hub\.ssh\fairway-cowork-persistent`.
A permission rule for this host now exists in
`C:\Users\liamm\.claude\settings.json` (`Bash(ssh root@76.13.223.235:*)`) —
read-only SSH commands run without prompting; state-changing ones
(git pull, docker rebuild, migrations) still get stopped by Claude Code's
auto-mode classifier and need to run from an interactive session where a
human approves each step. That's intentional — don't try to route around it.
