param(
    [switch]$Ngrok,
    [switch]$NoBuild,
    [int]$FrontendPort = 3000,
    [int]$BackendPort  = 4000
)

$ErrorActionPreference = "Stop"
$Root = $PSScriptRoot

Write-Host ""
Write-Host "=== AYE PLATFORM LAUNCHER ===" -ForegroundColor Yellow
Write-Host ""

# Step 1: Build
if (-not $NoBuild) {
    Write-Host "[1/2] Building backend..." -ForegroundColor Cyan
    Push-Location "$Root\backend"
    & node_modules\.bin\tsc
    if ($LASTEXITCODE -ne 0) { Write-Host "FAILED: Backend build" -ForegroundColor Red; exit 1 }
    Pop-Location

    Write-Host "[2/2] Building frontend..." -ForegroundColor Cyan
    Push-Location "$Root\frontend"
    & node_modules\.bin\next build
    if ($LASTEXITCODE -ne 0) { Write-Host "FAILED: Frontend build" -ForegroundColor Red; exit 1 }
    Pop-Location

    Write-Host "Build complete" -ForegroundColor Green
} else {
    Write-Host "Skipping build (-NoBuild)" -ForegroundColor Yellow
}

# Step 2: Start PM2
Write-Host ""
Write-Host "Starting PM2..." -ForegroundColor Cyan
Push-Location $Root
pm2 start ecosystem.config.js --update-env 2>&1 | Out-Null
pm2 save 2>&1 | Out-Null
Pop-Location
Start-Sleep -Seconds 4

# Step 3: Health checks
Write-Host ""
Write-Host "--- Access URLs ---" -ForegroundColor Yellow
Write-Host "  Local frontend:  http://localhost:$FrontendPort"
Write-Host "  Local backend:   http://localhost:$BackendPort"
Write-Host "  Swagger UI:      http://localhost:$BackendPort/api-docs"

# Detect Tailscale IP
$tsIP = $null
try {
    $tsIP = (Get-NetIPAddress -InterfaceAlias "Tailscale" -AddressFamily IPv4 -ErrorAction Stop).IPAddress
} catch {
    $tsIP = (ipconfig 2>&1 | Select-String "100\.\d+\.\d+\.\d+" | ForEach-Object { $_.Matches[0].Value } | Select-Object -First 1)
}
if ($tsIP) {
    Write-Host "  Tailscale:       http://${tsIP}:$FrontendPort" -ForegroundColor Magenta
}

# Step 4: Optional ngrok
if ($Ngrok) {
    Write-Host ""
    Write-Host "Starting ngrok on port $FrontendPort..." -ForegroundColor Cyan

    $ngrokExe = "$env:USERPROFILE\AppData\Local\ngrok\ngrok.exe"
    $ngrokCmd = Get-Command ngrok -ErrorAction SilentlyContinue
    if (-not (Test-Path $ngrokExe)) {
        if ($ngrokCmd) { $ngrokExe = $ngrokCmd.Source } else { $ngrokExe = $null }
    }

    if ($ngrokExe -and (Test-Path $ngrokExe)) {
        Start-Process -FilePath $ngrokExe -ArgumentList "http $FrontendPort" -WindowStyle Minimized
        Start-Sleep -Seconds 4
        try {
            $tunnels = Invoke-RestMethod "http://localhost:4040/api/tunnels" -TimeoutSec 5
            $publicUrl = ($tunnels.tunnels | Where-Object { $_.proto -eq "https" }).public_url
            if (-not $publicUrl) { $publicUrl = $tunnels.tunnels[0].public_url }
            Write-Host "  ngrok public URL: $publicUrl" -ForegroundColor Green
        } catch {
            Write-Host "  ngrok started - open http://localhost:4040 for URL" -ForegroundColor Yellow
        }
    } else {
        Write-Host ""
        Write-Host "  ngrok not found. To install:" -ForegroundColor Red
        Write-Host "  1. Go to https://ngrok.com/download" -ForegroundColor White
        Write-Host "  2. Download Windows ZIP, extract ngrok.exe to:" -ForegroundColor White
        Write-Host "     $env:USERPROFILE\AppData\Local\ngrok\" -ForegroundColor White
        Write-Host "  3. Run: ngrok config add-authtoken YOUR_TOKEN" -ForegroundColor White
        Write-Host "  4. Then run: .\start.ps1 -NoBuild -Ngrok" -ForegroundColor White
    }
}

# Step 5: PM2 status
Write-Host ""
pm2 list

Write-Host ""
Write-Host "--- Commands ---" -ForegroundColor Yellow
Write-Host "  pm2 logs       - live logs"
Write-Host "  pm2 monit      - CPU/memory dashboard"
Write-Host "  pm2 reload all - reload without downtime"
Write-Host "  pm2 stop all   - stop everything"
Write-Host ""
