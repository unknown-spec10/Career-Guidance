#!/bin/bash
set -e

# Docker Helper Build and Push Script for Career Guidance AI Backend
# Usage: ./deploy/docker/build-and-push.sh [docker_username] [tag]

DOCKER_USERNAME="${1:-}"
TAG="${2:-latest}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

# Try loading .env or .env.aws to find DOCKER_HUB_USERNAME if not provided
if [ -z "$DOCKER_USERNAME" ]; then
    ENV_FILES=("$REPO_ROOT/.env" "$REPO_ROOT/.env.docker" "$REPO_ROOT/deploy/aws/.env.aws")
    for file in "${ENV_FILES[@]}"; do
        if [ -f "$file" ]; then
            # Parse DOCKER_HUB_USERNAME from env file
            DOCKER_USERNAME=$(grep -E '^\s*DOCKER_HUB_USERNAME\s*=' "$file" | head -n 1 | cut -d'=' -f2 | xargs 2>/dev/null || grep -E '^\s*DOCKER_HUB_USERNAME\s*=' "$file" | head -n 1 | cut -d'=' -f2)
            if [ -n "$DOCKER_USERNAME" ]; then
                break
            fi
        fi
    done
fi

if [ -z "$DOCKER_USERNAME" ]; then
    echo -e "\033[0;33mWarning: Docker username parameter is empty and DOCKER_HUB_USERNAME not found in environment files.\033[0m"
    read -p "Enter your Docker Hub username: " DOCKER_USERNAME
fi

if [ -z "$DOCKER_USERNAME" ]; then
    echo -e "\033[0;31mError: Docker Hub username is required.\033[0m"
    exit 1
fi

# Standardize to lower case and clean whitespace
DOCKER_USERNAME=$(echo "$DOCKER_USERNAME" | tr '[:upper:]' '[:lower:]' | xargs)
TIMESTAMP=$(date +"%Y%m%d-%H%M%S")

echo -e "\033[0;36m==================================================\033[0m"
echo -e "\033[0;36mBuilding and Pushing Career Guidance Backend Docker Image\033[0m"
echo -e "\033[0;32mDocker Hub Username: $DOCKER_USERNAME\033[0m"
echo -e "\033[0;32mBase Tag:            $TAG\033[0m"
echo -e "\033[0;32mTimestamp Tag:       $TIMESTAMP\033[0m"
echo -e "\033[0;32mRepository Root:     $REPO_ROOT\033[0m"
echo -e "\033[0;33mNote:                Frontend is on Vercel and DB is on Supabase.\033[0m"
echo -e "\033[0;33m                     Only the Backend API container will be built.\033[0m"
echo -e "\033[0;36m==================================================\033[0m"

# Check if Docker is running
if ! docker info >/dev/null 2>&1; then
    echo -e "\033[0;33mWarning: Docker daemon does not appear to be running. Please start Docker first.\033[0m"
fi

cd "$REPO_ROOT"

# 1. Build and tag backend image
echo -e "\n\033[0;36m[1/2] Building Backend Image...\033[0m"
docker build -t "$DOCKER_USERNAME/career-guidance-backend:$TAG" -t "$DOCKER_USERNAME/career-guidance-backend:$TIMESTAMP" -f resume_pipeline/Dockerfile .

# 2. Push backend images
echo -e "\n\033[0;36m[2/2] Pushing Backend Image to Docker Hub...\033[0m"
docker push "$DOCKER_USERNAME/career-guidance-backend:$TAG"
docker push "$DOCKER_USERNAME/career-guidance-backend:$TIMESTAMP"

echo -e "\n\033[0;32m✅ Successfully built and pushed backend image!\033[0m"
