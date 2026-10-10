# Docker + CI/CD deployment

This keeps the current VPS and PostgreSQL database, but replaces manual `git pull → build → pm2 restart` with:

```text
push to main → GitHub Actions verifies build → SSH to VPS → git pull → docker compose build/migrate/up
```

## One-time VPS setup

Install Docker:

```bash
sudo apt update
sudo apt install -y ca-certificates curl gnupg
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | sudo tee /etc/apt/sources.list.d/docker.list >/dev/null
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo usermod -aG docker deploy
```

Log out and log back in as `deploy`, then verify:

```bash
docker --version
docker compose version
```

## VPS env files

Keep the existing backend env:

```text
/var/www/rndprojects/unique_ngo_dashboard/backend/.env
```

Create the Docker frontend build env:

```bash
cd /var/www/rndprojects/unique_ngo_dashboard
cp .env.docker.example .env.docker
nano .env.docker
```

For production, this is usually enough:

```env
FRONTEND_PORT=8088
VITE_API_URL=/api/v1
VITE_API_ORIGIN=
```

Add Firebase public web values in `.env.docker` if the dashboard needs browser FCM.

## Nginx switch

The Docker frontend runs on `127.0.0.1:8088`; the API keeps port `3017`.

```bash
sudo cp /var/www/rndprojects/unique_ngo_dashboard/deploy/nginx/app.uniquemarketing.in.docker.conf \
  /etc/nginx/conf.d/app.uniquemarketing.in.conf
sudo nginx -t
sudo systemctl reload nginx
```

## First Docker cutover on VPS

Build the images while PM2 is still serving live traffic, then stop PM2 only when Docker is ready to take port `3017`.

```bash
cd /var/www/rndprojects/unique_ngo_dashboard
docker compose --env-file .env.docker -f docker-compose.prod.yml build
docker compose --env-file .env.docker -f docker-compose.prod.yml run --rm api npx prisma migrate deploy
pm2 stop unique-ngo-api
pm2 save
docker compose --env-file .env.docker -f docker-compose.prod.yml up -d
docker compose --env-file .env.docker -f docker-compose.prod.yml ps
```

Then switch nginx to the Docker config and reload it.

Safe nginx switch command:

```bash
sudo cp /etc/nginx/conf.d/app.uniquemarketing.in.conf \
  /etc/nginx/conf.d/app.uniquemarketing.in.conf.pm2-backup
sudo cp /var/www/rndprojects/unique_ngo_dashboard/deploy/nginx/app.uniquemarketing.in.docker.conf \
  /etc/nginx/conf.d/app.uniquemarketing.in.conf
sudo nginx -t
sudo systemctl reload nginx
```

## GitHub Actions secrets

Add these in GitHub repo → Settings → Secrets and variables → Actions:

```text
VPS_HOST=187.127.187.111
VPS_USER=deploy
VPS_PORT=22
VPS_DEPLOY_PATH=/var/www/rndprojects/unique_ngo_dashboard
VPS_SSH_KEY=<private SSH key that can log in as deploy>
```

The workflow deploys on pushes to `main`.

## Useful commands

```bash
docker compose --env-file .env.docker -f docker-compose.prod.yml logs -f api
docker compose --env-file .env.docker -f docker-compose.prod.yml logs -f web
docker compose --env-file .env.docker -f docker-compose.prod.yml restart api
docker compose --env-file .env.docker -f docker-compose.prod.yml ps
```
