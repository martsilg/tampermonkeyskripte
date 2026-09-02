<#
.SYNOPSIS
  Erhoeht den Patch-Level in @version im Tampermonkey-Header, committet und pusht.

.PARAMETER Message
  Commit-Message. Default: "update".

.PARAMETER File
  Skriptdatei, deren @version gepatcht wird. Default: "Mobile Ticket-Detailansicht.user.js".

.EXAMPLE
  ./bump.ps1
  ./bump.ps1 "Swipe-Geste verfeinert"
#>
param(
    [Parameter(Position = 0)]
    [string]$Message = "update",

    [string]$File = "Mobile Ticket-Detailansicht.user.js"
)

$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $scriptDir

if (-not (Test-Path $File)) {
    Write-Error "Datei nicht gefunden: $File"
    exit 1
}

$content = Get-Content -Path $File -Raw -Encoding UTF8

$versionPattern = '(?m)^(// @version\s+)(\d+)\.(\d+)\.(\d+)\s*$'
$match = [regex]::Match($content, $versionPattern)

if (-not $match.Success) {
    Write-Error "Kein @version-Header im Format X.Y.Z gefunden in $File"
    exit 1
}

$major = [int]$match.Groups[2].Value
$minor = [int]$match.Groups[3].Value
$patch = [int]$match.Groups[4].Value + 1

$oldVersion = "$major.$($match.Groups[3].Value).$($match.Groups[4].Value)"
$newVersion = "$major.$minor.$patch"

$replacement = '${1}' + $newVersion
$newContent = [regex]::Replace($content, $versionPattern, $replacement)
Set-Content -Path $File -Value $newContent -Encoding utf8 -NoNewline

Write-Host "Version: $oldVersion -> $newVersion" -ForegroundColor Cyan

git add -A

git diff --cached --quiet
$hasChanges = ($LASTEXITCODE -ne 0)

if ($hasChanges) {
    git commit -m "$Message (v$newVersion)"
    git push origin main
    Write-Host "Gepusht: $Message (v$newVersion)" -ForegroundColor Green
} else {
    Write-Host "Keine Aenderungen zum Committen." -ForegroundColor Yellow
}
