param(
    [string]$InstanceIp = "13.235.51.86",
    [string]$SshUser = "ubuntu",
    [string]$PemPath = "F:\Downloads\DeepServerKey.pem",
    [string]$RemoteAppDir = "/opt/career-guidance",
    [string]$SourceEnvPath = ""
)

$ErrorActionPreference = "Stop"

$candidateEnvPaths = @()
if ($SourceEnvPath) {
    $candidateEnvPaths += $SourceEnvPath
}
$candidateEnvPaths += @(
    (Join-Path $PSScriptRoot "..\..\.env"),
    (Join-Path $PSScriptRoot "..\..\.env.docker"),
    (Join-Path $PSScriptRoot "..\..\.env.aws")
)

function Parse-EnvFile {
    param([string]$Path)

    $values = [ordered]@{}
    foreach ($line in Get-Content -LiteralPath $Path) {
        $trimmed = $line.Trim()
        if (-not $trimmed -or $trimmed.StartsWith("#")) {
            continue
        }

        $separatorIndex = $trimmed.IndexOf("=")
        if ($separatorIndex -lt 1) {
            continue
        }

        $name = $trimmed.Substring(0, $separatorIndex).Trim()
        $value = $trimmed.Substring($separatorIndex + 1)
        $values[$name] = $value
    }

    return $values
}

$envSourcePath = $candidateEnvPaths | Where-Object { $_ -and (Test-Path -LiteralPath $_) } | Select-Object -First 1
if (-not $envSourcePath) {
    throw "No source env file found. Pass -SourceEnvPath or create .env /.env.docker at the repo root."
}

Write-Host "Using source env file: $envSourcePath"
$envConfig = Parse-EnvFile -Path $envSourcePath

function Assert-CommandExists {
    param([string]$CommandName)
    if (-not (Get-Command $CommandName -ErrorAction SilentlyContinue)) {
        throw "Required command not found: $CommandName"
    }
}

function Assert-NotPlaceholder {
    param([string]$Key, [string]$Value)

    if ([string]::IsNullOrWhiteSpace($Value)) {
        throw "Value for '$Key' is empty. Fill it before running."
    }

    if ($Value -like "REPLACE_ME*") {
        throw "Value for '$Key' still has placeholder text. Fill it before running."
    }
}

Assert-CommandExists -CommandName "ssh"
Assert-CommandExists -CommandName "scp"

if (-not (Test-Path -LiteralPath $PemPath)) {
    throw "PEM file not found: $PemPath"
}

# Validate required sensitive values are filled.
Assert-NotPlaceholder -Key "PG_HOST" -Value $envConfig.PG_HOST
Assert-NotPlaceholder -Key "PG_USER" -Value $envConfig.PG_USER
Assert-NotPlaceholder -Key "PG_PASSWORD" -Value $envConfig.PG_PASSWORD
Assert-NotPlaceholder -Key "PG_DB" -Value $envConfig.PG_DB
Assert-NotPlaceholder -Key "SECRET_KEY" -Value $envConfig.SECRET_KEY

if ($envConfig.PG_HOST -eq 'localhost') {
    throw "PG_HOST must be 'db' (for docker compose service networking) or a reachable host; 'localhost' will break container networking."
}

$tempEnvFile = Join-Path $env:TEMP "career-guidance-ec2.env"

# Build .env file content.
$lines = New-Object System.Collections.Generic.List[string]
foreach ($entry in $envConfig.GetEnumerator()) {
    $k = $entry.Key
    $v = [string]$entry.Value
    $lines.Add("$k=$v")
}

Set-Content -Path $tempEnvFile -Value $lines -Encoding UTF8

$remoteEnvTmp = "/tmp/.env.aws.new"
$remoteEnvFinal = "$RemoteAppDir/.env.aws"

Write-Host "Uploading env file to EC2..."
scp -i $PemPath $tempEnvFile "$SshUser@$InstanceIp`:$remoteEnvTmp" | Out-Null

Write-Host "Applying env file and restarting containers on EC2..."
$remoteCmdLines = @(
    "set -e",
    "cd $RemoteAppDir",
    "mv $remoteEnvTmp $remoteEnvFinal",
    "chmod 600 $remoteEnvFinal",
    "docker compose --env-file .env.aws -f deploy/docker/docker-compose.yml -f deploy/docker/docker-compose.aws-dev.yml up -d --force-recreate",
    "docker compose --env-file .env.aws -f deploy/docker/docker-compose.yml -f deploy/docker/docker-compose.aws-dev.yml ps",
    "curl -sS http://localhost:8000/api/stats | head -c 300"
)
$remoteCmd = ($remoteCmdLines -join "`n") -replace "`r", ""

ssh -i $PemPath "$SshUser@$InstanceIp" "bash -lc '$remoteCmd'"

Write-Host "Done. EC2 env updated and services restarted."
