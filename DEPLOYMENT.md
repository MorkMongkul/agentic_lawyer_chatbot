# Deployment Guide — AWS EC2 + Docker

This guide deploys the Niti legal chatbot to a single AWS EC2 instance using Docker.

## Architecture

```
  Browser
     │  HTTP (port 80)
     ▼
  EC2 instance ──────────────────────────────┐
   ┌─────────────┐        ┌─────────────────┐ │
   │ frontend    │        │ backend         │ │
   │ Nginx       │──/api─▶│ FastAPI+Uvicorn │ │
   │ React build │        │ FAISS + BM25    │ │
   │ port 80     │        │ port 8000       │ │
   └─────────────┘        └────────┬────────┘ │
└─────────────────────────────────┼───────────┘
            ┌──────────────────────┼───────────┐
            ▼                                  ▼
      Neon PostgreSQL              Google Vertex AI
      (external)                   (external)
```

---

## Prerequisites (one-time)

### 1. Create a Google Service Account key (for Vertex AI inside Docker)

Local `gcloud auth` does NOT work inside a container. Create a service account key:

1. GCP Console → **IAM & Admin → Service Accounts → Create Service Account**
2. Name: `niti-vertex` → **Create and Continue**
3. Grant role: **Vertex AI User** → **Done**
4. Click the account → **Keys → Add Key → Create new key → JSON → Create**
5. A JSON file downloads — rename it to `sa-key.json`

>  Never commit this key. It is already in `.gitignore` / `.dockerignore`.

### 2. Prepare the `.env` file

Create `.env` in the project root (same folder as `docker-compose.yml`):

```env
GOOGLE_CLOUD_PROJECT=gen-lang-client-0433481473
GOOGLE_CLOUD_LOCATION=us-central1
DATABASE_URL=postgresql://user:pass@ep-xxx.aws.neon.tech/neondb?sslmode=require

# Clerk authentication (same key in both — backend verifies, frontend build bakes it in)
CLERK_PUBLISHABLE_KEY=pk_test_xxxxx
VITE_CLERK_PUBLISHABLE_KEY=pk_test_xxxxx
```

> The `VITE_` key is consumed at **build time** by Vite (passed as a Docker
> build arg via `docker-compose.yml`), so you must rebuild the frontend image
> after changing it: `docker compose up -d --build`.

---

## Launch the EC2 Instance

1. AWS Console → **EC2 → Launch Instance**
2. **Name:** niti-server
3. **AMI:** Ubuntu Server 22.04 LTS
4. **Instance type:** `t3.small` (2 GB RAM — enough for FAISS)
5. **Key pair:** create or select one (for SSH)
6. **Security group** — allow inbound:
   - SSH (port 22) — your IP only
   - HTTP (port 80) — anywhere (0.0.0.0/0)
7. **Storage:** 20 GB gp3
8. **Launch**

---

## Install Docker on the Server

SSH in:

```bash
ssh -i your-key.pem ubuntu@<EC2-PUBLIC-IP>
```

Install Docker + Compose:

```bash
sudo apt update
sudo apt install -y docker.io docker-compose-v2 git
sudo usermod -aG docker ubuntu
# log out and back in so the group applies
exit
```

SSH back in.

---

## Deploy

```bash
# 1. Clone your repository
git clone <YOUR_REPO_URL> niti
cd niti

# 2. Upload the service account key and .env
#    (from your LOCAL machine, in a separate terminal):
#    scp -i your-key.pem sa-key.json ubuntu@<EC2-IP>:~/niti/backend/sa-key.json
#    scp -i your-key.pem .env       ubuntu@<EC2-IP>:~/niti/.env

# 3. Build and start
docker compose up -d --build

# 4. Check logs
docker compose logs -f
```

Visit `http://<EC2-PUBLIC-IP>` in your browser.

---

## Common Commands

```bash
docker compose ps              # status
docker compose logs -f backend # backend logs
docker compose restart         # restart all
docker compose down            # stop and remove
docker compose up -d --build   # rebuild after code changes
```

---

## Updating after code changes

```bash
git pull
docker compose up -d --build
```

---

## Cost (with $100 AWS credit)

| Item | Monthly |
|---|---|
| t3.small instance | ~$15 |
| 20 GB storage | ~$2 |
| Data transfer | ~$1–3 |
| **Total** | **~$18–20/month** |

$100 credit → roughly 5 months of uptime.

> Tip: **Stop** the instance when not demoing to save credit (`EC2 → Stop`).
> You only pay for storage while stopped (~$2/month).

---

## Optional — Add a domain + HTTPS

If you have a domain, point an A record to the EC2 IP, then add
Certbot/Let's Encrypt to the nginx container for free HTTPS. Not required
for the defense demo.
