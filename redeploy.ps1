# ============================================================
# Career Guidance AI - Redeploy Script
# ============================================================
# Usage: .\redeploy.ps1 [backend|frontend|all]
# Examples:
#   .\redeploy.ps1 backend    # Redeploy only backend
#   .\redeploy.ps1 frontend   # Redeploy only frontend
#   .\redeploy.ps1 all        # Redeploy both
#   .\redeploy.ps1             # Default: redeploy both
# ============================================================

param(
    [string]$Service = "all"
)

# Configuration
$PROJECT_ID = "resume-app-10864"
$REGION = "asia-south1"
$BACKEND_SERVICE = "career-guidance-backend"
$BACKEND_PATH = "D:\Career Guidence\resume_pipeline"
$FRONTEND_PATH = "D:\Career Guidence\frontend"

# Colors for output
$GREEN = "`e[32m"
$YELLOW = "`e[33m"
$RED = "`e[31m"
$RESET = "`e[0m"

function Log-Info {
    param([string]$Message)
    Write-Host "${GREEN}✓${RESET} $Message" -ForegroundColor Green
}

function Log-Warn {
    param([string]$Message)
    Write-Host "${YELLOW}⚠${RESET} $Message" -ForegroundColor Yellow
}

function Log-Error {
    param([string]$Message)
    Write-Host "${RED}✗${RESET} $Message" -ForegroundColor Red
}

function Log-Header {
    param([string]$Message)
    Write-Host "`n$('=' * 60)" -ForegroundColor Cyan
    Write-Host "$Message" -ForegroundColor Cyan
    Write-Host "$('=' * 60)`n" -ForegroundColor Cyan
}

# Main redeploy function
function Redeploy-All {
    if ($Service -eq "backend" -or $Service -eq "all") {
        Redeploy-Backend
    }
    
    if ($Service -eq "frontend" -or $Service -eq "all") {
        Redeploy-Frontend
    }
}

# Backend redeploy
function Redeploy-Backend {
    Log-Header "🔄 Redeploying Backend to Cloud Run"
    
    try {
        Push-Location $BACKEND_PATH
        
        Log-Info "Starting backend deployment..."
        Log-Warn "This may take 5-10 minutes"
        
        gcloud run deploy $BACKEND_SERVICE `
            --source . `
            --region $REGION `
            --min-instances 0 `
            --max-instances 1 `
            --memory 1Gi `
            --cpu 1 `
            --allow-unauthenticated `
            --quiet
        
        if ($LASTEXITCODE -eq 0) {
            Log-Info "Backend deployed successfully!"
            Log-Info "Fetching service URL..."
            
            $serviceUrl = gcloud run services describe $BACKEND_SERVICE `
                --region $REGION `
                --format="value(status.url)"
            
            Log-Info "Backend URL: $serviceUrl"
            
            # Update frontend .env.production if needed
            if (Test-Path "$FRONTEND_PATH\.env.production") {
                Log-Info "Updating frontend backend URL..."
                Set-Content -Path "$FRONTEND_PATH\.env.production" -Value "VITE_API_URL=$serviceUrl"
            }
        }
        else {
            Log-Error "Backend deployment failed"
            exit 1
        }
        
        Pop-Location
    }
    catch {
        Log-Error "Backend deployment error: $_"
        Pop-Location
        exit 1
    }
}

# Frontend redeploy
function Redeploy-Frontend {
    Log-Header "🔄 Redeploying Frontend to Firebase Hosting"
    
    try {
        Push-Location $FRONTEND_PATH
        
        # Check if .env.production exists and has backend URL
        if (-not (Test-Path ".env.production")) {
            Log-Error ".env.production not found!"
            Log-Warn "Run redeploy.ps1 backend first to generate backend URL"
            Pop-Location
            return
        }
        
        Log-Info "Reading backend URL from .env.production..."
        $envContent = Get-Content ".env.production"
        if ($envContent -match "VITE_API_URL=") {
            Log-Info "Backend URL: $envContent"
        }
        else {
            Log-Error ".env.production missing VITE_API_URL"
            Pop-Location
            return
        }
        
        Log-Info "Installing dependencies (if needed)..."
        npm install 2>&1 | Out-Null
        
        Log-Info "Building frontend with production configuration..."
        npm run build
        
        if ($LASTEXITCODE -ne 0) {
            Log-Error "Frontend build failed"
            Pop-Location
            exit 1
        }
        
        Log-Info "Deploying to Firebase Hosting..."
        Log-Warn "This may take 2-5 minutes"
        
        firebase deploy --only hosting --project $PROJECT_ID
        
        if ($LASTEXITCODE -eq 0) {
            Log-Info "Frontend deployed successfully!"
            Log-Info "Fetching hosting URL..."
            
            $hostingUrl = firebase hosting:sites:list --project $PROJECT_ID --format "table[no-heading](defaultUrl)" 2>&1 | Select-Object -First 1
            
            if ($hostingUrl) {
                Log-Info "Frontend URL: $hostingUrl"
            }
        }
        else {
            Log-Error "Frontend deployment failed"
            Pop-Location
            exit 1
        }
        
        Pop-Location
    }
    catch {
        Log-Error "Frontend deployment error: $_"
        Pop-Location
        exit 1
    }
}

# Validate service parameter
function Validate-Service {
    if ($Service -notin @("backend", "frontend", "all")) {
        Log-Error "Invalid service: $Service"
        Log-Info "Valid options: backend, frontend, all"
        exit 1
    }
}

# Pre-flight checks
function Pre-Flight-Checks {
    Log-Header "🔍 Running Pre-Flight Checks"
    
    # Check gcloud
    if (-not (Get-Command gcloud -ErrorAction SilentlyContinue)) {
        Log-Error "gcloud CLI not found. Please install Google Cloud SDK."
        exit 1
    }
    Log-Info "gcloud CLI found"
    
    # Check firebase (if frontend deploy)
    if ($Service -eq "frontend" -or $Service -eq "all") {
        if (-not (Get-Command firebase -ErrorAction SilentlyContinue)) {
            Log-Error "Firebase CLI not found. Install with: npm install -g firebase-tools"
            exit 1
        }
        Log-Info "Firebase CLI found"
    }
    
    # Check npm (if frontend deploy)
    if ($Service -eq "frontend" -or $Service -eq "all") {
        if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
            Log-Error "npm not found. Please install Node.js."
            exit 1
        }
        Log-Info "npm found"
    }
    
    # Check backend path
    if ($Service -eq "backend" -or $Service -eq "all") {
        if (-not (Test-Path "$BACKEND_PATH\requirements.txt")) {
            Log-Error "Backend path not found: $BACKEND_PATH"
            exit 1
        }
        Log-Info "Backend path verified"
    }
    
    # Check frontend path
    if ($Service -eq "frontend" -or $Service -eq "all") {
        if (-not (Test-Path "$FRONTEND_PATH\package.json")) {
            Log-Error "Frontend path not found: $FRONTEND_PATH"
            exit 1
        }
        Log-Info "Frontend path verified"
    }
    
    Log-Info "All checks passed`n"
}

# Display summary
function Show-Summary {
    Log-Header "📋 Deployment Summary"
    
    Log-Info "Project ID: $PROJECT_ID"
    Log-Info "Region: $REGION"
    Log-Info "Service: $Service"
    Log-Info "Backend path: $BACKEND_PATH"
    Log-Info "Frontend path: $FRONTEND_PATH"
    
    Write-Host "`nDeploying..." -ForegroundColor Cyan
}

# Main execution
function Main {
    # Validate input
    Validate-Service
    
    # Show welcome
    Log-Header "🚀 Career Guidance AI - Redeploy Script"
    
    # Pre-flight checks
    Pre-Flight-Checks
    
    # Show summary
    Show-Summary
    
    # Execute redeployment
    Redeploy-All
    
    # Final summary
    Log-Header "✅ Deployment Complete"
    Log-Info "Frontend: https://resume-app-10864.web.app"
    Log-Info "Backend: https://career-guidance-backend-705280832244.asia-south1.run.app"
    Log-Info ""
    Log-Info "Visit your app to verify changes"
}

# Run main
Main
