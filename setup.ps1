# One-shot setup for Windows PowerShell. Run from the project root:
#   powershell -ExecutionPolicy Bypass -File .\setup.ps1

Write-Host "==> Starting Redis in Docker..." -ForegroundColor Cyan
docker compose up -d
if ($LASTEXITCODE -ne 0) {
  Write-Host "Docker failed. Make sure Docker Desktop is running, then run this script again." -ForegroundColor Red
  exit 1
}

if (-not (Test-Path "backend\.env")) {
  Copy-Item "backend\.env.example" "backend\.env"
  Write-Host "==> Created backend\.env from .env.example" -ForegroundColor Cyan
}

Write-Host "==> Installing dependencies (root, backend, frontend)..." -ForegroundColor Cyan
npm install
npm --prefix backend install
npm --prefix frontend install

Write-Host ""
Write-Host "Setup complete. Start everything with:  npm run dev" -ForegroundColor Green
Write-Host "Dashboard: http://localhost:5173    API: http://localhost:4000/api/health" -ForegroundColor Green
