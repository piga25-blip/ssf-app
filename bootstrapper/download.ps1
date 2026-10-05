# Telecharge l'installateur (3 essais), ecrit l'avancement (0-100) dans -PctFile,
# verifie la taille complete, puis ecrit OK ou ERR dans -DoneFile (message dans -ErrFile).
param([string]$Url, [string]$Dest, [long]$Size, [string]$PctFile, [string]$DoneFile, [string]$ErrFile)
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
function Write-Safe([string]$path, [string]$value) {
    try {
        $fs = [IO.File]::Open($path, [IO.FileMode]::Create, [IO.FileAccess]::Write, [IO.FileShare]::ReadWrite)
        $sw = New-Object IO.StreamWriter($fs)
        $sw.Write($value); $sw.Flush(); $sw.Close(); $fs.Close()
    } catch { }
}
$derniere = ""
for ($essai = 1; $essai -le 3; $essai++) {
    $fs = $null; $stream = $null
    try {
        Write-Safe $PctFile "0"
        $req = [System.Net.HttpWebRequest]::Create($Url)
        $req.UserAgent = "SSF-Bootstrap/2.0"
        $req.AllowAutoRedirect = $true
        $req.Timeout = 60000
        $req.ReadWriteTimeout = 60000
        $resp = $req.GetResponse()
        $total = $resp.ContentLength
        if ($Size -gt 0) { $total = $Size }
        $stream = $resp.GetResponseStream()
        $fs = [System.IO.File]::Create($Dest)
        $buf = New-Object byte[] 65536
        $read = 0
        while ($true) {
            $n = $stream.Read($buf, 0, $buf.Length)
            if ($n -le 0) { break }
            $fs.Write($buf, 0, $n)
            $read += $n
            if ($total -gt 0) { Write-Safe $PctFile ([Math]::Min(100, [int]($read * 100 / $total))) }
        }
        $fs.Close(); $fs = $null; $stream.Close(); $stream = $null
        if ($Size -gt 0 -and $read -ne $Size) {
            throw "Telechargement incomplet ($([Math]::Round($read/1MB)) Mo recus sur $([Math]::Round($Size/1MB)) Mo)."
        }
        Write-Safe $DoneFile "OK"
        exit 0
    } catch {
        $derniere = $_.Exception.Message
        if ($fs) { $fs.Close() }
        if ($stream) { $stream.Close() }
        Remove-Item $Dest -ErrorAction SilentlyContinue
        if ($essai -lt 3) { Start-Sleep -Seconds 5 }
    }
}
Write-Safe $ErrFile $derniere
Write-Safe $DoneFile "ERR"
exit 1
