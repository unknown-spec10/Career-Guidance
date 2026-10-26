# GCP Demo Bring-Up (e2-small, cost-optimized)

Backend-only demo VM. The frontend stays on Vercel (`frontend/vercel.json`
handles SPA rewrites); this VM serves the FastAPI backend **behind Caddy on
HTTPS** at `https://deepsync.duckdns.org`. Port `8000` is published on the
loopback interface only (SSH-tunnel debugging), never publicly.

**Secrets model (firm):** the VM keeps **no `.env` file**. Non-secret runtime
config lives in the `deploy/gcp/user-data.sh` config block and is exported to
`docker compose`; every app credential is fetched **inside the container at
startup** from Google Secret Manager by `resume_pipeline/docker-entrypoint.py`.
The DuckDNS token is the one exception: the **startup script** reads
`DUCKDNS_TOKEN` from Secret Manager into memory on every boot (never to disk or
logs) to refresh the hostname before the containers start. See §6.

## 1. Console click path (one-time create)

`GCE Console > Compute Engine > VM instances > Create instance`:

| Field | Value |
|---|---|
| Name | `career-guidance-demo` (any) |
| Region / zone | `us-central1 (Iowa)` / `us-central1-a` |
| Machine type | `E2` series, `e2-small` (2 vCPU, 2 GB memory) |
| Boot disk | `Ubuntu 22.04 LTS`, `30 GB`, `Standard persistent disk (pd-standard)` |
| Networking > Network tags | `http-server`, `https-server` |
| Networking > External IPv4 | `Ephemeral` (default; DNS follows it automatically — §2) |
| Advanced options > Automation > Startup script | Paste contents of `deploy/gcp/user-data.sh` |
| Firewall checkboxes | Tick `Allow HTTP traffic` + `Allow HTTPS traffic` |

Before first boot, edit the top of `deploy/gcp/user-data.sh`:
`REPO_URL`, `GCP_PROJECT`, `DOCKER_HUB_USERNAME` (PLACEHOLDER values abort the
boot loudly), `DUCKDNS_SUBDOMAIN`, plus the non-secret `PG_HOST` / `PG_USER` /
`CORS_ORIGINS` / `FRONTEND_URL` block. **Do not create a `.env` on the VM** —
the script has no `--env-file` path and the container is configured by Secret
Manager (§6).

### 1a. Firewall: publish 80 + 443 (required for TLS)

Caddy needs **tcp:80** (ACME HTTP-01 challenge + HTTP→HTTPS redirect) and
**tcp:443** (public API). Both rules target the network tags from §1. Do **not**
add a public rule for `8000` — it is loopback-only in `docker-compose.yml`.

```bash
PROJECT=<your-gcp-project>

# Check first: the default VPC usually ships default-allow-http /
# default-allow-https rules targeting the same tags. If both are present
# with source 0.0.0.0/0, skip the two create commands below.
gcloud compute firewall-rules list --project="$PROJECT" \
  --filter="name~allow-http OR name~allow-https" \
  --format="table(name,allowed[].map().firewall_rule().list():label=ALLOW,sourceRanges.list():label=SRC_RANGES,targetTags.list():label=TARGETS)"

# Otherwise create them explicitly:
gcloud compute firewall-rules create career-guidance-allow-http \
  --project="$PROJECT" --direction=INGRESS --action=ALLOW \
  --rules=tcp:80 --source-ranges=0.0.0.0/0 --target-tags=http-server

gcloud compute firewall-rules create career-guidance-allow-https \
  --project="$PROJECT" --direction=INGRESS --action=ALLOW \
  --rules=tcp:443 --source-ranges=0.0.0.0/0 --target-tags=https-server
```

UDP/443 (HTTP/3) is intentionally not published; browsers fall back to
HTTPS-over-TCP without it.

## 2. DNS with an ephemeral IP (DuckDNS auto-update)

The VM has an **ephemeral** external IP, so the address changes on every
stop/start. `deploy/gcp/user-data.sh` §5b fixes the hostname automatically on
each boot:

1. reads `DUCKDNS_TOKEN` from Secret Manager (memory only, never logged or
   written to disk);
2. calls `https://www.duckdns.org/update?domains=<subdomain>&token=<token>` with
   **no `ip=` parameter**, so DuckDNS records the caller's public address;
3. waits for `deepsync.duckdns.org` to resolve to the VM's current external IP
   (metadata server) before starting the containers;
4. on failure, logs a loud `WARNING` but **does not abort the boot** — the API
   still comes up on `localhost:8000`, and Caddy retries certificate issuance
   once DNS propagates.

DuckDNS TTL is 60 s, so a restart can take up to a minute to be visible
globally. Because the hostname is stable:

- `VITE_API_URL` no longer changes when the IP changes;
- `BACKEND_URL` is always `https://deepsync.duckdns.org` (Google OAuth
  redirect URIs stay valid);
- a static IP is **optional**. Reserve one only if you also want a stable
  numeric address (~$0.01/hr even while stopped).

## 3. Start / stop (cost discipline)

Stop the VM between demos — stopped VMs are not billed for vCPU/RAM.

```bash
# From your laptop (replace PROJECT + ZONE as needed):
gcloud compute instances stop career-guidance-demo --zone=us-central1-a
gcloud compute instances start career-guidance-demo --zone=us-central1-a

# On the VM (repo root /opt/career-guidance), non-secret config exported by
# the startup script — no --env-file and no local .env:
docker compose -f docker-compose.yml pull       # prebuilt Hub image only — never --build on the VM
docker compose -f docker-compose.yml up -d      # entrypoint loads secrets; Caddy starts alongside
docker logs -f career-guidance-backend          # API logs (secrets are never logged)
docker logs -f career-guidance-caddy            # ACME/TLS + proxy logs
curl -fsS https://deepsync.duckdns.org/health   # public TLS healthcheck
curl -fsS http://localhost:8000/health          # loopback-only backend check
```

If you start the VM by hand (SSH session, startup script already ran once),
re-export the same non-secret values first (Caddy also needs the DNS record to
already point at this VM):

```bash
export GCP_PROJECT=<your-gcp-project> DOCKER_HUB_USERNAME=<your-dockerhub-user> \
       APP_ENV=production PG_HOST=<pooler-host> PG_PORT=5432 \
       PG_USER=<pooler-user> PG_DB=postgres DUCKDNS_SUBDOMAIN=deepsync \
       CORS_ORIGINS=https://career-guidance-flame.vercel.app,https://deepsync.duckdns.org \
       FRONTEND_URL=https://career-guidance-flame.vercel.app \
       BACKEND_URL=https://deepsync.duckdns.org
cd /opt/career-guidance && docker compose up -d
```

Build the image on your laptop (or CI) and push it before touching the VM:

```bash
./deploy/docker/build-and-push.sh <DOCKER_HUB_USERNAME> [tag]
```

## 4. Warm-up checklist (before a judged demo)

Cold starts are slow on 2 GB — do this ~5 min before presenting:

1. `curl https://deepsync.duckdns.org/health` returns 200 (first boot after a
   DNS change may need up to ~60 s for the certificate).
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
- Let's Encrypt certificates via Caddy: $0.

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

`DUCKDNS_TOKEN` is **not** loaded into the container. The VM startup script
reads it directly (gcloud, in memory) to refresh DNS before compose starts
(§2).

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
| `DUCKDNS_TOKEN` | no | DuckDNS API token — read by `user-data.sh` only (DNS/TLS degrades without it) |

Non-secret config (`PG_HOST`, `PG_PORT`, `PG_USER`, `PG_DB`, `APP_ENV`,
`DUCKDNS_SUBDOMAIN`, `PUBLIC_HOSTNAME`, `CORS_ORIGINS`, `FRONTEND_URL`,
`BACKEND_URL`, `GOOGLE_CLIENT_ID`, `GMAIL_USER`, `STORAGE_BACKEND`,
`GCS_BUCKET_NAME`, `GCS_PROJECT_ID`) is exported by `deploy/gcp/user-data.sh`;
it is not sensitive and does not belong in Secret Manager.

### 6b. Create the secrets (once, from your laptop)

```bash
PROJECT=<your-gcp-project>

# Required four — use `--data-file=-` so values never touch shell history.
printf '%s' '<db-password>'      | gcloud secrets create PG_PASSWORD      --project="$PROJECT" --replication-policy=automatic --data-file=-
printf '%s' "$(openssl rand -hex 32)" | gcloud secrets create SECRET_KEY  --project="$PROJECT" --replication-policy=automatic --data-file=-
printf '%s' '<admin@example.com>' | gcloud secrets create ADMIN_EMAIL     --project="$PROJECT" --replication-policy=automatic --data-file=-
printf '%s' '<admin-password>'    | gcloud secrets create ADMIN_PASSWORD  --project="$PROJECT" --replication-policy=automatic --data-file=-

# DuckDNS token (public TLS + boot DNS updater). Paste from
# https://www.duckdns.org/ (account page). Never put it in `.env` or the repo.
printf '%s' '<duckdns-token>' | gcloud secrets create DUCKDNS_TOKEN \
  --project="$PROJECT" --replication-policy=automatic --data-file=-

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
         GOOGLE_CLIENT_SECRET YOUTUBE_DATA_API_KEY GMAIL_APP_PASSWORD \
         DUCKDNS_TOKEN; do
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

# Confirm the boot DNS updater ran (token is never printed):
sudo journalctl -u google-startup-scripts -b --no-pager | grep -i duckdns
getent hosts deepsync.duckdns.org          # should show this VM's external IP
curl -fsS https://deepsync.duckdns.org/health
```

Failing loudly looks like:

```
[entrypoint] FATAL: required Secret Manager secret(s) missing or empty:
projects/<project>/secrets/SECRET_KEY/versions/latest — create them with ...
```

TLS failing while the backend is healthy looks like:

```
[startup-script] WARNING: https://deepsync.duckdns.org/health not reachable yet
```

Check, in order: `DUCKDNS_TOKEN` exists and the VM SA can read it; DNS resolves
to the current external IP; firewall allows tcp:80 and tcp:443; then
`docker logs career-guidance-caddy` for ACME errors. Caddy retries issuance on
its own with backoff; if it has been failing for a long while, nudge it with
`docker compose restart caddy`.

### 6e. Drift rule

If you add a new `Settings` field in `resume_pipeline/resume_pipeline/config.py`:
add the same key to the root `.env.example` (blank + comment), to the
`environment:` whitelist in root `docker-compose.yml`, and — only if it is a
credential — to `REQUIRED_SECRETS`/`OPTIONAL_SECRETS` in
`resume_pipeline/docker-entrypoint.py` plus the table in §6a. If the VM
startup script itself needs it, add it to `deploy/gcp/user-data.sh` as well
(as `DUCKDNS_TOKEN` is).

## 7. Vercel frontend env (documented list)

The SPA is built on Vercel (`frontend/`), not on the VM. Set these in
`Vercel > Project > Settings > Environment Variables` for **Production** (and
Preview if you use it):

| Variable | Value | Notes |
|---|---|---|
| `VITE_API_URL` | `https://deepsync.duckdns.org` | Stable hostname; no port, no IP churn |
| `VITE_API_BASE_URL` | `https://deepsync.duckdns.org` | Optional; wins over `VITE_API_URL` in `src/config/api.js` when both are set |

`NODE_ENV` / build settings stay at Vercel defaults (`npm run build`, output
`dist`, rewrites from `frontend/vercel.json`). No other `VITE_*` variables are
read by the app — grep `import.meta.env` before adding one. Local development
needs neither variable: Vite proxies `/api` to `http://localhost:8000`.

**Redeploy the frontend after changing either variable** — Vite inlines them at
build time.

## 8. Manual operator steps that remain

These cannot be automated by the startup script:

1. **Create `DUCKDNS_TOKEN`** in Secret Manager (§6b) and let the boot IAM loop
   (or §6c) grant the VM SA access. The token exists only there — never in
   `.env`, the repo, or the VM filesystem.
2. **Firewall 80/443** (§1a) and the `http-server` / `https-server` network
   tags on the VM.
3. **Vercel**: set `VITE_API_URL` (and optionally `VITE_API_BASE_URL`) to
   `https://deepsync.duckdns.org`, then redeploy Production (§7).
4. **Google OAuth** (`Google Cloud Console > APIs & Services > Credentials >
   OAuth 2.0 Client IDs`):
   - Authorized redirect URI: `https://deepsync.duckdns.org/api/auth/google/callback`
     (this is exactly `BACKEND_URL` + `/api/auth/google/callback`; Google
     rejects plain-HTTP redirect URIs for non-localhost hosts).
   - Authorized JavaScript origin: `https://career-guidance-flame.vercel.app`.
   - Keep the local dev redirect (`http://localhost:8000/api/auth/google/callback`)
     if you develop OAuth locally.
   - `GOOGLE_CLIENT_ID` stays in `deploy/gcp/user-data.sh`;
     `GOOGLE_CLIENT_SECRET` stays in Secret Manager.
5. **First certificate issuance**: after DNS + firewall are correct, confirm
   `curl -I https://deepsync.duckdns.org` succeeds. Caddy stores certs in the
   `caddy_data` compose volume; `docker compose down -v` deletes them and forces
   re-issuance.
