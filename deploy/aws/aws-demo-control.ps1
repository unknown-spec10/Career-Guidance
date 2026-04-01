param(
    [Parameter(Mandatory = $true)]
    [ValidateSet("start", "stop", "status")]
    [string]$Action,

    [Parameter(Mandatory = $true)]
    [string]$InstanceId,

    [string]$Region = "us-east-1"
)

$ErrorActionPreference = "Stop"

function Require-AwsCli {
    if (-not (Get-Command aws -ErrorAction SilentlyContinue)) {
        throw "AWS CLI not found. Install AWS CLI v2 and run aws configure first."
    }
}

Require-AwsCli

switch ($Action) {
    "start" {
        aws ec2 start-instances --instance-ids $InstanceId --region $Region | Out-Null
        Write-Host "Instance start requested: $InstanceId"
    }
    "stop" {
        aws ec2 stop-instances --instance-ids $InstanceId --region $Region | Out-Null
        Write-Host "Instance stop requested: $InstanceId"
    }
    "status" {
        $state = aws ec2 describe-instances --instance-ids $InstanceId --region $Region --query "Reservations[0].Instances[0].State.Name" --output text
        Write-Host "Instance state: $state"
    }
}
