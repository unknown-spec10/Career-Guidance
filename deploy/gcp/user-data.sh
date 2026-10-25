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
# config is exported below and consumed by docker compose interpolation; all
# credentials are fetched inside the container at startup from GCP Secret
# Manager by resume_pipeline/docker-entrypoint.py (GCP_PROJECT is set).
# See deploy/gcp/BRINGUP.md §6.
set -euo pipefail

APP_DIR="/opt/career-guidance"
# >>> REQUIRED: fill these three before first boot.
# The script aborts (non-zero exit) while any PLACEHOLDER value remains.
REPO_URL="https://github.com/PLACEHOLDER_ORG/PLACEHOLDER_REPO.git"
GCP_PROJECT="PLACEHOLDER_GCP_PROJECT"
DOCKER_HUB_USERNAME="PLACEHOLDER_DOCKERHUB_USER"

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
export PG_HOST=""                 # e.g. aws-1-ap-south-1.pooler.supabase.com
export PG_PORT="5432"
export PG_USER=""                 # e.g. postgres.<project-ref>
export PG_DB="postgres"
# Public URLs (frontend stays on Vercel).
export FRONTEND_URL=""            # e.g. https://<app>.vercel.app
export BACKEND_URL=""             # e.g. http://<vm-ip>:8000
export CORS_ORIGINS=""            # e.g. https://<app>.vercel.app
export GOOGLE_CLIENT_ID=""        # OAuth client id (public identifier, not a secret)
export GMAIL_USER=""              # sender address (identifier; app password is a secret)
# Storage (local by default; gcs + bucket when using Cloud Storage).
export STORAGE_BACKEND="local"
export GCS_BUCKET_NAME="mine-career-guidance-bucket"
export GCS_PROJECT_ID=""
# RAG stays lazy on 2 GB boxes.
export RAG_PRELOAD_ON_STARTUP="false"

# Documented Secret Manager secret names (env-var name == secret name).
# Required at boot: the entrypoint aborts naming any that are missing/empty.
REQUIRED_SECRETS=(PG_PASSWORD SECRET_KEY ADMIN_EMAIL ADMIN_PASSWORD)
# Optional feature keys (create later when you paste the values; absent = empty).
OPTIONAL_SECRETS=(OPENCODE_API_KEY GROQ_API_KEY GOOGLE_API_KEY GOOGLE_SEARCH_API_KEY \
                  GOOGLE_CLIENT_SECRET YOUTUBE_DATA_API_KEY GMAIL_APP_PASSWORD)

log() { echo "[startup-script] $*"; }
fail() { log "FATAL: $*"; exit 1; }

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
# lock out port 8000/80/443. Manage ports in VPC network > Firewall only.

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

# --- 6. Boot backend from the PREBUILT Hub image (never build on the VM) ---
# No --env-file: compose interpolates the exported non-secret config above and
# the container entrypoint pulls secrets from Secret Manager (GCP_PROJECT).
cd "${APP_DIR}"
docker compose -f docker-compose.yml pull \
  || fail "docker compose pull failed — did build-and-push.sh run for this commit?"
docker compose -f docker-compose.yml up -d

# --- 7. Healthcheck against /health (up to ~3 min for cold start) ---
log "Waiting for backend health..."
for _ in $(seq 1 36); do
  if curl -fsS --max-time 5 http://localhost:8000/health > /dev/null; then
    log "Backend healthy."
    exit 0
  fi
  sleep 5
done
log "Backend did not become healthy in time; check 'docker logs career-guidance-backend'."
exit 1
