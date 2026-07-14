# Deployment Guide — Hostinger VPS (App + Database)

Everything runs on **one Hostinger VPS**: Next.js app, PostgreSQL 16, Nginx, and
nightly backups. No Vercel. No Neon. Postgres is **not exposed to the internet**.

---

## Architecture

```
Internet ──HTTPS──▶ Nginx (:443)
                        │
                        ▼
                   Next.js app (:3000, internal)
                        │
            ┌───────────┴───────────┐
            ▼                       ▼
     PostgreSQL 16            /app/uploads
     (Docker volume)          (Docker volume)
            │                       │
            └──── nightly backup ───┘
                  (backups/)
```

| Service | Role |
|---|---|
| **postgres** | PostgreSQL 16, tuned for 2–4 GB RAM, internal network only |
| **migrate** | One-shot Prisma schema apply before app starts |
| **app** | Next.js standalone, health-checked, auto-restart |
| **nginx** | TLS, rate limiting, gzip, static caching |
| **backup** | Nightly `pg_dump` + uploads tar, 14-day retention |

---

## 1. VPS prerequisites

```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER   # re-login

# Firewall: SSH + web ONLY (Postgres port 5432 is NOT opened)
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable

sudo apt-get install -y fail2ban
```

Recommended Hostinger plan: **KVM VPS with at least 2 GB RAM** (4 GB preferred).

---

## 2. First-time setup (one command)

```bash
sudo mkdir -p /opt/az-erp && sudo chown $USER /opt/az-erp
cd /opt/az-erp
git clone <YOUR_REPO_URL> .

# Edit domain in nginx config first:
nano deploy/nginx/app.conf    # replace erp.azconsultants.com

# Auto-generates .env with strong DB + AUTH secrets, deploys, seeds data:
bash deploy/first-run.sh
```

This creates:
- PostgreSQL with a random password
- Database schema (all tables)
- Staff accounts (`managingdirector@azconsultants.com` / `azc@2026`)
- 588 document requirements from CSV

**Change all passwords immediately** after first login.

### Manual .env setup (alternative)

```bash
bash deploy/setup-env.sh
# or: cp .env.example .env && nano .env
```

`DATABASE_URL` must use hostname **`postgres`** (the Docker service name):

```
DATABASE_URL=postgresql://azc:YOUR_PASSWORD@postgres:5432/az_erp?schema=public
```

---

## 3. TLS certificate

```bash
docker compose --profile deploy up -d nginx

docker compose --profile certbot run --rm certbot certonly \
  --webroot -w /var/www/certbot \
  -d erp.azconsultants.com \
  --email admin@azconsultants.com --agree-tos --no-eff-email

docker compose --profile deploy restart nginx
```

Auto-renew (add to VPS crontab):

```
0 3 * * 1 cd /opt/az-erp && docker compose --profile certbot run --rm certbot renew && docker compose --profile deploy restart nginx
```

---

## 4. Deploy / update

```bash
bash deploy/deploy.sh
```

GitHub Actions auto-deploys on push to `main` (set secrets: `VPS_HOST`, `VPS_USER`, `VPS_SSH_KEY`, `VPS_APP_DIR`).

---

## 5. Cloudflare R2 (document uploads)

Student/counselor document **binaries** should live in a **private Cloudflare R2**
bucket. The Hostinger VPS still runs the app + Postgres; R2 only stores files.
Downloads and ZIP stay behind your logged-in API — objects are never public.

### 5.1 Create the bucket (Cloudflare dashboard)

1. Log in at [dash.cloudflare.com](https://dash.cloudflare.com)
2. Open **R2 Object Storage** (enable R2 if asked)
3. **Create bucket**
   - Name: e.g. `az-erp-documents`
   - Leave **public access OFF** (private)
4. Note your **Account ID** (R2 overview sidebar)

### 5.2 Create an API token

1. R2 → **Manage R2 API Tokens** → **Create API token**
2. Permissions: **Object Read & Write** on your bucket (or account-wide R2)
3. Copy **Access Key ID** and **Secret Access Key** immediately (secret shown once)

### 5.3 Put keys on the Hostinger VPS

```bash
cd /opt/az-erp
nano .env
```

Set (use your real values):

```
STORAGE_BACKEND=r2
R2_ACCOUNT_ID=your_account_id
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...
R2_BUCKET=az-erp-documents
```

Save, then redeploy the app so it picks up the new env:

```bash
bash deploy/deploy.sh
```

### 5.4 Verify

1. Log into `https://your-domain`
2. Upload a document on a student record
3. Open / download it — it should load from R2
4. In Cloudflare → R2 → your bucket → confirm the object appears under `documents/`

### Local PC vs Hostinger

| Environment | `STORAGE_BACKEND` |
|---|---|
| Your PC (`npm run dev` / local production) | `local` (default) |
| Hostinger VPS | `r2` |

Nightly VPS backups still dump Postgres + any leftover local `uploads/`.
Document files in R2 are durable in Cloudflare; enable **bucket versioning**
in the R2 UI if you want extra undo protection.

---

## 6. Operations

```bash
# Logs
docker compose logs -f app
docker compose logs -f postgres

# Health (public) and metrics (admin-only)
curl https://your-domain/api/health
curl -H "Cookie: ..." https://your-domain/api/metrics

# Connect to database directly (debugging)
docker compose exec postgres psql -U azc -d az_erp

# Manual backup
docker compose exec backup sh /usr/local/bin/backup.sh

# Restore
sh deploy/restore.sh db_YYYYMMDD_HHMMSS.sql.gz uploads_YYYYMMDD_HHMMSS.tar.gz

# Check disk usage (DB + uploads grow over time)
docker system df
du -sh backups/
```

---

## 7. Security checklist

- [ ] `POSTGRES_PASSWORD` and `AUTH_SECRET` are strong random values (`setup-env.sh` does this)
- [ ] Port **5432 is NOT** in UFW (Postgres is Docker-internal only)
- [ ] TLS certificate issued and auto-renewing
- [ ] Nightly backups verified (run restore test once)
- [ ] Staff passwords changed from defaults
- [ ] `.env` never committed (see `.gitignore`)
- [ ] Cloudflare R2 bucket is private; `STORAGE_BACKEND=r2` on VPS with restricted API token

---

## Resource guide (RAM)

| VPS RAM | Recommendation |
|---|---|
| 2 GB | Works; set `NEXT_BUILD_CPUS=1` during builds |
| 4 GB | Comfortable for app + Postgres + nginx |
| 8 GB+ | Room for growth; increase `shared_buffers` in `deploy/postgres/postgresql.conf` |
