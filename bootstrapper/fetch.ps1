# Interroge GitHub : derniere version publiee et son installateur Windows.
# Ecrit url.txt, fname.txt, ver.txt, size.txt dans -Dir, ou fetch_error.txt en cas d'echec.
param([string]$Dir, [string]$Api)
$ErrorActionPreference = "Stop"
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$headers = @{ "User-Agent" = "SSF-Bootstrap/2.0"; "Accept" = "application/vnd.github+json" }
$derniere = ""
for ($essai = 1; $essai -le 3; $essai++) {
    try {
        $release = Invoke-RestMethod -Uri $Api -Headers $headers -TimeoutSec 30
        $asset = $release.assets | Where-Object { $_.name -match "\.exe$" -and $_.name -notmatch "blockmap" } | Select-Object -First 1
        if (-not $asset) { throw "Aucun installateur Windows (.exe) dans la derniere version publiee." }
        $asset.browser_download_url | Set-Content (Join-Path $Dir "url.txt") -Encoding ASCII -NoNewline
        $asset.name | Set-Content (Join-Path $Dir "fname.txt") -Encoding ASCII -NoNewline
        $release.tag_name | Set-Content (Join-Path $Dir "ver.txt") -Encoding ASCII -NoNewline
        "$($asset.size)" | Set-Content (Join-Path $Dir "size.txt") -Encoding ASCII -NoNewline
        exit 0
    } catch {
        $derniere = $_.Exception.Message
        if ($essai -lt 3) { Start-Sleep -Seconds 5 }
    }
}
$derniere | Set-Content (Join-Path $Dir "fetch_error.txt") -Encoding ASCII -NoNewline
exit 1
