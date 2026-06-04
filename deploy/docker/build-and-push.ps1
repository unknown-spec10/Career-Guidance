param(
    [string]$DockerUsername = "",
    [string]$Tag = "latest"
)

$ErrorActionPreference = "Stop"

# Locate workspace root directory relative to script
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RepoRoot = [string](Resolve-Path (Join-Path $ScriptDir "..\.."))

# Try loading .env or .env.aws to find DOCKER_HUB_USERNAME if not provided
if (-not $DockerUsername) {
    $envPaths = @(
        (Join-Path $RepoRoot ".env"),
        (Join-Path $RepoRoot ".env.docker"),
        (Join-Path $RepoRoot "deploy\aws\.env.aws")
    )
    foreach ($path in $envPaths) {
        if (Test-Path $path) {
            $lines = Get-Content $path
            foreach ($line in $lines) {
                if ($line -match "^\s*DOCKER_HUB_USERNAME\s*=\s*(.*)") {
                    $DockerUsername = $Matches[1].Trim()
                    break
                }
            }
        }
        if ($DockerUsername) { break }
    }
}

if (-not $DockerUsername) {
    Write-Warning "DockerUsername parameter is empty and DOCKER_HUB_USERNAME not found in environment files."
    $DockerUsername = Read-Host -Prompt "Enter your Docker Hub username"
}

if (-not $DockerUsername) {
    throw "Docker Hub username is required."
}

$DockerUsername = $DockerUsername.ToLower().Trim()
$Timestamp = Get-Date -Format "yyyyMMdd-HHmmss"

Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "Building and Pushing Career Guidance Backend Docker Image" -ForegroundColor Cyan
Write-Host "Docker Hub Username: $DockerUsername" -ForegroundColor Green
Write-Host "Base Tag:            $Tag" -ForegroundColor Green
Write-Host "Timestamp Tag:       $Timestamp" -ForegroundColor Green
Write-Host "Repository Root:     $RepoRoot" -ForegroundColor Green
Write-Host "Note:                Frontend is on Vercel and DB is on Supabase." -ForegroundColor Yellow
Write-Host "                     Only the Backend API container will be built." -ForegroundColor Yellow
Write-Host "==================================================" -ForegroundColor Cyan

# Check if Docker is running
if (-not (Get-Process -Name "Docker Desktop" -ErrorAction SilentlyContinue) -and -not (docker info -ErrorAction SilentlyContinue)) {
    Write-Warning "Docker daemon does not appear to be running. Please start Docker first."
}

# 1. Build and tag backend image
Write-Host "`n[1/2] Building Backend Image..." -ForegroundColor Cyan
Push-Location $RepoRoot
try {
    # Build context is repo root, Dockerfile is resume_pipeline/Dockerfile
    docker build -t "$DockerUsername/career-guidance-backend:$Tag" -t "$DockerUsername/career-guidance-backend:$Timestamp" -f resume_pipeline/Dockerfile .
    
    # 2. Push backend images
    Write-Host "`n[2/2] Pushing Backend Image to Docker Hub..." -ForegroundColor Cyan
    docker push "$DockerUsername/career-guidance-backend:$Tag"
    docker push "$DockerUsername/career-guidance-backend:$Timestamp"
    
    Write-Host "`n✅ Successfully built and pushed backend image!" -ForegroundColor Green
}
finally {
    Pop-Location
}
