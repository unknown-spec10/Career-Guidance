# Bulk-create GCP Secret Manager secrets from the repo-root .env file.
#
# Usage (Windows PowerShell, from the repo root):
#   $env:GCP_PROJECT = "your-project-id"
#   .\deploy\gcp\create-secrets.ps1
#
# What it does:
# - Reads the 11 documented secret names (entrypoint REQUIRED_SECRETS plus
#   OPTIONAL_SECRETS) and takes each value from .env (same name, one to one).
# - Skips names missing or empty in .env and prints them at the end.
# - Creates secrets that do not exist yet; existing secrets are left untouched
#   (use Cloud Console or `gcloud secrets versions add` to rotate).
# - Never prints a secret value. Only names and statuses are echoed.
#
# Prerequisites: `gcloud` installed and logged in
# (`gcloud auth login`, project selected or GCP_PROJECT set).

param(
    [string]$Project = $env:GCP_PROJECT,
    [string]$EnvFile = (Join-Path (Split-Path -Parent (Split-Path -Parent $PSScriptRoot)) ".env")
)

$ErrorActionPreference = "Stop"

if (-not $Project) {
    Write-Error "Set GCP_PROJECT first:  `$env:GCP_PROJECT = 'your-project-id'"
}

$Required = @("PG_PASSWORD", "SECRET_KEY", "ADMIN_EMAIL", "ADMIN_PASSWORD")
$Optional = @("OPENCODE_API_KEY", "GROQ_API_KEY", "GOOGLE_API_KEY", "GOOGLE_SEARCH_API_KEY", "GOOGLE_CLIENT_SECRET", "YOUTUBE_DATA_API_KEY", "GMAIL_APP_PASSWORD")
$Names = $Required + $Optional

if (-not (Test-Path $EnvFile)) {
    Write-Error "Env file not found: $EnvFile"
}

# Parse .env into a hashtable (names only leave this script as statuses).
$EnvValues = @{}
foreach ($line in (Get-Content -LiteralPath $EnvFile)) {
    $trimmed = $line.Trim()
    if ($trimmed -eq "" -or $trimmed.StartsWith("#")) { continue }
    $eq = $trimmed.IndexOf("=")
    if ($eq -lt 1) { continue }
    $key = $trimmed.Substring(0, $eq).Trim()
    $value = $trimmed.Substring($eq + 1)
    $EnvValues[$key] = $value
}

$skipped = @()
$created = @()
$existing = @()

foreach ($name in $Names) {
    if (-not $EnvValues.ContainsKey($name) -or [string]::IsNullOrWhiteSpace($EnvValues[$name])) {
        $skipped += $name
        continue
    }
    $check = & gcloud secrets describe $name --project $Project 2>&1
    if ($LASTEXITCODE -eq 0) {
        $existing += $name
        continue
    }
    # Pipe the value via stdin so it never appears in process arguments.
    $EnvValues[$name] | & gcloud secrets create $name --project $Project --data-file=- --replication-policy=automatic 2>&1 | Out-Null
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Failed to create secret: $name"
    }
    $created += $name
}

Write-Output "Project: $Project"
Write-Output ("Created (" + $created.Count + "): " + ($created -join ", "))
Write-Output ("Already existed (" + $existing.Count + "): " + ($existing -join ", "))
Write-Output ("Skipped, empty in .env (" + $skipped.Count + "): " + ($skipped -join ", "))
