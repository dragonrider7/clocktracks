#!/usr/bin/env bash

echo ""
echo "  ── TimeClock ─────────────────────────────────────────"
echo ""

# ── Check Docker ──────────────────────────────────────────────────────────────
if ! command -v docker &> /dev/null; then
  echo "  ERROR: Docker is not installed."
  echo ""
  echo "  Install it with:"
  echo "    Ubuntu/Debian:  sudo apt install docker.io docker-compose-plugin"
  echo "    Or visit:       https://docs.docker.com/engine/install/"
  echo ""
  read -rp "  Press Enter to close..."
  exit 1
fi

# ── Check docker compose (v2 plugin) ─────────────────────────────────────────
if docker compose version &> /dev/null; then
  COMPOSE="docker compose"
elif command -v docker-compose &> /dev/null; then
  COMPOSE="docker-compose"
else
  echo "  ERROR: Docker Compose is not installed."
  echo ""
  echo "  Install it with:"
  echo "    sudo apt install docker-compose-plugin"
  echo ""
  read -rp "  Press Enter to close..."
  exit 1
fi

# ── Check .env.docker ─────────────────────────────────────────────────────────
if [ ! -f .env.docker ]; then
  echo "  ERROR: .env.docker not found."
  echo ""
  echo "  1. Run:  cp .env.docker.example .env.docker"
  echo "  2. Open .env.docker and fill in your Clerk keys and DB password"
  echo "  3. Run this script again"
  echo ""
  read -rp "  Press Enter to close..."
  exit 1
fi

# ── Start ─────────────────────────────────────────────────────────────────────
echo "  Starting TimeClock (this may take a few minutes on first run)..."
echo ""

if ! DOCKER_BUILDKIT=1 $COMPOSE --env-file .env.docker up --build -d; then
  echo ""
  echo "  ERROR: Failed to start. Run this for full details:"
  echo "    $COMPOSE --env-file .env.docker up --build"
  echo ""
  read -rp "  Press Enter to close..."
  exit 1
fi

APP_PORT=$(grep '^APP_PORT=' .env.docker | cut -d= -f2)
APP_PORT=${APP_PORT:-80}
LOCAL_IP=$(hostname -I 2>/dev/null | awk '{print $1}')

echo ""
echo "  ✓ TimeClock is running"
echo ""
echo "  Open in your browser:"
echo "    http://localhost:${APP_PORT}"
[ -n "$LOCAL_IP" ] && echo "    http://${LOCAL_IP}:${APP_PORT}  (other devices on your network)"
echo ""
echo "  To stop:      ./stop.sh"
echo "  To view logs: $COMPOSE --env-file .env.docker logs -f"
echo ""
read -rp "  Press Enter to close..."
