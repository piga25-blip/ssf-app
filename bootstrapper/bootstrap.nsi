; ======================================================================
; SSF Bootstrap Installer
; Télécharge et installe automatiquement la dernière version de SSF
; depuis GitHub Releases : piga25-blip/ssf-app
; ======================================================================

Unicode True

!define APP_NAME   "Application SSF"
!define GITHUB_API "https://api.github.com/repos/piga25-blip/ssf-app/releases/latest"
!define WORK_DIR   "$TEMP\_ssf_bootstrap"
!define ICON_PATH  "..\assets\SSF.ico"

; ---------- Métadonnées ----------
Name "${APP_NAME}"
OutFile "SSF-Bootstrap.exe"
InstallDir "${WORK_DIR}"
RequestExecutionLevel admin
ShowInstDetails show
SetCompressor /SOLID lzma
BrandingText " "
Caption "${APP_NAME} - Installation"

; ---------- Inclusions ----------
!include "MUI2.nsh"
!include "LogicLib.nsh"
!include "WinMessages.nsh"

; ---------- Interface ----------
!define MUI_ICON "${ICON_PATH}"
!define MUI_ABORTWARNING
!define MUI_ABORTWARNING_TEXT "Annuler le téléchargement ?"

!define MUI_WELCOMEPAGE_TITLE "Bienvenue dans l'installation"
!define MUI_WELCOMEPAGE_TEXT "Cet assistant va télécharger et installer automatiquement la dernière version de ${APP_NAME}.$\r$\n$\r$\nUne connexion internet est requise.$\r$\n$\r$\nCliquez sur Installer pour continuer."

!define MUI_FINISHPAGE_TITLE "Installation réussie !"
!define MUI_FINISHPAGE_TEXT "${APP_NAME} a été installé avec succès."
!define MUI_FINISHPAGE_NOAUTOCLOSE

!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH
!insertmacro MUI_LANGUAGE "French"

; ---------- Macro barre de progression ----------
!macro SetPB pct
  GetDlgItem $8 $HWNDPARENT 1004
  SendMessage $8 ${PBM_SETRANGE32} 0 100
  SendMessage $8 ${PBM_SETPOS} ${pct} 0
!macroend

; ======================================================================
; SECTION PRINCIPALE
; ======================================================================
Section "Installation" SecMain

  CreateDirectory "${WORK_DIR}"
  SetOutPath "${WORK_DIR}"

  ; Initialiser la barre (mode déterminé)
  GetDlgItem $8 $HWNDPARENT 1004
  SendMessage $8 ${PBM_SETRANGE32} 0 100
  SendMessage $8 ${PBM_SETPOS} 0 0

  ; ─── ÉTAPE 1 : Récupérer l'URL depuis l'API GitHub ─────────────────
  !insertmacro SetPB 5
  DetailPrint "Connexion à GitHub..."

  FileOpen $0 "${WORK_DIR}\fetch.ps1" w
  FileWrite $0 '$$ErrorActionPreference = "Stop"$\r$\n'
  FileWrite $0 'try {$\r$\n'
  FileWrite $0 '    $$headers = @{ "User-Agent" = "SSF-Bootstrap/1.0"; "Accept" = "application/vnd.github+json" }$\r$\n'
  FileWrite $0 '    $$release = Invoke-RestMethod -Uri "${GITHUB_API}" -Headers $$headers -TimeoutSec 30$\r$\n'
  FileWrite $0 '    $$asset = $$release.assets | Where-Object { $$_.name -match "\.exe$$" -and $$_.name -notmatch "blockmap" } | Select-Object -First 1$\r$\n'
  FileWrite $0 '    if (-not $$asset) { throw "Aucun installateur .exe dans la release GitHub." }$\r$\n'
  FileWrite $0 '    $$asset.browser_download_url | Set-Content "${WORK_DIR}\url.txt" -Encoding ASCII -NoNewline$\r$\n'
  FileWrite $0 '    $$asset.name | Set-Content "${WORK_DIR}\fname.txt" -Encoding ASCII -NoNewline$\r$\n'
  FileWrite $0 '    $$release.tag_name | Set-Content "${WORK_DIR}\ver.txt" -Encoding ASCII -NoNewline$\r$\n'
  FileWrite $0 '} catch {$\r$\n'
  FileWrite $0 '    $$_.Exception.Message | Set-Content "${WORK_DIR}\fetch_error.txt" -Encoding ASCII -NoNewline$\r$\n'
  FileWrite $0 '    exit 1$\r$\n'
  FileWrite $0 '}$\r$\n'
  FileClose $0

  nsExec::ExecToStack 'powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "${WORK_DIR}\fetch.ps1"'
  Pop $0  ; code retour
  Pop $1  ; stdout (ignoré)

  ${If} ${FileExists} "${WORK_DIR}\fetch_error.txt"
    FileOpen $0 "${WORK_DIR}\fetch_error.txt" r
    FileRead $0 $R0
    FileClose $0
    MessageBox MB_ICONSTOP \
      "Impossible de contacter GitHub.$\r$\n$\r$\n$R0$\r$\n$\r$\nVérifiez votre connexion internet et réessayez." \
      /SD IDOK
    Goto Cleanup
  ${EndIf}

  ${IfNot} ${FileExists} "${WORK_DIR}\url.txt"
    MessageBox MB_ICONSTOP "Aucune URL de téléchargement trouvée. Vérifiez votre connexion." /SD IDOK
    Goto Cleanup
  ${EndIf}

  FileOpen $0 "${WORK_DIR}\url.txt"   r
  FileRead $0 $R0   ; URL de téléchargement
  FileClose $0

  FileOpen $0 "${WORK_DIR}\fname.txt" r
  FileRead $0 $R1   ; Nom du fichier
  FileClose $0

  FileOpen $0 "${WORK_DIR}\ver.txt"   r
  FileRead $0 $R2   ; Tag de version
  FileClose $0

  !insertmacro SetPB 15
  DetailPrint "Version $R2 trouvée."

  ; ─── ÉTAPE 2 : Télécharger l'installateur (progression temps réel) ──
  DetailPrint "Téléchargement de $R1..."

  ; Script PowerShell : téléchargement par chunks + écriture du % dans un fichier
  ; Write-Safe utilise FileShare.ReadWrite pour que NSIS puisse lire simultanément
  FileOpen $0 "${WORK_DIR}\download.ps1" w
  FileWrite $0 'param([string]$$Url, [string]$$Dest, [string]$$PctFile, [string]$$DoneFile, [string]$$ErrFile)$\r$\n'
  FileWrite $0 'function Write-Safe([string]$$path, [string]$$value) {$\r$\n'
  FileWrite $0 '    try {$\r$\n'
  FileWrite $0 '        $$fs = [IO.File]::Open($$path, [IO.FileMode]::Create, [IO.FileAccess]::Write, [IO.FileShare]::ReadWrite)$\r$\n'
  FileWrite $0 '        $$sw = New-Object IO.StreamWriter($$fs)$\r$\n'
  FileWrite $0 '        $$sw.Write($$value); $$sw.Flush(); $$sw.Close(); $$fs.Close()$\r$\n'
  FileWrite $0 '    } catch { }$\r$\n'
  FileWrite $0 '}$\r$\n'
  FileWrite $0 'try {$\r$\n'
  FileWrite $0 '    $$req = [System.Net.HttpWebRequest]::Create($$Url)$\r$\n'
  FileWrite $0 '    $$req.UserAgent = "SSF-Bootstrap/1.0"$\r$\n'
  FileWrite $0 '    $$req.AllowAutoRedirect = $$true$\r$\n'
  FileWrite $0 '    $$resp = $$req.GetResponse()$\r$\n'
  FileWrite $0 '    $$total = $$resp.ContentLength$\r$\n'
  FileWrite $0 '    $$stream = $$resp.GetResponseStream()$\r$\n'
  FileWrite $0 '    $$fs = [System.IO.File]::Create($$Dest)$\r$\n'
  FileWrite $0 '    $$buf = New-Object byte[] 65536$\r$\n'
  FileWrite $0 '    $$read = 0$\r$\n'
  FileWrite $0 '    while ($$true) {$\r$\n'
  FileWrite $0 '        $$n = $$stream.Read($$buf, 0, $$buf.Length)$\r$\n'
  FileWrite $0 '        if ($$n -le 0) { break }$\r$\n'
  FileWrite $0 '        $$fs.Write($$buf, 0, $$n)$\r$\n'
  FileWrite $0 '        $$read += $$n$\r$\n'
  FileWrite $0 '        if ($$total -gt 0) {$\r$\n'
  FileWrite $0 '            $$pct = [Math]::Min(100, [int]($$read * 100 / $$total))$\r$\n'
  FileWrite $0 '            Write-Safe $$PctFile "$$pct"$\r$\n'
  FileWrite $0 '        }$\r$\n'
  FileWrite $0 '    }$\r$\n'
  FileWrite $0 '    $$fs.Close(); $$stream.Close()$\r$\n'
  FileWrite $0 '    Write-Safe $$DoneFile "OK"$\r$\n'
  FileWrite $0 '} catch {$\r$\n'
  FileWrite $0 '    Write-Safe $$ErrFile $$_.Exception.Message$\r$\n'
  FileWrite $0 '    Write-Safe $$DoneFile "ERR"$\r$\n'
  FileWrite $0 '}$\r$\n'
  FileClose $0

  ; Supprimer les fichiers de contrôle éventuellement résiduels
  Delete "${WORK_DIR}\dl_pct.txt"
  Delete "${WORK_DIR}\dl_done.txt"
  Delete "${WORK_DIR}\dl_error.txt"

  ; Lancer le téléchargement en arrière-plan (non bloquant)
  ; $\" = guillemet double littéral dans NSIS (pour supporter les espaces dans les chemins)
  Exec 'powershell.exe -NoProfile -NonInteractive -WindowStyle Hidden -ExecutionPolicy Bypass \
    -File $\"${WORK_DIR}\download.ps1$\" \
    -Url $\"$R0$\" \
    -Dest $\"${WORK_DIR}\setup.exe$\" \
    -PctFile $\"${WORK_DIR}\dl_pct.txt$\" \
    -DoneFile $\"${WORK_DIR}\dl_done.txt$\" \
    -ErrFile $\"${WORK_DIR}\dl_error.txt$\"'

  ; Polling : mise à jour de la barre jusqu'à la fin du téléchargement
  ; La progression PowerShell (0-100) est mappée sur la plage NSIS 15-90
  poll_loop:
    ${If} ${FileExists} "${WORK_DIR}\dl_done.txt"
      Goto download_done
    ${EndIf}

    ${If} ${FileExists} "${WORK_DIR}\dl_pct.txt"
      FileOpen $0 "${WORK_DIR}\dl_pct.txt" r
      FileRead $0 $R3
      FileClose $0
      IntOp $R4 $R3 * 75
      IntOp $R4 $R4 / 100
      IntOp $R4 $R4 + 15
      GetDlgItem $8 $HWNDPARENT 1004
      SendMessage $8 ${PBM_SETPOS} $R4 0
    ${EndIf}

    Sleep 300
    Goto poll_loop

  download_done:

  ; Vérifier les erreurs de téléchargement
  ${If} ${FileExists} "${WORK_DIR}\dl_error.txt"
    FileOpen $0 "${WORK_DIR}\dl_error.txt" r
    FileRead $0 $R0
    FileClose $0
    MessageBox MB_ICONSTOP "Erreur lors du téléchargement.$\r$\n$\r$\n$R0" /SD IDOK
    Goto Cleanup
  ${EndIf}

  ${IfNot} ${FileExists} "${WORK_DIR}\setup.exe"
    MessageBox MB_ICONSTOP "Le fichier téléchargé est introuvable." /SD IDOK
    Goto Cleanup
  ${EndIf}

  !insertmacro SetPB 92
  DetailPrint "Téléchargement terminé. Lancement de l'installation..."

  ; ─── ÉTAPE 3 : Lancer l'installateur téléchargé ─────────────────────
  ExecWait '"${WORK_DIR}\setup.exe"' $0

  !insertmacro SetPB 100
  DetailPrint "Terminé."
  Goto Cleanup

  ; ─── NETTOYAGE ───────────────────────────────────────────────────────
  Cleanup:
    Delete "${WORK_DIR}\*.ps1"
    Delete "${WORK_DIR}\*.txt"
    Delete "${WORK_DIR}\setup.exe"
    RMDir "${WORK_DIR}"

SectionEnd
