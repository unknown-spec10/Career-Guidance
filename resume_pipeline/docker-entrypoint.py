#!/usr/bin/env python3
"""Container entrypoint: optional GCP Secret Manager injection, then exec.

Two modes, selected by ``GCP_PROJECT``:

* **Unset (local development):** exec the command unchanged. The root
  ``docker-compose.yml`` + repo-root ``.env`` flow is untouched.
* **Set (GCP VM / any GCP runtime):** fetch each documented secret from
  ``projects/$GCP_PROJECT/secrets/<NAME>/versions/latest`` using Application
  Default Credentials (the VM service account), export it into this process'
  environment, and exec the command. A missing *required* secret aborts the
  container with a message naming the exact secret path — never a silent
  fallback. *Optional* feature keys (LLM/search/email) may be absent; they are
  reported by name and left empty.

Secret names are the environment variable names themselves, so the mapping is
one-to-one and documented in ``deploy/gcp/BRINGUP.md`` §6. The image never
contains a secret file; the VM never keeps a local ``.env``.
"""
from __future__ import annotations

import os
import sys
from typing import List, Optional, Sequence

# Secrets the app cannot start correctly without.
REQUIRED_SECRETS: tuple[str, ...] = (
    "PG_PASSWORD",
    "SECRET_KEY",
    "ADMIN_EMAIL",
    "ADMIN_PASSWORD",
)

# Feature keys: absent = feature degrades (app logs a warning), never a boot failure.
# LLM/search keys are intentionally empty until the operator pastes them later.
OPTIONAL_SECRETS: tuple[str, ...] = (
    "OPENCODE_API_KEY",
    "GROQ_API_KEY",
    "GOOGLE_API_KEY",
    "GOOGLE_SEARCH_API_KEY",
    "GOOGLE_CLIENT_SECRET",
    "YOUTUBE_DATA_API_KEY",
    "GMAIL_APP_PASSWORD",
)


def _log(message: str) -> None:
    print(f"[entrypoint] {message}", flush=True)


def _fail(message: str) -> "None":
    _log(f"FATAL: {message}")
    raise SystemExit(1)


def _secret_path(project: str, name: str) -> str:
    return f"projects/{project}/secrets/{name}/versions/latest"


def _access_secret(project: str, name: str) -> Optional[str]:
    """Return the latest secret payload (str) or None when unavailable."""
    from google.api_core import exceptions as gcp_exceptions
    from google.cloud import secretmanager

    client = secretmanager.SecretManagerServiceClient()
    try:
        response = client.access_secret_version(
            request={"name": _secret_path(project, name)}
        )
    except gcp_exceptions.NotFound:
        return None
    except gcp_exceptions.PermissionDenied:
        _fail(
            f"permission denied reading {_secret_path(project, name)} — "
            "grant the runtime service account roles/secretmanager.secretAccessor "
            "on this secret (see deploy/gcp/BRINGUP.md §6b)"
        )
        return None  # unreachable, keeps type checkers happy
    return response.payload.data.decode("utf-8").strip()


def _load_secrets(project: str) -> None:
    try:
        import google.cloud.secretmanager  # noqa: F401
    except ImportError:
        _fail(
            "GCP_PROJECT is set but google-cloud-secret-manager is not installed "
            "in this image — rebuild from resume_pipeline/requirements.txt"
        )

    missing: List[str] = []
    for name in REQUIRED_SECRETS:
        value = _access_secret(project, name)
        if not value:
            missing.append(_secret_path(project, name))
            continue
        os.environ[name] = value

    if missing:
        _fail(
            "required Secret Manager secret(s) missing or empty: "
            + ", ".join(missing)
            + " — create them with 'gcloud secrets create <NAME> --data-file=-' "
            "(deploy/gcp/BRINGUP.md §6a)"
        )

    for name in OPTIONAL_SECRETS:
        value = _access_secret(project, name)
        if value:
            os.environ[name] = value
        else:
            _log(f"optional secret {name} absent — leaving {name} empty")

    _log(
        f"loaded {len(REQUIRED_SECRETS)} required secret(s) from project {project} "
        f"({', '.join(REQUIRED_SECRETS)})"
    )


def main(argv: Sequence[str]) -> "None":
    command = list(argv)
    if not command:
        _fail("no command supplied to entrypoint (expected uvicorn ...)")

    project = (os.environ.get("GCP_PROJECT") or "").strip()
    if not project:
        _log("GCP_PROJECT unset — exec'ing with container environment (local dev).")
    else:
        _log(f"GCP_PROJECT={project} — loading secrets from Secret Manager.")
        _load_secrets(project)

    os.execvp(command[0], command)


if __name__ == "__main__":
    main(sys.argv[1:])
