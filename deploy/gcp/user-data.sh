#!/bin/bash
# GCE startup script for the Career Guidance GCP demo VM.
# Paste into: GCE Console > Create instance > Advanced options > Automation > Startup script,
# or: gcloud compute instances create ... --metadata-from-file=startup-script=deploy/gcp/user-data.sh
#
# Target: e2-small (2 vCPU, 2 GB), us-central1-a, Ubuntu 22.04 LTS,
#         30 GB pd-standard boot disk, ephemeral external IP,
#         network tags http-server/https-server.
#
# SECRETS MODEL (firm): the VM keeps NO local .env file. Non-secret runtime
# config is exported below and consumed by docker compose interpolation; app
# credentials are fetched inside the container at startup from GCP Secret
# Manager by resume_pipeline/docker-entrypoint.py (GCP_PROJECT is set). The
# DuckDNS token is the one exception read by THIS script (§5b), into memory
# only, to refresh the hostname before the containers boot.
# See deploy/gcp/BRINGUP.md §6.
set -euo pipefail

APP_DIR="/opt/career-guidance"
# >>> REQUIRED: fill these three before first boot.
# The script aborts (non-zero exit) while any PLACEHOLDER value remains.
REPO_URL="https://github.com/unknown-spec10/Career-Guidance.git"
GCP_PROJECT="gen-lang-client-0977081292"
DOCKER_HUB_USERNAME="deepdocker2023"
# Public hostname served by Caddy (deepsync.duckdns.org). Keep in sync with the
# site address in deploy/gcp/Caddyfile. The DuckDNS token is NEVER set here: it
# lives only in Secret Manager as DUCKDNS_TOKEN and is read in §5b.
DUCKDNS_SUBDOMAIN="deepsync"

# ---------------------------------------------------------------------------
# NON-SECRET runtime config (exported; compose `${VAR:-}` interpolation reads it).
# Edit once per environment. No credentials here — secrets come from Secret
# Manager inside the container (PG_PASSWORD, SECRET_KEY, ADMIN_EMAIL,
# ADMIN_PASSWORD + optional API keys; see BRINGUP.md §6a).
# ---------------------------------------------------------------------------
export GCP_PROJECT
export DOCKER_HUB_USERNAME
export APP_ENV="production"
# PostgreSQL / Supabase pooler parts (password is a Secret Manager secret).
export PG_HOST="aws-1-ap-northeast-2.pooler.supabase.com"  # Supabase pooler host
export PG_PORT="5432"
export PG_USER="postgres.nzmgknwblgeiijxgtobx"  # pooler user for this project
export PG_DB="postgres"
# Public URLs. The frontend stays on Vercel; the API is served over TLS at the
# DuckDNS hostname (refreshed every boot in §5b, terminated by Caddy in
# docker-compose.yml). No port suffix: Caddy owns 443.
export FRONTEND_URL="https://career-guidance-flame.vercel.app"
export PUBLIC_HOSTNAME="${DUCKDNS_SUBDOMAIN}.duckdns.org"
export BACKEND_URL="https://${PUBLIC_HOSTNAME}"
export CORS_ORIGINS="https://career-guidance-flame.vercel.app,https://${PUBLIC_HOSTNAME}"
export GOOGLE_CLIENT_ID="803645689505-51sumkplnjfavvdhj2tettptakt828on.apps.googleusercontent.com"  # OAuth client id (public identifier, not a secret)
export GOOGLE_SEARCH_ENGINE_ID="957a8463ab6f24e38"  # Custom Search engine id (public identifier)
export GMAIL_USER=""              # sender address (identifier; app password is a secret)
# Storage (local by default; gcs + bucket when using Cloud Storage).
export STORAGE_BACKEND="local"
export GCS_BUCKET_NAME="mine-career-guidance-bucket"
export GCS_PROJECT_ID=""
# LLM transport: the OPENCODE_API_KEY secret is an OpenCode Go subscription
# key — it only works against the Go gateway (402 on pay-as-you-go zen/v1).
# The adapter also sends x-opencode-session + a product user-agent (required
# by the Go gateway; see resume_pipeline/core/llm_router.py OpenCodeAdapter).
export OPENCODE_API_BASE_URL="https://opencode.ai/inference/go/v1"
# Go gateway models reason before answering and can exhaust the token budget
# on reasoning_content (empty content -> offline fallback). Skip reasoning.
export OPENCODE_DISABLE_REASONING="true"
# RAG stays lazy on 2 GB boxes.
export RAG_PRELOAD_ON_STARTUP="false"

# Documented Secret Manager secret names (env-var name == secret name).
# Required at boot: the entrypoint aborts naming any that are missing/empty.
REQUIRED_SECRETS=(PG_PASSWORD SECRET_KEY ADMIN_EMAIL ADMIN_PASSWORD)
# Optional feature keys (create later when you paste the values; absent = empty).
# DUCKDNS_TOKEN is read by THIS script at boot (§5b) — never by the container —
# and is included here only so the VM service account gets read access to it.
OPTIONAL_SECRETS=(OPENCODE_API_KEY GROQ_API_KEY GOOGLE_API_KEY GOOGLE_SEARCH_API_KEY \
                  GOOGLE_CLIENT_SECRET YOUTUBE_DATA_API_KEY GMAIL_APP_PASSWORD \
                  DUCKDNS_TOKEN)

log() { echo "[startup-script] $*"; }
fail() { log "FATAL: $*"; exit 1; }

# --- 0a. One-shot sudo repair (idempotent; validates before install) ---
# Repairs a stale google-sudoers membership by granting this VM's owner an
# explicit NOPASSWD rule. Safe to keep on every boot.
if id deeppodder57 >/dev/null 2>&1; then
    printf '%s\n' 'deeppodder57 ALL=(ALL) NOPASSWD:ALL' > /etc/sudoers.d/90-deeppodder57
    chmod 0440 /etc/sudoers.d/90-deeppodder57
    if visudo -cf /etc/sudoers.d/90-deeppodder57 2>/dev/null; then
        log "sudo repair rule installed for deeppodder57"
    else
        log "sudo repair rule failed validation, removed"
        rm -f /etc/sudoers.d/90-deeppodder57
    fi
fi

# --- 0. Preflight: refuse to boot with template values ---
for pair in "REPO_URL:${REPO_URL}" "GCP_PROJECT:${GCP_PROJECT}" \
            "DOCKER_HUB_USERNAME:${DOCKER_HUB_USERNAME}"; do
  name="${pair%%:*}"; value="${pair#*:}"
  if [[ "${value}" == *PLACEHOLDER* ]]; then
    fail "${name} still contains a PLACEHOLDER value — edit deploy/gcp/user-data.sh before boot."
  fi
done
if [[ -z "${PG_HOST}" || -z "${PG_USER}" ]]; then
  fail "PG_HOST / PG_USER are empty — set the non-secret DB config block in deploy/gcp/user-data.sh."
fi
if [[ -z "${DUCKDNS_SUBDOMAIN}" ]]; then
  fail "DUCKDNS_SUBDOMAIN is empty — set it in deploy/gcp/user-data.sh (must match deploy/gcp/Caddyfile)."
fi
command -v gcloud >/dev/null 2>&1 || fail "gcloud CLI not found — required for Secret Manager IAM binding."

# --- 1. Base packages + Docker + compose plugin ---
log "Installing Docker..."
apt-get update -y
apt-get install -y --no-install-recommends ca-certificates curl git jq
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
chmod a+r /etc/apt/keyrings/docker.asc
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "${UBUNTU_CODENAME:-$VERSION_CODENAME}") stable" \
  | tee /etc/apt/sources.list.d/docker.list > /dev/null
apt-get update -y
apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
systemctl enable --now docker

# --- 2. 1 GB swap file as OOM insurance on the 2 GB e2-small ---
if ! swapon --show | grep -q "/swapfile"; then
  log "Creating 1 GB swap file..."
  fallocate -l 1G /swapfile || dd if=/dev/zero of=/swapfile bs=1M count=1024
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  grep -q "/swapfile" /etc/fstab || echo "/swapfile none swap sw 0 0" >> /etc/fstab
  sysctl -w vm.swappiness=30
else
  log "Swap already active, skipping."
fi

# --- 3. Firewall note ---
# GCP firewall is controlled by network tags (http-server/https-server) + VPC
# firewall rules, NOT on-VM iptables. Do NOT enable ufw here — a default
# "deny incoming" ufw profile would conflict with the GCP-tagged rules and
# lock out ports 80/443. Manage ports in VPC network > Firewall only.

# --- 4. Clone-or-sync app code (no .env is ever created on the VM) ---
if [ ! -d "${APP_DIR}/.git" ]; then
  log "Cloning repo..."
  git clone "${REPO_URL}" "${APP_DIR}"
else
  log "Syncing repo..."
  git -C "${APP_DIR}" pull --ff-only || log "git pull failed, continuing with existing checkout"
fi

# --- 5. Grant the VM service account accessor on exactly the documented secrets ---
# Runs with the VM's own identity. A default compute service account often has
# enough IAM rights; if not, the warning prints the exact command to run once
# from an admin laptop (BRINGUP.md §6b). Missing optional secrets are skipped.
VM_SA="$(curl -fsS -H 'Metadata-Flavor: Google' \
  http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/email || true)"
if [[ -z "${VM_SA}" ]]; then
  log "WARNING: could not read VM service account email from metadata server; skipping IAM binding."
else
  log "Ensuring ${VM_SA} can read the documented secrets in project ${GCP_PROJECT}..."
  for secret in "${REQUIRED_SECRETS[@]}" "${OPTIONAL_SECRETS[@]}"; do
    if ! gcloud secrets describe "${secret}" --project="${GCP_PROJECT}" >/dev/null 2>&1; then
      log "secret ${secret} does not exist yet — skipping (entrypoint reports it if required)."
      continue
    fi
    if gcloud secrets add-iam-policy-binding "${secret}" \
         --project="${GCP_PROJECT}" \
         --member="serviceAccount:${VM_SA}" \
         --role="roles/secretmanager.secretAccessor" >/dev/null 2>&1; then
      log "OK secretAccessor on ${secret}"
    else
      log "WARNING: could not bind ${secret}. Run once from an admin shell:"
      log "  gcloud secrets add-iam-policy-binding ${secret} --project=${GCP_PROJECT} --member=serviceAccount:${VM_SA} --role=roles/secretmanager.secretAccessor"
    fi
  done
fi

# --- 5b. DuckDNS: repoint the public hostname at this boot's ephemeral IP ---
# Runs BEFORE the containers start so Caddy's HTTP-01 challenge and the app's
# BACKEND_URL (Google OAuth redirect) are valid on the very first request.
# The update URL deliberately carries NO `ip=` parameter: DuckDNS records the
# public source address it sees, which follows the ephemeral VM IP across
# stop/start cycles. Every failure here logs loudly but never aborts the boot —
# the API remains reachable on localhost for debugging, and the script
# re-verifies DNS instead of trusting the HTTP response alone.
DUCKDNS_TOKEN_VALUE=""
if ! gcloud secrets describe DUCKDNS_TOKEN --project="${GCP_PROJECT}" >/dev/null 2>&1; then
  log "WARNING: Secret Manager secret DUCKDNS_TOKEN does not exist — DNS/TLS will not work (create it per BRINGUP.md §6b)."
else
  # Retry briefly: the IAM binding in §5 may still be propagating. The value
  # lives in this shell variable only — never echoed, never written to disk.
  for _ in $(seq 1 6); do
    DUCKDNS_TOKEN_VALUE="$(gcloud secrets versions access latest \
      --secret=DUCKDNS_TOKEN --project="${GCP_PROJECT}" 2>/dev/null | tr -d '\r\n' || true)"
    if [[ -n "${DUCKDNS_TOKEN_VALUE}" ]]; then break; fi
    sleep 5
  done
fi

if [[ -z "${DUCKDNS_TOKEN_VALUE}" ]]; then
  log "WARNING: could not read DUCKDNS_TOKEN — skipping DuckDNS update; ${PUBLIC_HOSTNAME} may point at a stale IP."
else
  # Feed the URL through a curl config on stdin so the token never appears in
  # the process argument list (`ps`) either.
  duck_response="$(printf 'url = "https://www.duckdns.org/update?domains=%s&token=%s"\nsilent\nshow-error\nfail\nmax-time = 20\n' \
      "${DUCKDNS_SUBDOMAIN}" "${DUCKDNS_TOKEN_VALUE}" | curl --config - 2>/dev/null || true)"
  if [[ "${duck_response}" == "OK" ]]; then
    log "DuckDNS update accepted for ${PUBLIC_HOSTNAME}."
  else
    log "WARNING: DuckDNS update did not return OK (got '${duck_response:-no response}')."
  fi
  unset duck_response
fi
unset DUCKDNS_TOKEN_VALUE

# Verify success by resolving the hostname and comparing it with this VM's
# external IP (metadata server). DuckDNS propagates within seconds; retry ~60s.
EXTERNAL_IP="$(curl -fsS -H 'Metadata-Flavor: Google' \
  'http://metadata.google.internal/computeMetadata/v1/instance/network-interfaces/0/access-configs/0/external-ip' 2>/dev/null || true)"
dns_ok="false"
resolved_ip=""
for _ in $(seq 1 12); do
  resolved_ip="$(getent ahostsv4 "${PUBLIC_HOSTNAME}" 2>/dev/null | awk 'NR==1 {print $1}' || true)"
  if [[ -n "${resolved_ip}" && ( -z "${EXTERNAL_IP}" || "${resolved_ip}" == "${EXTERNAL_IP}" ) ]]; then
    dns_ok="true"
    break
  fi
  sleep 5
done
if [[ "${dns_ok}" == "true" ]]; then
  log "DNS verified: ${PUBLIC_HOSTNAME} -> ${resolved_ip}${EXTERNAL_IP:+ (VM external IP ${EXTERNAL_IP})}."
else
  log "WARNING: ${PUBLIC_HOSTNAME} did not resolve to ${EXTERNAL_IP:-this VM} within 60s — Caddy certificate issuance will fail until DNS propagates. Backend still boots on localhost."
fi

# --- 5c. DuckDNS self-heal timer (runs every 5 min, independent of boot) ---
# The boot-time refresh above runs ONCE and only if the whole script reaches
# it — this boot proved an early apt/download timeout (exit 28) can abort the
# script before 5b, leaving DNS stale until the next reboot. The timer
# re-points DNS unconditionally so a failed boot refresh self-heals in
# minutes. Same token handling as 5b: memory only, never echoed, never disk.
install -m 755 /dev/stdin /usr/local/bin/duckdns-refresh.sh <<'DUCKDNS_SCRIPT'
#!/bin/bash
# Self-healing DuckDNS refresh for deepsync.duckdns.org.
# Re-points the hostname at this VM's current public IP. Safe to run
# repeatedly — DuckDNS updates are idempotent.
# Token lives in this process's memory only; never echoed, never on disk.
set -u
PROJECT=gen-lang-client-0977081292
SUBDOMAIN=deepsync

TOKEN=$(gcloud secrets versions access latest --secret=DUCKDNS_TOKEN --project=$PROJECT 2>/dev/null | tr -d '[:cntrl:]')
if [[ -z "$TOKEN" ]]; then
  echo "duckdns-refresh: could not read DUCKDNS_TOKEN"
  exit 1
fi

RESP=$(printf 'url = "https://www.duckdns.org/update?domains=%s&token=%s"\nsilent\nshow-error\nfail\nmax-time = 20\n' \
    "$SUBDOMAIN" "$TOKEN" | curl --config - 2>/dev/null)

if [[ "$RESP" == "OK" ]]; then
  echo "duckdns-refresh: OK"
else
  echo "duckdns-refresh: unexpected response '${RESP:-none}'"
  exit 1
fi
DUCKDNS_SCRIPT

cat > /etc/systemd/system/duckdns-refresh.service <<'UNIT_SERVICE'
[Unit]
Description=DuckDNS refresh for deepsync.duckdns.org
Wants=network-online.target
After=network-online.target

[Service]
Type=oneshot
ExecStart=/usr/local/bin/duckdns-refresh.sh
UNIT_SERVICE

cat > /etc/systemd/system/duckdns-refresh.timer <<'UNIT_TIMER'
[Unit]
Description=Refresh DuckDNS every 5 minutes

[Timer]
OnBootSec=2min
OnUnitActiveSec=5min
Persistent=true

[Install]
WantedBy=timers.target
UNIT_TIMER

systemctl daemon-reload
systemctl enable --now duckdns-refresh.timer
log "DuckDNS self-heal timer installed (5 min cadence)."

# --- 6. Boot backend from the PREBUILT Hub image (never build on the VM) ---
# No --env-file: compose interpolates the exported non-secret config above and
# the container entrypoint pulls secrets from Secret Manager (GCP_PROJECT).
cd "${APP_DIR}"
docker compose -f docker-compose.yml pull \
  || fail "docker compose pull failed — did build-and-push.sh run for this commit?"
docker compose -f docker-compose.yml up -d

# --- 7. Healthcheck: backend first (loopback), then public TLS (non-fatal) ---
log "Waiting for backend health..."
backend_healthy="false"
for _ in $(seq 1 36); do
  if curl -fsS --max-time 5 http://localhost:8000/health > /dev/null; then
    backend_healthy="true"
    break
  fi
  sleep 5
done
if [[ "${backend_healthy}" != "true" ]]; then
  log "Backend did not become healthy in time; check 'docker logs career-guidance-backend'."
  exit 1
fi
log "Backend healthy."

# Public TLS is expected but not fatal: on a cold boot DNS may still be
# propagating and Caddy may still be completing the HTTP-01 challenge.
log "Checking public TLS endpoint https://${PUBLIC_HOSTNAME}/health..."
if curl -fsS --max-time 10 "https://${PUBLIC_HOSTNAME}/health" > /dev/null; then
  log "Public TLS healthy: https://${PUBLIC_HOSTNAME}"
else
  log "WARNING: https://${PUBLIC_HOSTNAME}/health not reachable yet — check the 80/443 firewall rules and 'docker compose logs caddy' (BRINGUP.md §1a)."
fi
exit 0
