# deploy.ps1
# Automates the entire deployment process for Atylla Pro PWA

param(
    [string]$Version = $null
)

$ErrorActionPreference = "Stop"

# 1. Update version if provided
if ($Version) {
    Write-Host "Updating version to $Version..." -ForegroundColor Cyan
    # Update frontend/src/version.js
    "export const APP_VERSION = '$Version';" | Set-Content "frontend/src/version.js"
    
    # Update package.json version
    $packageJsonPath = "frontend/package.json"
    $packageJson = Get-Content $packageJsonPath | ConvertFrom-Json
    $packageJson.version = $Version
    $packageJson | ConvertTo-Json -Depth 10 | Set-Content $packageJsonPath

    # Update app.json version
    $appJsonPath = "frontend/app.json"
    $appJson = Get-Content $appJsonPath -Raw | ConvertFrom-Json
    $appJson.expo.version = $Version
    $appJson | ConvertTo-Json -Depth 10 | Set-Content $appJsonPath

    # Update backend/main.py version
    $mainPyPath = "backend/main.py"
    $mainPyContent = Get-Content $mainPyPath -Raw
    $mainPyContent = $mainPyContent -replace 'version="[^"]+"', "version=`"$Version`""
    $mainPyContent | Set-Content $mainPyPath
}

# Read current version from frontend/src/version.js
$versionFileContent = Get-Content "frontend/src/version.js" -Raw
if ($versionFileContent -match "export const APP_VERSION = '([^']+)';") {
    $currentVersion = $Matches[1]
} else {
    Write-Error "Could not read version from frontend/src/version.js"
}

Write-Host "Current version: $currentVersion" -ForegroundColor Green

# 2. Build Expo PWA
Write-Host "Building Expo PWA..." -ForegroundColor Cyan
Push-Location frontend
try {
    npx expo export --platform web
} finally {
    Pop-Location
}

# 3. Locate the new bundle index-*.js
$jsDir = "frontend/dist/_expo/static/js/web"
$jsFile = Get-ChildItem -Path $jsDir -Filter "index-*.js" | Select-Object -First 1
if (-not $jsFile) {
    Write-Error "Could not find index-*.js in $jsDir"
}
$newBundleName = $jsFile.Name
Write-Host "Found new bundle: $newBundleName" -ForegroundColor Green

# 4. Copy build to backend (merging to keep old bundles active for cached clients)
Write-Host "Copying build to backend..." -ForegroundColor Cyan
if (-not (Test-Path "backend/static/_expo")) {
    New-Item -ItemType Directory -Path "backend/static/_expo" -Force
}
Copy-Item -Path "frontend/dist/_expo\*" -Destination "backend/static/_expo" -Recurse -Force

Write-Host "Copying PWA assets to backend..." -ForegroundColor Cyan
Copy-Item -Path "frontend/assets/apple-touch-icon.png" -Destination "backend/static/" -ErrorAction SilentlyContinue
Copy-Item -Path "frontend/assets/icon-192.png" -Destination "backend/static/" -ErrorAction SilentlyContinue
Copy-Item -Path "frontend/assets/icon-512.png" -Destination "backend/static/" -ErrorAction SilentlyContinue
Copy-Item -Path "frontend/assets/manifest.json" -Destination "backend/static/" -ErrorAction SilentlyContinue

# 5. Update index.html reference to the bundle
Write-Host "Updating index.html script tag..." -ForegroundColor Cyan
$indexHtmlPath = "backend/static/index.html"
$indexHtml = Get-Content $indexHtmlPath -Raw
# Replace index-*.js reference
$indexHtml = $indexHtml -replace 'src="/_expo/static/js/web/index-[a-f0-9]+\.js"', "src=`"/_expo/static/js/web/$newBundleName`""
$indexHtml | Set-Content $indexHtmlPath

# 6. Update sw.js cache name
Write-Host "Updating sw.js cache name..." -ForegroundColor Cyan
$swPath = "backend/static/sw.js"
if (Test-Path $swPath) {
    $swContent = Get-Content $swPath -Raw
    $swContent = $swContent -replace "const CACHE_NAME = 'atylla-pro-v[^']+';", "const CACHE_NAME = 'atylla-pro-v$currentVersion';"
    $swContent | Set-Content $swPath
} else {
    Write-Host "sw.js not found, skipping..." -ForegroundColor Yellow
}

# 7. Git commit, tag & push
Write-Host "Staging, committing, tagging, and pushing changes..." -ForegroundColor Cyan

# Commit frontend changes
Push-Location frontend
git add -A
$frontStatus = git status --porcelain
if ($frontStatus) {
    git commit -m "v$currentVersion - deployment"
}
Pop-Location

# Commit root changes
git add backend/static frontend deploy.ps1
$rootStatus = git status --porcelain
if ($rootStatus) {
    git commit -m "v$currentVersion - deployment"
}

# Tag and push
# Remove old tag if it exists to allow re-tagging the same version
$oldPreference = $ErrorActionPreference
$ErrorActionPreference = "Continue"
git tag -d "v$currentVersion" 2>$null
git tag "v$currentVersion" 2>$null
git tag -d "backup-v$currentVersion" 2>$null
git tag "backup-v$currentVersion" 2>$null
git branch -D "backup/v$currentVersion" 2>$null
git branch "backup/v$currentVersion" 2>$null
$ErrorActionPreference = $oldPreference

Write-Host "Pushing to GitHub..." -ForegroundColor Cyan
git push origin master --tags --force

Write-Host "Deployment of v$currentVersion completed successfully!" -ForegroundColor Green
