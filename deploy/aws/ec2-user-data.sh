#!/bin/bash
set -euxo pipefail

# Basic bootstrap for Ubuntu 24.04/22.04
apt-get update
apt-get install -y ca-certificates curl git docker.io docker-compose-plugin
systemctl enable docker
systemctl start docker
usermod -aG docker ubuntu

# App checkout
cd /opt
if [ ! -d career-guidance ]; then
  git clone https://github.com/unknown-spec10/Career-Guidance.git career-guidance
fi
cd career-guidance

# Ensure latest code
git fetch --all
git checkout main
git pull --ff-only

# Environment file is expected to be created manually as /opt/career-guidance/.env.aws
# Start in low-cost demo mode
if [ -f .env.aws ]; then
  docker compose --env-file .env.aws -f docker-compose.aws-dev.yml up -d --build
else
  echo ".env.aws missing. Create it from .env.aws.example, then run:"
  echo "docker compose --env-file .env.aws -f docker-compose.aws-dev.yml up -d --build"
fi
