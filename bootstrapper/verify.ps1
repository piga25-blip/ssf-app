# Verifie que l'application est reellement installee, dans la version attendue.
# Attend d'abord la fin de l'installateur (il peut se relancer en administrateur).
# Ecrit dans -Out : "OK|<chemin de l'exe>", "AUTRE|<version trouvee>" ou "ABSENT".
param([string]$Version, [string]$Process, [string]$Out)
$fin = (Get-Date).AddMinutes(30)
while ((Get-Process -Name $Process -ErrorAction SilentlyContinue) -and (Get-Date) -lt $fin) { Start-Sleep -Seconds 1 }
$version = $Version.TrimStart("v")
$trouve = $null
$bases = @(
    [Microsoft.Win32.RegistryKey]::OpenBaseKey([Microsoft.Win32.RegistryHive]::LocalMachine, [Microsoft.Win32.RegistryView]::Registry64),
    [Microsoft.Win32.RegistryKey]::OpenBaseKey([Microsoft.Win32.RegistryHive]::CurrentUser, [Microsoft.Win32.RegistryView]::Registry64)
)
foreach ($base in $bases) {
    $racine = $base.OpenSubKey("Software\Microsoft\Windows\CurrentVersion\Uninstall")
    if (-not $racine) { continue }
    foreach ($nom in $racine.GetSubKeyNames()) {
        $cle = $racine.OpenSubKey($nom)
        $affiche = [string]$cle.GetValue("DisplayName")
        if ($affiche -notlike "Application SSF*") { continue }
        $exe = ([string]$cle.GetValue("DisplayIcon")) -replace ',\d+$', ''
        $v = [string]$cle.GetValue("DisplayVersion")
        if ($exe -and (Test-Path $exe)) {
            if ($v -eq $version) { "OK|$exe" | Set-Content $Out -Encoding Default -NoNewline; exit 0 }
            $trouve = $v
        }
    }
}
if ($trouve) { "AUTRE|$trouve" | Set-Content $Out -Encoding Default -NoNewline } else { "ABSENT" | Set-Content $Out -Encoding Default -NoNewline }
exit 1
