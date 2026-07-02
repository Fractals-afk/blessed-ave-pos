# Deployment — VPS / cPanel

Supersedes the Railway/Vercel instructions in `README.md`. Real payment flow is manual
confirm (cash, GCash/Maya QR scan-and-confirm by staff) — no PayMongo API/webhook is
wired up despite `README.md` and a leftover raw-body middleware line in
`apps/api/src/index.ts:53` referencing it. No online payment gateway needed.

Everything runs on one VPS (or cPanel host): Postgres, the API, and the two static
Next.js exports (web + admin).

---

## Why VPS, not Vercel/Railway

Kitchen display + order status use Socket.io (`apps/api/src/socket.ts`), which needs a
long-lived process. Vercel's serverless functions don't hold a persistent socket
connection. That's why `packages/db/generated/client/` was committed with Linux
query-engine binaries (`debian-openssl-3.0.x`, `rhel-openssl-3.0.x`) and why
`apps/web` and `apps/admin` build with `output: "export"` (static HTML, no Node
runtime needed for the frontends) — prep already done for self-hosting.

---

## 1. Provision

- VPS or cPanel account with: Node 20+, PostgreSQL 15+, Nginx (or cPanel's Apache +
  "Setup Node.js App" / Passenger)
- Check the box's distro against the committed Prisma binaries. If it's neither
  Debian nor RHEL family, run `pnpm --filter @blessed-ave/db exec prisma generate`
  on the box itself to regenerate the matching engine.

## 2. Get code + install

```bash
git clone https://github.com/Fractals-afk/blessed-ave-pos.git
cd blessed-ave-pos
corepack enable
pnpm install
```

## 3. Environment files

```bash
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.local.example apps/web/.env.local
cp apps/admin/.env.local.example apps/admin/.env.local
```

Fill in:

**`apps/api/.env`**
| Var | Notes |
|---|---|
| `DATABASE_URL` | local Postgres on the same box, or a managed instance |
| `JWT_SECRET` / `JWT_REFRESH_SECRET` | long random strings |
| `PORT` | 4000 (or whatever Nginx proxies to) |
| `CLIENT_URL` / `ADMIN_URL` | real domains, e.g. `https://blessedave.com`, `https://admin.blessedave.com` |
| `SMTP_*` | for order-receipt emails; leave blank to disable |
| `S3_*` | optional — only needed if keeping Cloudflare R2 for menu images. Can be dropped in favor of serving `apps/api` uploads straight off local disk since everything's self-hosted now |

**`apps/web/.env.local`, `apps/admin/.env.local`**
| Var | Notes |
|---|---|
| `NEXT_PUBLIC_API_URL` | `https://api.blessedave.com` |
| `NEXT_PUBLIC_GCASH_QR_URL` / `NEXT_PUBLIC_MAYA_QR_URL` | direct image URLs of your merchant QR codes |

## 4. Database

```bash
pnpm db:migrate   # applies packages/db/prisma/migrations
```

## 5. Build

```bash
pnpm build
# → packages/db, packages/types build first, then:
#   apps/api/dist/          (Node, run with `node dist/index.js`)
#   apps/web/out/           (static export)
#   apps/admin/out/         (static export)
```

## 6. Run the API

**Plain VPS (PM2):**
```bash
npm i -g pm2
pm2 start apps/api/dist/index.js --name blessed-ave-api
pm2 save
pm2 startup   # enables restart on reboot
```

**cPanel:** use "Setup Node.js App" pointed at `apps/api`, startup file `dist/index.js`,
set the env vars in its UI (cPanel's Node App Manager supervises/restarts it — no PM2
needed).

## 7. Reverse proxy (Nginx, plain VPS)

```nginx
server {
    server_name blessedave.com;
    root /path/to/blessed-ave-pos/apps/web/out;
    location / { try_files $uri $uri.html $uri/ =404; }
}

server {
    server_name admin.blessedave.com;
    root /path/to/blessed-ave-pos/apps/admin/out;
    location / { try_files $uri $uri.html $uri/ =404; }
}

server {
    server_name api.blessedave.com;
    location / {
        proxy_pass http://127.0.0.1:4000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";   # required for Socket.io
        proxy_set_header Host $host;
    }
}
```

On cPanel, the Node App Manager wires the Apache proxy for you (including websocket
upgrade) — just point the subdomain at the app.

## 8. SSL

`certbot --nginx -d blessedave.com -d admin.blessedave.com -d api.blessedave.com`
(plain VPS), or cPanel AutoSSL (cPanel).

## 9. Mobile app

Unaffected by any of the above — still ships via Expo EAS to TestFlight/Play Store,
pointed at `NEXT_PUBLIC_API_URL` = the real API domain.

---

## Not needed for this deployment

- Vercel / Railway config (`apps/web/vercel.json`, `apps/admin/vercel.json`) — inert, safe to ignore or delete
- PayMongo keys/webhook — no live integration, payment confirm is manual staff action
- `apps/api/Dockerfile`, `apps/api/railway.json` — Railway-specific, unused on VPS/cPanel
