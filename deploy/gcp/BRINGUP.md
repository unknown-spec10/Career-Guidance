# GCP Demo Bring-Up (e2-small, cost-optimized)

Backend-only demo VM. Frontend stays on Vercel (`frontend/vercel.json` handles SPA
rewrites); this VM serves the FastAPI backend on port 8000.

**Secrets model (firm):** the VM keeps **no `.env` file**. Non-secret runtime
config lives in the `deploy/gcp/user-data.sh` config block and is exported to
`docker compose`; every credential is fetched **inside the container at startup**
from Google Secret Manager by `resume_pipeline/docker-entrypoint.py`. See §6.

## 1. Console click path (one-time create)

`GCE Console > Compute Engine > VM instances > Create instance`:

| Field | Value |
|---|---|
| Name | `career-guidance-demo` (any) |
| Region / zone | `us-central1 (Iowa)` / `us-central1-a` |
| Machine type | `E2` series, `e2-small` (2 vCPU, 2 GB memory) |
| Boot disk | `Ubuntu 22.04 LTS`, `30 GB`, `Standard persistent disk (pd-standard)` |
| Networking > Network tags | `http-server`, `https-server` (enables default 80/443 firewall rules) |
| Networking > External IPv4 | `Ephemeral` (default; see §2) |
| Advanced options > Automation > Startup script | Paste contents of `deploy/gcp/user-data.sh` |
| Firewall checkboxes | Tick `Allow HTTP traffic` + `Allow HTTPS traffic` |

Create, then add one extra VPC firewall rule for the API
(`VPC network > Firewall > Create`): allow `tcp:8000`, target tags
`http-server`, source `0.0.0.0/0` — or front with your own reverse proxy.

Before first boot, edit the top of `deploy/gcp/user-data.sh`:
`REPO_URL`, `GCP_PROJECT`, `DOCKER_HUB_USERNAME` (PLACEHOLDER values abort the
boot loudly), plus the non-secret `PG_HOST` / `PG_USER` / `CORS_ORIGINS` /
`FRONTEND_URL` block. **Do not create a `.env` on the VM** — the script has no
`--env-file` path and the container is configured by Secret Manager (§6).

## 2. Static vs ephemeral IP

- **Ephemeral (default, recommended for demo):** free, but the external IP
  changes on every stop/start. After each start, re-check the IP in
  `VM instances` and update `VITE_API_URL` on Vercel if it changed.
- **Static:** survives stop/start (no Vercel re-config), but costs ~$0.01/hr
  even while the VM is stopped. Only reserve one if judges hit a fixed URL.

## 3. Start / stop (cost discipline)

Stop the VM between demos — stopped VMs are not billed for vCPU/RAM.

```bash
# From your laptop (replace PROJECT + ZONE as needed):
gcloud compute instances stop career-guidance-demo --zone=us-central1-a
gcloud compute instances start career-guidance-demo --zone=us-central1-a

# On the VM (repo root /opt/career-guidance), non-secret config exported by
# the startup script — no --env-file and no local .env:
docker compose -f docker-compose.yml pull       # prebuilt Hub image only — never --build on the VM
docker compose -f docker-compose.yml up -d      # entrypoint loads secrets, starts backend
docker logs -f career-guidance-backend          # tail logs (secrets are never logged)
curl -fsS http://localhost:8000/health          # healthcheck
```

If you start the VM by hand (SSH session, startup script already ran once),
re-export the same non-secret values first:

```bash
export GCP_PROJECT=<your-gcp-project> DOCKER_HUB_USERNAME=<your-dockerhub-user> \
       APP_ENV=production PG_HOST=<pooler-host> PG_PORT=5432 \
       PG_USER=<pooler-user> PG_DB=postgres \
       CORS_ORIGINS=https://<app>.vercel.app FRONTEND_URL=https://<app>.vercel.app \
       BACKEND_URL=http://<vm-ip>:8000
cd /opt/career-guidance && docker compose up -d
```

Build the image on your laptop (or CI) and push it before touching the VM:

```bash
./deploy/docker/build-and-push.sh <DOCKER_HUB_USERNAME> [tag]
```

## 4. Warm-up checklist (before a judged demo)

Cold starts are slow on 2 GB — do this ~5 min before presenting:

1. `curl http://<VM-IP>:8000/health` returns 200.
2. Hit the student dashboard once (lazy-loads auth/profile queries).
3. Hit Jobs list once (warms Supabase pooler connections + recommendation cache).
4. Do **NOT** run simultaneous resume uploads during the demo — parse + OCR
   spikes RAM on e2-small and can OOM the single worker. One upload at a time.
5. Keep `RAG_PRELOAD_ON_STARTUP=false` (default in the single root compose); first RAG answer
   is slow, subsequent ones are warm — fire one test question privately first.

## 5. Cost note

- **Stopped:** ≈ $0/hr for the VM (only the 30 GB pd-standard disk bills,
  ≈ $1.20/mo). Release any static IP or it keeps billing.
- **Running:** e2-small ≈ **~$0.02/hr** on-demand in us-central1
  (≈ $13–17/mo if left on 24/7 — don't; stop/start between demos).
- Supabase free tier + Vercel hobby tier: $0 at demo scale.

## 6. Secrets: Secret Manager only (no `.env` on the VM)

The image contains **no secrets** and the VM keeps **no `.env`**. At container
start, `resume_pipeline/docker-entrypoint.py`:

1. reads `GCP_PROJECT` from the compose environment;
2. if it is unset → `exec`s uvicorn unchanged (this is the local-dev path:
   `docker compose --env-file .env up` still works exactly as before);
3. if it is set → reads each secret below from
   `projects/$GCP_PROJECT/secrets/<NAME>/versions/latest` using the VM service
   account (Application Default Credentials), exports it into the process
   environment, then `exec`s uvicorn;
4. aborts **loudly, naming the exact secret path**, when a required secret is
   missing/empty or permission is denied. No silent defaults.

### 6a. Secret names (documented contract)

Secret name = environment variable name, so the mapping is one-to-one.

| Secret | Required at boot | Purpose |
|---|---|---|
| `PG_PASSWORD` | yes | PostgreSQL / Supabase pooler password |
| `SECRET_KEY` | yes | JWT signing key (≥ 32 chars) |
| `ADMIN_EMAIL` | yes | Admin seed identity (verified admin user) |
| `ADMIN_PASSWORD` | yes | Admin seed password (bcrypt-hashed at seed time) |
| `OPENCODE_API_KEY` | no | Chat/explanation LLM (empty until pasted) |
| `GROQ_API_KEY` | no | Whisper STT |
| `GOOGLE_API_KEY` | no | Google Search API (taxonomy builder) |
| `GOOGLE_SEARCH_API_KEY` | no | Legacy alias accepted by `config.py` |
| `GOOGLE_CLIENT_SECRET` | no | Google OAuth |
| `YOUTUBE_DATA_API_KEY` | no | Learning-path video discovery |
| `GMAIL_APP_PASSWORD` | no | Gmail SMTP verification mail |

Non-secret config (`PG_HOST`, `PG_PORT`, `PG_USER`, `PG_DB`, `APP_ENV`,
`CORS_ORIGINS`, `FRONTEND_URL`, `BACKEND_URL`, `GOOGLE_CLIENT_ID`, `GMAIL_USER`,
`STORAGE_BACKEND`, `GCS_BUCKET_NAME`, `GCS_PROJECT_ID`) is exported by
`deploy/gcp/user-data.sh`; it is not sensitive and does not belong in Secret
Manager.

### 6b. Create the secrets (once, from your laptop)

```bash
PROJECT=<your-gcp-project>

# Required four — use `--data-file=-` so values never touch shell history.
printf '%s' '<db-password>'      | gcloud secrets create PG_PASSWORD      --project="$PROJECT" --replication-policy=automatic --data-file=-
printf '%s' "$(openssl rand -hex 32)" | gcloud secrets create SECRET_KEY  --project="$PROJECT" --replication-policy=automatic --data-file=-
printf '%s' '<admin@example.com>' | gcloud secrets create ADMIN_EMAIL     --project="$PROJECT" --replication-policy=automatic --data-file=-
printf '%s' '<admin-password>'    | gcloud secrets create ADMIN_PASSWORD  --project="$PROJECT" --replication-policy=automatic --data-file=-

# Optional feature keys — create only when you have the value to paste.
# LLM/search keys may stay absent; the entrypoint leaves them empty.
for s in OPENCODE_API_KEY GROQ_API_KEY GOOGLE_API_KEY GOOGLE_SEARCH_API_KEY \
         GOOGLE_CLIENT_SECRET YOUTUBE_DATA_API_KEY GMAIL_APP_PASSWORD; do
  read -r -s -p "paste $s (blank = skip): " val; echo
  [[ -n "$val" ]] && printf '%s' "$val" \
    | gcloud secrets create "$s" --project="$PROJECT" --replication-policy=automatic --data-file=-
  unset val
done

# Rotate later:
#   printf '%s' '<new-value>' | gcloud secrets versions add <NAME> --project="$PROJECT" --data-file=-
```

### 6c. Grant the VM service account `secretAccessor` (exactly these secrets)

`deploy/gcp/user-data.sh` attempts this on every boot (idempotent) and prints
the single command to run manually if the VM identity lacks IAM rights. The
equivalent one-time command from your laptop:

```bash
PROJECT=<your-gcp-project>
SA=<vm-service-account-email>   # e.g. 123456789012-compute@developer.gserviceaccount.com
# VM console shows it, or: gcloud compute instances describe career-guidance-demo \
#   --zone=us-central1-a --format='value(serviceAccounts[0].email)'

for s in PG_PASSWORD SECRET_KEY ADMIN_EMAIL ADMIN_PASSWORD \
         OPENCODE_API_KEY GROQ_API_KEY GOOGLE_API_KEY GOOGLE_SEARCH_API_KEY \
         GOOGLE_CLIENT_SECRET YOUTUBE_DATA_API_KEY GMAIL_APP_PASSWORD; do
  gcloud secrets describe "$s" --project="$PROJECT" >/dev/null 2>&1 || continue
  gcloud secrets add-iam-policy-binding "$s" --project="$PROJECT" \
    --member="serviceAccount:${SA}" \
    --role="roles/secretmanager.secretAccessor" --quiet
done
```

Least privilege: grant the role per secret (above) — do not grant project-wide
`roles/secretmanager.secretAccessor`. The VM also needs read access to the GCS
bucket only if `STORAGE_BACKEND=gcs`.

### 6d. No-`.env` startup sequence (verify)

```bash
# On the VM — must NOT exist:
test ! -e /opt/career-guidance/.env && echo "OK no .env on VM"

# Reboot / restart and confirm the entrypoint loaded the required secrets.
sudo docker logs career-guidance-backend 2>&1 | grep -E '^\[entrypoint\]'
# Expect: "GCP_PROJECT=<project> — loading secrets from Secret Manager."
#         "loaded 4 required secret(s) ..."  (no secret values are printed)

curl -fsS http://localhost:8000/health
```

Failing loudly looks like:

```
[entrypoint] FATAL: required Secret Manager secret(s) missing or empty:
projects/<project>/secrets/SECRET_KEY/versions/latest — create them with ...
```

### 6e. Drift rule

If you add a new `Settings` field in `resume_pipeline/resume_pipeline/config.py`:
add the same key to the root `.env.example` (blank + comment), to the
`environment:` whitelist in root `docker-compose.yml`, and — only if it is a
credential — to `REQUIRED_SECRETS`/`OPTIONAL_SECRETS` in
`resume_pipeline/docker-entrypoint.py` plus the table in §6a.

## 7. Vercel frontend env (documented list)

The SPA is built on Vercel (`frontend/`), not on the VM. Set these in
`Vercel > Project > Settings > Environment Variables` for **Production** (and
Preview if you use it):

| Variable | Value | Notes |
|---|---|---|
| `VITE_API_URL` | `http://<vm-external-ip>:8000` | Backend origin; changes when an ephemeral IP is reassigned (§2) |
| `VITE_API_BASE_URL` | `http://<vm-external-ip>:8000` | Optional; wins over `VITE_API_URL` in `src/config/api.js` when both are set |

`NODE_ENV` / build settings stay at Vercel defaults (`npm run build`, output
`dist`, rewrites from `frontend/vercel.json`). No other `VITE_*` variables are
read by the app — grep `import.meta.env` before adding one. Local development
needs neither variable: Vite proxies `/api` to `http://localhost:8000`.
