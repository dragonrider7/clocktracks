#!/usr/bin/env bash

echo ""
echo "  Stopping TimeClock..."

if docker compose version &> /dev/null; then
  docker compose --env-file .env.docker down
elif command -v docker-compose &> /dev/null; then
  docker-compose --env-file .env.docker down
else
  echo "  ERROR: Docker Compose not found."
  exit 1
fi

echo "  ✓ Stopped. Your data is preserved."
echo ""
read -rp "  Press Enter to close..."
