# Deployment — Docker on shared Hostinger VPS

Actual live setup, supersedes the old PM2/bare-nginx plan below. Real payment flow is
manual confirm (cash, GCash/Maya QR scan-and-confirm by staff) — no PayMongo API/webhook
wired up. No online payment gateway needed.

---

## Architecture

VPS `76.13.223.235` (Hostinger) is shared with two other projects (`fairway-villa`,
`golf-hub`). A single Caddy container — owned by the `fairway-villa` docker-compose
stack at `/root/fairway-villa/` — is the only thing bound to host ports 80/443. It
terminates TLS (automatic Let's Encrypt) for every domain on the box and
`reverse_proxy`s to whichever app container should handle it, by container name.

Blessed Ave POS runs as its own compose stack at `/root/blessed-ave-pos/`, fully
containerized:

- `blessed-db` — postgres:16-alpine, isolated on the stack's own network
- `blessed-api` — built from `apps/api/Dockerfile` (node:20-slim — see note below)
- `blessed-web` — nginx:alpine serving `apps/web/out` (static Next export)
- `blessed-admin` — nginx:alpine serving `apps/admin/out` (static Next export)

`blessed-api`, `blessed-web`, and `blessed-admin` are additionally joined to
`fairway-villa_default` (declared `external: true` in this repo's
`docker-compose.yml`) so the shared Caddy container can reach them by name. `blessed-db`
is deliberately **not** on that network — only the api container talks to it.

Domains: `blessedave.com`/`www` → `blessed-web:80`, `admin.blessedave.com` →
`blessed-admin:80`, `api.blessedave.com` → `blessed-api:4000`. These three `handle`
blocks live appended to the *shared* `/root/fairway-villa/Caddyfile`, not a Caddyfile in
this repo — editing it always needs `caddy validate` before `caddy reload`, since a
syntax error there would also break the other two tenants' live sites.

**Why node:20-slim, not alpine**: `packages/db/prisma/schema.prisma` sets
`binaryTargets = ["native", "debian-openssl-3.0.x", "rhel-openssl-3.0.x",
"debian-openssl-1.0.x"]` — no musl target. Building on `node:20-alpine` makes `native`
resolve to a musl engine that expects `libssl.so.1.1`, which current Alpine images
don't ship (OpenSSL 3 only) — crashes on startup. `node:20-slim` (Debian) matches the
already-configured `debian-openssl-3.0.x` target instead.

Kitchen display + order status use Socket.io (`apps/api/src/socket.ts`), which needs a
long-lived process — this is why it's a normal Docker container, not a serverless
function.

---

## First-time deploy

### 1. Push + clone

```bash
git push origin main   # from your machine
ssh root@76.13.223.235
git clone https://github.com/Fractals-afk/blessed-ave-pos.git /root/blessed-ave-pos
cd /root/blessed-ave-pos
```

### 2. Env files (create directly on the VPS, never commit these)

**`/root/blessed-ave-pos/.env`** (postgres container credentials):
```
POSTGRES_USER=blessedave
POSTGRES_PASSWORD=<openssl rand -hex 24>   # avoid base64 (/, + break DATABASE_URL parsing)
POSTGRES_DB=blessed_ave
```

**`apps/api/.env`**:
| Var | Notes |
|---|---|
| `DATABASE_URL` | `postgresql://blessedave:<same password>@blessed-db:5432/blessed_ave` — container name, not localhost |
| `JWT_SECRET` / `JWT_REFRESH_SECRET` | `openssl rand -base64 32` each |
| `PORT` | 4000 |
| `CLIENT_URL` | `https://blessedave.com` |
| `ADMIN_URL` | `https://admin.blessedave.com` |
| `SMTP_*` | leave blank to disable order-receipt emails |
| `NODE_ENV` | `production` |

**`apps/web/.env.local`** and **`apps/admin/.env.local`** (baked in at build time —
changing these requires rebuilding, not just restarting):
```
NEXT_PUBLIC_API_URL=https://api.blessedave.com
NEXT_PUBLIC_GCASH_QR_URL=<real merchant QR image URL>
NEXT_PUBLIC_MAYA_QR_URL=<real merchant QR image URL>
```

### 3. Build static exports

No Node installed on the host — build inside a throwaway container instead:

```bash
docker run --rm -v /root/blessed-ave-pos:/app -w /app node:22-alpine sh -c \
  'corepack enable && pnpm --filter @blessed-ave/db generate && \
   pnpm --filter @blessed-ave/web build && pnpm --filter @blessed-ave/admin build'
```
(pnpm 11 requires Node 22+, hence `node:22-alpine` here — separate from the api's
`node:20-slim` build image.)

### 4. Build + start the stack

```bash
docker compose build blessed-api
docker compose up -d
```

### 5. Migrate + seed

```bash
docker exec blessed-api sh -c 'cd packages/db && npx prisma migrate deploy'
docker exec blessed-api sh -c 'cd packages/db && npx prisma db seed'
```
Seed creates owner login `admin@blessedave.com` / `blessed2024!` — **change this
password immediately**, it's a public default now.

### 6. Wire Caddy

Append to `/root/fairway-villa/Caddyfile` (back it up first):

```caddyfile
blessedave.com, www.blessedave.com {
    encode gzip zstd
    header {
        Strict-Transport-Security "max-age=31536000; includeSubDomains"
        X-Content-Type-Options "nosniff"
        Referrer-Policy "strict-origin-when-cross-origin"
        -Server
    }
    reverse_proxy blessed-web:80
    log { output stdout; format console }
}

admin.blessedave.com {
    encode gzip zstd
    header {
        Strict-Transport-Security "max-age=31536000; includeSubDomains"
        X-Content-Type-Options "nosniff"
        Referrer-Policy "strict-origin-when-cross-origin"
        -Server
    }
    reverse_proxy blessed-admin:80
    log { output stdout; format console }
}

api.blessedave.com {
    encode gzip zstd
    header {
        Strict-Transport-Security "max-age=31536000; includeSubDomains"
        X-Content-Type-Options "nosniff"
        Referrer-Policy "strict-origin-when-cross-origin"
        -Server
    }
    reverse_proxy blessed-api:4000
    log { output stdout; format console }
}
```

```bash
docker exec caddy caddy validate --config /etc/caddy/Caddyfile   # always validate first
docker exec caddy caddy reload --config /etc/caddy/Caddyfile     # reload, not restart —
                                                                   # avoids dropping the
                                                                   # other two tenants' traffic
```

DNS: `A` records for `blessedave.com`, `www`, `admin`, `api` all → `76.13.223.235`
(managed in Hostinger hPanel DNS Zone Editor).

### 7. Verify

```bash
curl -sI https://blessedave.com
curl -sI https://admin.blessedave.com
curl -s https://api.blessedave.com/health
```

---

## Redeploying after code changes

```bash
cd /root/blessed-ave-pos
git pull origin main
docker compose build blessed-api      # if apps/api or packages/db changed
docker run --rm -v /root/blessed-ave-pos:/app -w /app node:22-alpine sh -c \
  'corepack enable && pnpm --filter @blessed-ave/web build && pnpm --filter @blessed-ave/admin build'
docker compose up -d
```
If `packages/db/prisma/migrations` changed, re-run the migrate command from step 5.

---

## Mobile app

Unaffected — ships via Expo EAS to TestFlight/Play Store, pointed at
`NEXT_PUBLIC_API_URL` = `https://api.blessedave.com`.

---

## Known gaps

- `NEXT_PUBLIC_GCASH_QR_URL` / `NEXT_PUBLIC_MAYA_QR_URL` are placeholders until real
  merchant QR images are uploaded and the web/admin apps rebuilt.
- SMTP unset — order confirmation emails are disabled.
- S3/R2 env vars unset — file uploads (menu images) aren't wired to object storage yet.

## Not needed for this deployment

- `apps/web/vercel.json`, `apps/admin/vercel.json` — inert, safe to ignore or delete
- PayMongo keys/webhook — no live integration, payment confirm is manual staff action
- PM2 — superseded by Docker; no Node installed directly on the host at all
