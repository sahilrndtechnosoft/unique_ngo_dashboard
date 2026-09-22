# Unique NGO Dashboard — VPS deployment

Domain: **app.uniquemarketing.in**  
App root: **/var/www/rndprojects/unique_ngo_dashboard**  
Nginx conf: **/etc/nginx/conf.d/app.uniquemarketing.in.conf**

## Ports

| Service | Port | Notes |
|---------|------|--------|
| Nginx HTTP/HTTPS | 80 / 443 | Public |
| NestJS API (PM2) | **3017** | Bound to `127.0.0.1` via nginx proxy only |
| PostgreSQL | 5432 | Local DB (default) |
| Frontend | *(none)* | Built static files served by nginx from `frontend/dist` |

**Why 3017?** Avoids busy defaults (`3000`, `3001`, `5173`, `8080`, `4000`). Confirm on the VPS:

```bash
ss -tulpn | grep -E '3017|3000|5173'
```

If 3017 is taken, pick another free high port (e.g. `3027`) and update `ecosystem.config.cjs`, nginx `proxy_pass`, and backend `.env` `PORT` together.

---

## Target layout

```text
/var/www/rndprojects/UNIQUE_NGO_DASHBOARD/
├── backend/                 # NestJS + Prisma
├── frontend/                # Vite React (build → dist/)
├── ecosystem.config.cjs     # PM2
└── deploy/nginx/...         # nginx sample (copy to /etc/nginx/conf.d)
```

---

## 1. Server packages

```bash
sudo apt update
sudo apt install -y nginx git curl build-essential
# Node 22 LTS (or 20+)
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs
sudo npm i -g pm2
# PostgreSQL if not already installed
sudo apt install -y postgresql postgresql-contrib
```

Ensure DNS `A` record for `app.uniquemarketing.in` points at this VPS.

---

## 2. Clone & env files

```bash
sudo mkdir -p /var/www/rndprojects
sudo chown -R "$USER":"$USER" /var/www/rndprojects
cd /var/www/rndprojects
git clone <YOUR_GITHUB_REPO_URL> UNIQUE_NGO_DASHBOARD
cd UNIQUE_NGO_DASHBOARD
```

### Backend env — `backend/.env`

```env
DATABASE_URL=postgresql://USER:PASSWORD@127.0.0.1:5432/unique_ngo_dash
PORT=3017
NODE_ENV=production

JWT_ACCESS_SECRET=<long-random>
JWT_REFRESH_SECRET=<long-random>
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=30d

BCRYPT_ROUNDS=12
OTP_EXPIRY_MINUTES=5

APP_URL=https://app.uniquemarketing.in
UPLOAD_DIR=uploads

# Shiprocket (required to enable fulfillment)
SHIPROCKET_EMAIL=<api-user-email>
SHIPROCKET_PASSWORD=<api-user-password>
SHIPROCKET_PICKUP_LOCATION=<pickup-location-name>
SHIPROCKET_PICKUP_POSTCODE=<warehouse-postcode-for-courier-quotes>
SHIPROCKET_FALLBACK_EMAIL=<orders-contact-email>
SHIPROCKET_WEBHOOK_SECRET=<long-random-secret>

# Seed (optional)
ADMIN_EMAIL=admin@unique-ngo.com
ADMIN_PASSWORD=<strong-password>
ADMIN_FULL_NAME=Super Admin
ADMIN_MOBILE=9999999999
ADMIN_ROLE=SUPER_ADMIN
EXPOSE_OTP_IN_RESPONSE=false
```

### Frontend env — `frontend/.env.production` (used at build time)

```env
VITE_API_URL=https://app.uniquemarketing.in/api/v1
VITE_API_ORIGIN=https://app.uniquemarketing.in
```

Same-origin relative URLs also work:

```env
VITE_API_URL=/api/v1
VITE_API_ORIGIN=
```

---

## 3. Database

```bash
sudo -u postgres psql -c "CREATE USER unique_ngo WITH PASSWORD 'YOUR_DB_PASSWORD';"
sudo -u postgres psql -c "CREATE DATABASE unique_ngo_dash OWNER unique_ngo;"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE unique_ngo_dash TO unique_ngo;"
```

---

## 4. Install, migrate, build, seed

```bash
cd /var/www/rndprojects/UNIQUE_NGO_DASHBOARD/backend
npm ci
npx prisma generate
npx prisma migrate deploy
# optional first time:
# npx prisma db seed
npm run build
mkdir -p uploads

cd ../frontend
npm ci
npm run build
```

Commerce referential-integrity constraints are installed as `NOT VALID` so
existing order and tracking history is retained while new writes are checked.
Do not remove orphaned historical rows to make these constraints validate.
Before and after deployment, run the read-only relationship audit:
with `DATABASE_URL` exported from the backend environment (do not commit it):

```bash
psql "$DATABASE_URL" -f backend/prisma/audit_commerce_integrity.sql
```

Review every nonzero result as historical data; do not delete it automatically.
Repair only with a reviewed mapping/retention decision. Once the corresponding
relationship reports zero orphans, validate its named constraint individually
with `ALTER TABLE ... VALIDATE CONSTRAINT ...`.

Order-level financial snapshot checks are also installed as `NOT VALID` so
existing snapshots remain reviewable. Order-item rate, commission, and payout
checks are also `NOT VALID`; this preserves legacy rows while enforcing the
rules for new writes. Seller-owned order items must also include immutable
commission and payout snapshots. Commission rate bounds for products, categories, sellers,
and platform settings are enforced the same way. Run the read-only financial audit:

```bash
psql "$DATABASE_URL" -f backend/prisma/audit_commerce_financial_integrity.sql
```

Investigate each nonzero invariant before correcting it; the order-item and
order snapshots are accounting records. After reviewed corrections, validate
the matching `orders_*_check` and `order_items_*_check` constraints individually.
Validate `commission_settings_*_check`, `product_categories_*_check`,
`products_*_check`, and `seller_profiles_*_check` constraints only after the
corresponding rate audit reports zero invalid rows.
Validate `order_items_seller_financial_snapshot_required_check` only after the
financial audit reports zero missing seller snapshots.

---

## 5. PM2 (API only)

```bash
sudo mkdir -p /var/log/pm2
cd /var/www/rndprojects/UNIQUE_NGO_DASHBOARD
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup   # run the printed command as root once
pm2 status
```

Useful:

```bash
pm2 logs unique-ngo-api
pm2 restart unique-ngo-api
```

---

## 6. Nginx

```bash
sudo cp /var/www/rndprojects/UNIQUE_NGO_DASHBOARD/deploy/nginx/app.uniquemarketing.in.conf \
  /etc/nginx/conf.d/app.uniquemarketing.in.conf
sudo nginx -t
sudo systemctl reload nginx
```

### TLS (Let's Encrypt)

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo mkdir -p /var/www/certbot
sudo certbot --nginx -d app.uniquemarketing.in
```

---

## 7. Smoke checks

```bash
curl -I https://app.uniquemarketing.in
curl -s https://app.uniquemarketing.in/api/v1/categories | head
# Swagger: https://app.uniquemarketing.in/api/docs
```

Login in browser: `https://app.uniquemarketing.in`  
Admin seed (if seeded): see backend seed output / `ADMIN_*` env.

For shipment tracking, configure the Shiprocket webhook URL as
`https://app.uniquemarketing.in/api/v1/webhooks/delivery/status` and use the same
`SHIPROCKET_WEBHOOK_SECRET` as its security token (`x-api-key` header).
Seller pickup origins can be configured on each seller profile in Admin → Sellers;
orders without a seller origin use `SHIPROCKET_PICKUP_LOCATION` as the centralized warehouse.
Set `SHIPROCKET_PICKUP_POSTCODE` to that warehouse's six-digit postal code to enable
serviceability quotes for admin-owned products; seller products use their configured pickup pin code.

---

## 8. Redeploy after git pull

```bash
cd /var/www/rndprojects/UNIQUE_NGO_DASHBOARD
git pull

cd backend
npm ci
npx prisma generate
npx prisma migrate deploy
npm run build
pm2 restart unique-ngo-api

cd ../frontend
npm ci
npm run build
# nginx serves updated dist/ immediately — no PM2 for frontend
```

---

## Request flow

```text
Browser → https://app.uniquemarketing.in
       → nginx → frontend/dist (SPA)
       → /api/*  and /uploads/* → 127.0.0.1:3017 (PM2 NestJS)
```

---

## Uploads 404 on live (common)

If `/uploads/logo/*.jpeg` 404s but files exist under `backend/uploads/`, nginx likely matched a static-extension `location ~* \.(jpeg|png|...)$` under `frontend/dist` instead of proxying uploads.

Fix: use `location ^~ /uploads/` with `alias` to `backend/uploads/` (see `deploy/nginx/app.uniquemarketing.in.conf`), then:

```bash
sudo cp /var/www/rndprojects/unique_ngo_dashboard/deploy/nginx/app.uniquemarketing.in.conf \
  /etc/nginx/conf.d/app.uniquemarketing.in.conf
# If certbot created a separate 443 block, copy the ^~ /uploads/ and ^~ /api/ blocks into it too
sudo nginx -t && sudo systemctl reload nginx
curl -I https://app.uniquemarketing.in/uploads/logo/YOUR_FILE.jpeg
```

Also ensure directory is readable:

```bash
chmod -R a+rX /var/www/rndprojects/unique_ngo_dashboard/backend/uploads
```


```bash
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw enable
# Do NOT expose 3017 publicly
```
