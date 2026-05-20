#!/usr/bin/env bash
set -e

echo ""
echo "  Stopping TimeClock..."
docker compose --env-file .env.docker down
echo "  ✓ Stopped. Your data is preserved."
echo ""
