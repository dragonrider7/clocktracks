#!/usr/bin/env bash
set -e

# ── TimeClock startup script (Linux / Mac) ────────────────────────────────────

if ! command -v docker &> /dev/null; then
  echo ""
  echo "ERROR: Docker is not installed."
  echo "Install Docker Engine from: https://docs.docker.com/engine/install/"
  echo ""
  exit 1
fi

if [ ! -f .env.docker ]; then
  echo ""
  echo "ERROR: .env.docker not found."
  echo ""
  echo "  1. Copy the example file:  cp .env.docker.example .env.docker"
  echo "  2. Open .env.docker and fill in your Clerk keys and DB password"
  echo "  3. Run this script again"
  echo ""
  exit 1
fi

echo ""
echo "  Starting TimeClock..."
echo ""

DOCKER_BUILDKIT=1 docker compose --env-file .env.docker up --build -d

APP_PORT=$(grep '^APP_PORT=' .env.docker | cut -d= -f2 || echo "80")
APP_PORT=${APP_PORT:-80}

LOCAL_IP=$(hostname -I 2>/dev/null | awk '{print $1}' || echo "localhost")

echo ""
echo "  ✓ TimeClock is running"
echo ""
echo "  Open in your browser:"
echo "    http://localhost:${APP_PORT}"
echo "    http://${LOCAL_IP}:${APP_PORT}  (for other devices on your network)"
echo ""
echo "  To stop:  ./stop.sh"
echo "  To view logs:  docker compose --env-file .env.docker logs -f"
echo ""
