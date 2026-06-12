# Makes a public Cloudflare link to the game on http://localhost:3000:
#   1. waits until the game server is actually answering,
#   2. starts the tunnel (HTTP/2 preferred - steadier on office Wi-Fi than QUIC),
#   3. VERIFIES the link works end-to-end before handing it to you,
#   4. copies it, shows it, opens it, and saves it to CURRENT-LINK.txt.
# Closing this window stops sharing (the tunnel runs inside this window).

$ErrorActionPreference = 'SilentlyContinue'
$proj = if ($PSScriptRoot) { $PSScriptRoot } else { Split-Path -Parent $MyInvocation.MyCommand.Path }

# --- Step 1: wait for the local game server to be ready (up to ~60s) -----------
Write-Host "Waiting for the game server to start..." -ForegroundColor DarkGray
$serverUp = $false
for ($i = 0; $i -lt 60 -and -not $serverUp; $i++) {
  try {
    if ((Invoke-WebRequest -Uri 'http://127.0.0.1:3000' -UseBasicParsing -TimeoutSec 3).StatusCode -eq 200) {
      $serverUp = $true
    }
  } catch { Start-Sleep -Seconds 1 }
}
if (-not $serverUp) {
  Write-Host ""
  Write-Host "The game server did not start." -ForegroundColor Red
  Write-Host "Look at the 'Number Wars Server' window for red text and send it to Claude." -ForegroundColor Red
  Read-Host "Press Enter to close"
  exit
}
Write-Host "Game server is ready." -ForegroundColor Green

# --- Step 2: find cloudflared --------------------------------------------------
$cf = "C:\Program Files (x86)\cloudflared\cloudflared.exe"
if (-not (Test-Path $cf)) { $cf = "C:\Program Files\cloudflared\cloudflared.exe" }
if (-not (Test-Path $cf)) {
  Write-Host ""
  Write-Host "cloudflared is not installed, so no public link can be made." -ForegroundColor Yellow
  Write-Host "Opening the game on this PC only (http://localhost:3000)." -ForegroundColor Yellow
  Start-Process "http://localhost:3000"
  Read-Host "Press Enter to close"
  exit
}

# Prefer HTTP/2 over QUIC (UDP). Office/Wi-Fi networks often throttle UDP, which can
# drop a QUIC tunnel mid-game. Set as an env var so an older cloudflared that doesn't
# know it just ignores it (an unknown command-line flag would instead crash startup).
$env:TUNNEL_PROTOCOL = 'http2'

# --- Step 3: start the tunnel in THIS window -----------------------------------
$out = Join-Path $env:TEMP "numberwars-tunnel.out"
$err = Join-Path $env:TEMP "numberwars-tunnel.err"
Remove-Item $out, $err -ErrorAction SilentlyContinue
$proc = Start-Process -FilePath $cf `
  -ArgumentList 'tunnel', '--no-autoupdate', '--url', 'http://localhost:3000' `
  -NoNewWindow -PassThru `
  -RedirectStandardOutput $out -RedirectStandardError $err

# Wait for the public URL to appear in the logs (usually 5-10 seconds).
$url = $null
for ($i = 0; $i -lt 40 -and -not $url; $i++) {
  Start-Sleep -Seconds 1
  $text = (Get-Content $out -Raw) + "`n" + (Get-Content $err -Raw)
  if ($text) {
    $m = [regex]::Match($text, 'https://[a-z0-9-]+\.trycloudflare\.com')
    if ($m.Success) { $url = $m.Value }
  }
}

if (-not $url) {
  Write-Host ""
  Write-Host "Couldn't create a public link - please check your internet and try again." -ForegroundColor Red
  Write-Host "You can still play on this PC at http://localhost:3000"
  Read-Host "Press Enter to close"
  exit
}

# --- Step 4: verify the link actually works end-to-end (up to ~30s) ------------
# Fresh tunnels can take a few seconds to become reachable, so we keep checking.
Write-Host "Checking the link is live..." -ForegroundColor DarkGray
$live = $false
for ($i = 0; $i -lt 15 -and -not $live; $i++) {
  try {
    if ((Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 5).StatusCode -eq 200) { $live = $true }
  } catch { Start-Sleep -Seconds 2 }
}

# Save the current link so there is always ONE place to find the latest one.
Set-Content -Path (Join-Path $proj 'CURRENT-LINK.txt') -Value $url -Encoding UTF8
Set-Clipboard -Value $url

Write-Host ""
Write-Host "============================================================" -ForegroundColor Green
if ($live) {
  Write-Host "  SHARE THIS LINK  (CONFIRMED WORKING - any WiFi / mobile):" -ForegroundColor Green
} else {
  Write-Host "  SHARE THIS LINK  (give it ~30 more seconds to warm up if" -ForegroundColor Yellow
  Write-Host "  a friend sees an error on the very first try):" -ForegroundColor Yellow
}
Write-Host ""
Write-Host "      $url" -ForegroundColor Cyan
Write-Host ""
Write-Host "  It's already COPIED to your clipboard - just paste it" -ForegroundColor Green
Write-Host "  into LINE / WhatsApp / etc. to invite your friends." -ForegroundColor Green
Write-Host ""
Write-Host "  IMPORTANT: this link is NEW every time you start the game." -ForegroundColor Yellow
Write-Host "  Always share THIS one. Old links show 'Error 1033'." -ForegroundColor Yellow
Write-Host "  (It's also saved in CURRENT-LINK.txt in the game folder.)" -ForegroundColor DarkGray
Write-Host "============================================================" -ForegroundColor Green
Write-Host ""
Write-Host "  Keep this window open while people play."
Write-Host "  Closing it stops the link for everyone."
Start-Process $url

# Keep this window alive (and the tunnel with it) until the user closes it.
Wait-Process -Id $proc.Id
