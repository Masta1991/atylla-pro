# Prepare a local build from the project root.
# It never commits, tags, pushes, copies to backend/static, or applies SQL.
[CmdletBinding()]
param(
    [string]$Version,
    [string]$ApiBaseUrl = 'http://127.0.0.1:8000'
)
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
$projectRoot = Split-Path -Parent $PSScriptRoot
Push-Location $projectRoot
$previousApi = $env:EXPO_PUBLIC_API_URL
$previousOffline = $env:EXPO_OFFLINE
$previousTelemetry = $env:EXPO_NO_TELEMETRY
$previousCI = $env:CI
try {
    $package = Get-Content -LiteralPath 'frontend/package.json' -Raw -Encoding UTF8 | ConvertFrom-Json
    $currentVersion = $package.version
    if ($Version -and $Version -ne $currentVersion) {
        throw "Version must match reviewed source ($currentVersion). Update version files before preparing artifacts."
    }
    if ($currentVersion -notmatch '^\d+\.\d+\.\d+$') { throw 'Invalid source version.' }
    $uri = [Uri]$ApiBaseUrl
    if (-not $uri.IsAbsoluteUri -or $uri.Scheme -notin @('http','https')) { throw 'Invalid API URL.' }

    & '.\.venv\Scripts\python.exe' '-B' 'skills/atylla_test_harness/harness.py' '--postgres'
    if ($LASTEXITCODE -ne 0) { throw 'Regression tests failed. Build stopped.' }

    # A unique output prevents a failed build from publishing stale artifacts.
    $output = Join-Path $projectRoot ('.tmp/local-build-' + $currentVersion + '-' + [Guid]::NewGuid().ToString('N'))
    $env:EXPO_PUBLIC_API_URL = $ApiBaseUrl
    $env:EXPO_OFFLINE = '1'
    $env:EXPO_NO_TELEMETRY = '1'
    $env:CI = '1'
    Push-Location (Join-Path $projectRoot 'frontend')
    try {
        & '.\node_modules\.bin\expo.cmd' 'export' '--platform' 'web' '--clear' '--output-dir' $output
        if ($LASTEXITCODE -ne 0) { throw 'Expo build failed. No artifacts will be promoted.' }
    } finally { Pop-Location }

    if (-not (Test-Path -LiteralPath (Join-Path $output 'index.html'))) { throw 'Missing built index.html.' }
    $bundles = @(Get-ChildItem -LiteralPath (Join-Path $output '_expo/static/js/web') -Filter '*.js' -File)
    if ($bundles.Count -eq 0) { throw 'Missing JavaScript bundle.' }
    Write-Host "Local build prepared: $output"
    Write-Host "API target: $ApiBaseUrl"
    Write-Host 'Railway and backend/static were not changed. Release requires a separate approved workflow.'
} finally {
    $env:EXPO_PUBLIC_API_URL = $previousApi
    $env:EXPO_OFFLINE = $previousOffline
    $env:EXPO_NO_TELEMETRY = $previousTelemetry
    $env:CI = $previousCI
    Pop-Location
}
