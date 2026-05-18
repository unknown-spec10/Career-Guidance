#!/usr/bin/env pwsh
# Live Interview WebSocket Test Runner
# This script tests the live interview endpoint with Gemini 3.1 Flash Live

$ErrorActionPreference = "Stop"

Write-Host "================================================" -ForegroundColor Cyan
Write-Host "Live Interview WebSocket Test" -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan

# Check if backend is running
Write-Host "`n🔍 Checking backend..." -ForegroundColor Yellow
$backendRunning = $false
$backendUrl = "http://localhost:8000"

# Try multiple connection methods
@("localhost:8000", "127.0.0.1:8000", "0.0.0.0:8000") | ForEach-Object {
    $testUrl = "http://$_/docs"
    try {
        $backendCheck = Invoke-WebRequest -Uri $testUrl -TimeoutSec 2 -ErrorAction Stop
        $backendRunning = $true
        Write-Host "✓ Backend is running on port 8000 ($_)" -ForegroundColor Green
        return
    } catch {
        # Try next
    }
}

# If not found via HTTP, try netstat
if (-not $backendRunning) {
    Write-Host "   Checking if uvicorn process is running..." -ForegroundColor Cyan
    $uvicornProcess = Get-Process -Name "python" -ErrorAction SilentlyContinue | Where-Object { $_.CommandLine -match "uvicorn.*8000" }
    
    if ($uvicornProcess) {
        Write-Host "   ⚠ uvicorn process found but not responding to HTTP requests" -ForegroundColor Yellow
        Write-Host "   Process info: $($uvicornProcess.Name) (PID: $($uvicornProcess.Id))" -ForegroundColor Yellow
        Write-Host "   Waiting 3 seconds for backend to fully start..." -ForegroundColor Yellow
        Start-Sleep -Seconds 3
        
        # Try again
        try {
            $backendCheck = Invoke-WebRequest -Uri "http://localhost:8000/docs" -TimeoutSec 2 -ErrorAction Stop
            $backendRunning = $true
            Write-Host "   ✓ Backend is now responding!" -ForegroundColor Green
        } catch {
            Write-Host "   ✗ Backend still not responding after wait" -ForegroundColor Red
        }
    } else {
        Write-Host "   ✗ uvicorn process not found" -ForegroundColor Red
    }
}

if (-not $backendRunning) {
    Write-Host "`n✗ Backend is NOT running!" -ForegroundColor Red
    Write-Host "   Start it with: uvicorn resume_pipeline.app:app --reload --port 8000" -ForegroundColor Yellow
    Write-Host "`n   Or in VS Code terminal:" -ForegroundColor Yellow
    Write-Host "      cd resume_pipeline" -ForegroundColor Cyan
    Write-Host "      uvicorn resume_pipeline.app:app --reload --port 8000" -ForegroundColor Cyan
    exit 1
}

# Check Python environment
Write-Host "`n🐍 Checking Python environment..." -ForegroundColor Yellow
$pythonExe = "$PSScriptRoot\..\myenv\Scripts\python.exe"
if (-not (Test-Path $pythonExe)) {
    Write-Host "✗ Python venv not found!" -ForegroundColor Red
    Write-Host "   Expected: $pythonExe" -ForegroundColor Yellow
    exit 1
}
Write-Host "✓ Python venv found" -ForegroundColor Green

# Get SECRET_KEY from environment
$secretKey = $env:SECRET_KEY
if ([string]::IsNullOrWhiteSpace($secretKey)) {
    Write-Host "`n⚠ SECRET_KEY environment variable not set!" -ForegroundColor Yellow
    Write-Host "   Looking for SECRET_KEY in running backend..." -ForegroundColor Yellow
    
    # Try to get it from .env if exists
    $envFile = "$PSScriptRoot\..\.env"
    if (Test-Path $envFile) {
        $envContent = Get-Content $envFile
        $secretKeyLine = $envContent | Where-Object { $_ -match "^SECRET_KEY=" }
        if ($secretKeyLine) {
            $secretKey = $secretKeyLine -split "=" | Select-Object -Last 1
            $secretKey = $secretKey -replace '^["'']|["'']$'  # Remove quotes
            Write-Host "   Found SECRET_KEY in .env" -ForegroundColor Green
        }
    }
    
    if ([string]::IsNullOrWhiteSpace($secretKey)) {
        Write-Host "`n   ❌ SECRET_KEY not found!" -ForegroundColor Red
        Write-Host "   Please set it:" -ForegroundColor Yellow
        Write-Host "      `$env:SECRET_KEY = 'your-secret-key-from-config'" -ForegroundColor Cyan
        Write-Host "   Or create .env file with: SECRET_KEY=your-key" -ForegroundColor Cyan
        exit 1
    }
}
Write-Host "✓ SECRET_KEY loaded" -ForegroundColor Green

# Check for required Python packages
Write-Host "`n📦 Checking Python dependencies..." -ForegroundColor Yellow
$packages = @("aiohttp", "websockets", "python-jose", "python-dotenv")
foreach ($pkg in $packages) {
    & $pythonExe -c "import ${pkg.Replace('-', '_')}" 2>$null
    if ($LASTEXITCODE -eq 0) {
        Write-Host "   ✓ $pkg" -ForegroundColor Green
    } else {
        Write-Host "   ✗ $pkg - installing..." -ForegroundColor Yellow
        & $pythonExe -m pip install $pkg -q
    }
}

# Run the test
Write-Host "`n🚀 Running WebSocket test...$([Environment]::NewLine)" -ForegroundColor Cyan
$env:SECRET_KEY = $secretKey
& $pythonExe "$PSScriptRoot\test_live_interview_ws.py"
$testExitCode = $LASTEXITCODE

Write-Host ""
if ($testExitCode -eq 0) {
    Write-Host "✅ Test completed successfully!" -ForegroundColor Green
} else {
    Write-Host "❌ Test failed with exit code: $testExitCode" -ForegroundColor Red
}

exit $testExitCode
