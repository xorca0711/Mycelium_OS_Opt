[CmdletBinding()]
param([switch]$StopServer)

$ErrorActionPreference = 'Stop'
$appDirectory = Split-Path -Parent $PSScriptRoot
$appExecutable = Join-Path $appDirectory 'src-tauri\target\debug\Mycelium.exe'
$viteEntry = Join-Path $appDirectory 'node_modules\vite\bin\vite.js'
$launchDirectory = Join-Path $appDirectory 'build\launcher'
$stateFile = Join-Path $launchDirectory 'server.json'

function Get-ManagedServer {
    if (-not (Test-Path -LiteralPath $stateFile)) { return $null }
    try {
        $saved = Get-Content -LiteralPath $stateFile -Raw | ConvertFrom-Json
        $process = Get-Process -Id $saved.processId -ErrorAction Stop
        if ($process.Path -eq $saved.executable -and
            $process.StartTime.ToUniversalTime().ToString('o') -eq $saved.startedAt) {
            return $process
        }
    } catch { }
    return $null
}

$server = Get-ManagedServer
if ($StopServer) {
    $openApps = @(Get-Process -Name Mycelium -ErrorAction SilentlyContinue |
        Where-Object { $_.Path -eq $appExecutable })
    if ($openApps.Count -gt 0) { throw 'Close the Mycelium windows before stopping their local server.' }
    if ($server) {
        Stop-Process -Id $server.Id -ErrorAction Stop
        Remove-Item -LiteralPath $stateFile -ErrorAction SilentlyContinue
        Write-Host 'Mycelium local server stopped.'
    } else { Write-Host 'No server started by this launcher is running.' }
    exit 0
}

if (-not (Test-Path -LiteralPath $appExecutable)) {
    throw 'The native executable has not been built. In the app folder, run pnpm tauri dev once, then retry.'
}
if (-not (Test-Path -LiteralPath $viteEntry)) {
    throw 'Dependencies are missing. In the app folder, run pnpm install --frozen-lockfile first.'
}

$startedHere = $false
try {
    if (-not $server) {
        $listener = Get-NetTCPConnection -State Listen -LocalPort 1420 -ErrorAction SilentlyContinue
        if ($listener) { throw 'Port 1420 is already used by another server. Close that development command before using this launcher.' }
        $nodeCommand = Get-Command node.exe -ErrorAction SilentlyContinue
        $nodeExecutable = if ($nodeCommand) { $nodeCommand.Source } else { Join-Path $env:ProgramFiles 'nodejs\node.exe' }
        if (-not (Test-Path -LiteralPath $nodeExecutable)) { throw 'Node.js was not found. Install Node 24 and reopen your terminal.' }
        New-Item -ItemType Directory -Path $launchDirectory -Force | Out-Null
        $server = Start-Process -FilePath $nodeExecutable -ArgumentList ('"{0}" --host 127.0.0.1 --port 1420 --strictPort' -f $viteEntry) `
            -WorkingDirectory $appDirectory -WindowStyle Hidden -PassThru `
            -RedirectStandardOutput (Join-Path $launchDirectory 'vite-output.log') `
            -RedirectStandardError (Join-Path $launchDirectory 'vite-error.log')
        $startedHere = $true
        @{ processId = $server.Id; executable = $server.Path; startedAt = $server.StartTime.ToUniversalTime().ToString('o') } |
            ConvertTo-Json | Set-Content -LiteralPath $stateFile -Encoding UTF8
    }
    $ready = $false
    $deadline = (Get-Date).AddSeconds(45)
    while ((Get-Date) -lt $deadline) {
        $server.Refresh()
        if ($server.HasExited) { throw "The local server exited. See $launchDirectory\vite-error.log" }
        try {
            $response = Invoke-WebRequest -Uri 'http://127.0.0.1:1420/' -UseBasicParsing -TimeoutSec 2
            if ($response.StatusCode -eq 200) { $ready = $true; break }
        } catch { }
        Start-Sleep -Milliseconds 250
    }
    if (-not $ready) { throw "The local server did not become ready. See $launchDirectory\vite-error.log" }
    $application = Start-Process -FilePath $appExecutable -WorkingDirectory $appDirectory -PassThru
    Write-Host "Opened Mycelium (process $($application.Id))."
    Write-Host 'The local server stays running for quick reopening. No terminal needs to stay open.'
    Write-Host 'After closing all Mycelium windows, run this script with -StopServer to stop it.'
} catch {
    if ($startedHere -and (Get-ManagedServer)) {
        Stop-Process -Id $server.Id -ErrorAction SilentlyContinue
        Remove-Item -LiteralPath $stateFile -ErrorAction SilentlyContinue
    }
    Write-Error $_
    exit 1
}
