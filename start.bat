@echo off
setlocal

:: ── TimeClock startup script (Windows) ────────────────────────────────────────

where docker >nul 2>&1
if %errorlevel% neq 0 (
    echo.
    echo ERROR: Docker is not installed.
    echo Install Docker Desktop from: https://www.docker.com/products/docker-desktop/
    echo.
    pause
    exit /b 1
)

if not exist .env.docker (
    echo.
    echo ERROR: .env.docker not found.
    echo.
    echo   1. Copy the example file:  copy .env.docker.example .env.docker
    echo   2. Open .env.docker in Notepad and fill in your Clerk keys and DB password
    echo   3. Run this script again
    echo.
    pause
    exit /b 1
)

echo.
echo   Starting TimeClock...
echo.

set DOCKER_BUILDKIT=1
docker compose --env-file .env.docker up --build -d

if %errorlevel% neq 0 (
    echo.
    echo ERROR: Failed to start. Check the output above for details.
    pause
    exit /b 1
)

echo.
echo   TimeClock is running.
echo.
echo   Open in your browser:
echo     http://localhost
echo.
echo   To stop: run stop.bat
echo   To view logs: docker compose --env-file .env.docker logs -f
echo.
pause
