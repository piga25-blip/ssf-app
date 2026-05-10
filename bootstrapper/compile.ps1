# compile.ps1 - Compile le bootstrapper SSF avec le NSIS d'electron-builder
# Usage : .\compile.ps1

$ErrorActionPreference = "Stop"

# Chemin vers makensis fourni par electron-builder
$makensis = "$env:LOCALAPPDATA\electron-builder\Cache\nsis\nsis-3.0.4.1\Bin\makensis.exe"

if (-not (Test-Path $makensis)) {
    Write-Error "makensis.exe introuvable : $makensis`nLancez d'abord 'npm run build' pour que electron-builder télécharge NSIS."
    exit 1
}

$script = Join-Path $PSScriptRoot "bootstrap.nsi"
Write-Host "Compilation du bootstrapper..." -ForegroundColor Cyan
Write-Host "  NSIS  : $makensis"
Write-Host "  Script: $script"
Write-Host ""

& $makensis $script

if ($LASTEXITCODE -eq 0) {
    $out = Join-Path $PSScriptRoot "SSF-Bootstrap.exe"
    $size = [math]::Round((Get-Item $out).Length / 1KB)
    Write-Host ""
    Write-Host "OK - SSF-Bootstrap.exe ($size Ko)" -ForegroundColor Green
    Write-Host "Fichier : $out"
} else {
    Write-Error "Echec de la compilation (code $LASTEXITCODE)"
    exit $LASTEXITCODE
}
