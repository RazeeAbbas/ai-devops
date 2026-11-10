$ports = 3001,3002,3004,3005,3006
foreach ($port in $ports) {
  $conn = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
  if (-not $conn) { continue }
  $proc = Get-CimInstance Win32_Process -Filter "ProcessId=$($conn.OwningProcess)"
  Write-Output "PORT $port PID $($conn.OwningProcess)"
  Write-Output "CMD  $($proc.CommandLine)"
  Write-Output "---"
}
