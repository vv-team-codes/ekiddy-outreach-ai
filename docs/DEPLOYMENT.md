# Ekiddy Outreach AI — Production Deployment & Backup Guide

## 1. Prerequisites
- Linux VPS (Ubuntu 22.04+ / Debian 12+) with Docker Engine & Docker Compose plugin.
- DNS `A` record pointing `app.ekiddy.com` to your VPS public IP.
- MongoDB Atlas cluster URI (set in `MONGODB_URI`).

## 2. Environment Configuration
1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```
2. Set strong production secrets:
   - `JWT_SECRET` (64+ random characters)
   - `ENCRYPTION_KEY` (32+ random characters for AES-256-GCM integration storage)
   - `MONGODB_URI` (MongoDB Atlas SRV connection string)
   - `GEMINI_API_KEY` / `OPENROUTER_API_KEY`
   - `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`
   - `EMAIL_PROVIDER_API_KEY` (Resend) or SMTP credentials + `EMAIL_WEBHOOK_SECRET`
   - `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI=https://app.ekiddy.com/api/integrations/google-calendar/callback`

## 3. Build & Start Services
```bash
docker compose up -d --build
```
Check health:
```bash
docker compose ps
curl -f https://app.ekiddy.com/api/health
```

## 4. Logging & Monitoring
- Backend emits structured Pino JSON logs (`docker compose logs -f backend worker`).
- Caddy emits structured JSON access logs (`docker compose logs -f caddy`).

## 5. Backup & Restore Procedures
### MongoDB Atlas Backups
Enable Continuous Cloud Backup in MongoDB Atlas or run scheduled `mongodump`:
```bash
mongodump --uri="$MONGODB_URI" --archive="/backups/ekiddy-$(date +%F).gz" --gzip
```
Restore from backup:
```bash
mongorestore --uri="$MONGODB_URI" --archive="/backups/ekiddy-YYYY-MM-DD.gz" --gzip
```

### Redis Persistence
`docker-compose.yml` configures Redis AOF (`--appendonly yes`) backed by the `redis_data` Docker volume. Back up `/var/lib/docker/volumes/*_redis_data/_data` during maintenance windows if long-running delayed jobs exist.
