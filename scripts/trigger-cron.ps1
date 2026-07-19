# 本地开发便捷脚本：触发三个 cron 端点。
# 用法：pwsh scripts/trigger-cron.ps1 [-Action poll|cleanup-uploads|cleanup-results|all]

param(
  [ValidateSet("poll", "cleanup-uploads", "cleanup-results", "all")]
  [string]$Action = "all"
)

$ErrorActionPreference = "Stop"
$Base = "http://localhost:3000"

# 从 .env.local 读取 CRON_SECRET
$EnvFile = Join-Path $PSScriptRoot ".." ".env.local"
$Secret = "dev-cron-secret-7k2m9x"
if (Test-Path $EnvFile) {
  $line = Get-Content $EnvFile | Where-Object { $_ -match "^CRON_SECRET=" }
  if ($line) { $Secret = ($line -split "=", 2)[1].Trim() }
}
$Headers = @{ "X-Cron-Secret" = $Secret }

function Invoke-Cron($path) {
  try {
    $r = Invoke-RestMethod -Method Post -Uri "$Base/api/cron/$path" -Headers $Headers
    Write-Host "[$path] OK:" ($r | ConvertTo-Json -Compress)
  } catch {
    Write-Host "[$path] FAIL: $($_.Exception.Message)"
  }
}

switch ($Action) {
  "poll" { Invoke-Cron "poll-tasks" }
  "cleanup-uploads" { Invoke-Cron "cleanup-uploads" }
  "cleanup-results" { Invoke-Cron "cleanup-results" }
  "all" { Invoke-Cron "poll-tasks"; Invoke-Cron "cleanup-uploads"; Invoke-Cron "cleanup-results" }
}
