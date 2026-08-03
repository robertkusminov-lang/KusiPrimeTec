$ErrorActionPreference = "Stop"

$functionsDir = Join-Path (Get-Location) "supabase/functions"
if (-not (Test-Path $functionsDir)) {
  throw "Functions-Verzeichnis nicht gefunden: $functionsDir"
}

$functions = Get-ChildItem $functionsDir -Directory |
  Where-Object { $_.Name -ne "_shared" } |
  Select-Object -ExpandProperty Name

if (-not $functions -or $functions.Count -eq 0) {
  throw "Keine Functions zum Deploy gefunden."
}

foreach ($fn in $functions) {
  Write-Host "Deploying $fn with its explicit supabase.toml configuration"
  npx supabase functions deploy $fn
}

Write-Host "Functions deployment completed."
