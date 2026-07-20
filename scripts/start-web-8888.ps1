$ErrorActionPreference = "Stop"

function Stop-PortListeners {
  param(
    [Parameter(Mandatory = $true)]
    [int]$Port
  )

  $listeners = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
  if (-not $listeners) {
    return
  }

  $processIds = $listeners | Select-Object -ExpandProperty OwningProcess -Unique
  foreach ($processId in $processIds) {
    if ($processId -and $processId -ne $PID) {
      Stop-Process -Id $processId -Force -ErrorAction SilentlyContinue
    }
  }
}

Stop-PortListeners -Port 8888
Write-Host "Starte Website auf http://127.0.0.1:8888 ..."
npm run dev:8888 --workspace app
