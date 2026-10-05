; ======================================================================
; SSF Bootstrap Installer
; Télécharge et installe automatiquement la dernière version de SSF
; depuis GitHub Releases : piga25-blip/ssf-app
;
; Les traitements sont dans fetch.ps1, download.ps1 et verify.ps1
; (inclus dans l'exe), essayables séparément.
; ======================================================================

Unicode True

!define APP_NAME   "Application SSF"
!define GITHUB_API "https://api.github.com/repos/piga25-blip/ssf-app/releases/latest"
!define WORK_DIR   "$TEMP\_ssf_bootstrap"
!define SETUP_NAME "ssf-installation"
!define ICON_PATH  "..\assets\SSF.ico"
!define PS         "powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass"

; ---------- Métadonnées ----------
Name "${APP_NAME}"
OutFile "SSF-Bootstrap.exe"
InstallDir "${WORK_DIR}"
; Pas de droits administrateur ici : l'installateur téléchargé les demande lui-même
; si l'on choisit « pour tous les utilisateurs ». Sinon, avec un compte non
; administrateur, l'application s'installait dans le compte de l'administrateur.
RequestExecutionLevel user
ShowInstDetails show
SetCompressor /SOLID lzma
BrandingText " "
Caption "${APP_NAME} - Installation"

; ---------- Inclusions ----------
!include "MUI2.nsh"
!include "LogicLib.nsh"
!include "WinMessages.nsh"

Var Version   ; tag GitHub, ex. v14.0.0
Var AppExe    ; chemin de l'application installée
Var Reussi    ; 1 si l'installation est vérifiée

; ---------- Interface ----------
!define MUI_ICON "${ICON_PATH}"
!define MUI_ABORTWARNING
!define MUI_ABORTWARNING_TEXT "Annuler l'installation ?"

!define MUI_WELCOMEPAGE_TITLE "Bienvenue dans l'installation"
!define MUI_WELCOMEPAGE_TEXT "Cet assistant va télécharger et installer automatiquement la dernière version de ${APP_NAME}.$\r$\n$\r$\nUne connexion internet est requise.$\r$\n$\r$\nUne seconde fenêtre (l'installateur de l'application) s'ouvrira ensuite : suivez-la jusqu'au bout.$\r$\n$\r$\nCliquez sur Installer pour continuer."

!define MUI_FINISHPAGE_TITLE "Installation réussie !"
!define MUI_FINISHPAGE_TEXT "${APP_NAME} $Version est installée.$\r$\n$\r$\nUn raccourci « ${APP_NAME} » est sur le Bureau et dans le menu Démarrer."
!define MUI_FINISHPAGE_RUN "$AppExe"
!define MUI_FINISHPAGE_RUN_TEXT "Lancer ${APP_NAME}"
!define MUI_FINISHPAGE_NOAUTOCLOSE
!define MUI_PAGE_CUSTOMFUNCTION_PRE FinishPre

!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH
!insertmacro MUI_LANGUAGE "French"

; Page finale « réussie » seulement si l'installation est vérifiée
Function FinishPre
  ${If} $Reussi != 1
    Abort
  ${EndIf}
FunctionEnd

; ---------- Macro barre de progression ----------
!macro SetPB pct
  GetDlgItem $8 $HWNDPARENT 1004
  SendMessage $8 ${PBM_SETRANGE32} 0 100
  SendMessage $8 ${PBM_SETPOS} ${pct} 0
!macroend

!macro Echec message
  DetailPrint "ÉCHEC : l'application n'est pas installée."
  MessageBox MB_ICONSTOP "${message}" /SD IDOK
  Goto Cleanup
!macroend

; ======================================================================
; SECTION PRINCIPALE
; ======================================================================
Section "Installation" SecMain

  StrCpy $Reussi 0
  RMDir /r "${WORK_DIR}"
  CreateDirectory "${WORK_DIR}"
  SetOutPath "${WORK_DIR}"
  File "fetch.ps1"
  File "download.ps1"
  File "verify.ps1"

  !insertmacro SetPB 0

  ; ─── ÉTAPE 1 : dernière version publiée (3 essais) ──────────────────
  !insertmacro SetPB 5
  DetailPrint "Connexion à GitHub..."
  nsExec::ExecToStack '${PS} -File "${WORK_DIR}\fetch.ps1" -Dir "${WORK_DIR}" -Api "${GITHUB_API}"'
  Pop $0
  Pop $1

  ${If} ${FileExists} "${WORK_DIR}\fetch_error.txt"
    FileOpen $0 "${WORK_DIR}\fetch_error.txt" r
    FileRead $0 $R0
    FileClose $0
    !insertmacro Echec "Impossible de contacter GitHub (3 essais).$\r$\n$\r$\n$R0$\r$\n$\r$\nVérifiez la connexion internet, puis relancez SSF-Bootstrap.exe."
  ${EndIf}
  ${IfNot} ${FileExists} "${WORK_DIR}\url.txt"
    !insertmacro Echec "Impossible de contacter GitHub.$\r$\n$\r$\nVérifiez la connexion internet, puis relancez SSF-Bootstrap.exe."
  ${EndIf}

  FileOpen $0 "${WORK_DIR}\url.txt" r
  FileRead $0 $R0   ; URL de téléchargement
  FileClose $0
  FileOpen $0 "${WORK_DIR}\fname.txt" r
  FileRead $0 $R1   ; nom du fichier
  FileClose $0
  FileOpen $0 "${WORK_DIR}\ver.txt" r
  FileRead $0 $Version
  FileClose $0
  FileOpen $0 "${WORK_DIR}\size.txt" r
  FileRead $0 $R5   ; taille attendue (octets)
  FileClose $0

  !insertmacro SetPB 15
  DetailPrint "Version $Version trouvée."

  ; ─── ÉTAPE 2 : téléchargement (3 essais, taille vérifiée) ───────────
  DetailPrint "Téléchargement de $R1..."
  Exec '${PS} -WindowStyle Hidden \
    -File $\"${WORK_DIR}\download.ps1$\" \
    -Url $\"$R0$\" \
    -Dest $\"${WORK_DIR}\${SETUP_NAME}.exe$\" \
    -Size $R5 \
    -PctFile $\"${WORK_DIR}\dl_pct.txt$\" \
    -DoneFile $\"${WORK_DIR}\dl_done.txt$\" \
    -ErrFile $\"${WORK_DIR}\dl_error.txt$\"'

  ; Progression PowerShell (0-100) ramenée sur la plage 15-90
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
  ${If} ${FileExists} "${WORK_DIR}\dl_error.txt"
    FileOpen $0 "${WORK_DIR}\dl_error.txt" r
    FileRead $0 $R0
    FileClose $0
    !insertmacro Echec "Le téléchargement a échoué (3 essais).$\r$\n$\r$\n$R0$\r$\n$\r$\nVérifiez la connexion internet, puis relancez SSF-Bootstrap.exe."
  ${EndIf}
  ${IfNot} ${FileExists} "${WORK_DIR}\${SETUP_NAME}.exe"
    !insertmacro Echec "Le fichier téléchargé est introuvable.$\r$\n$\r$\nRelancez SSF-Bootstrap.exe."
  ${EndIf}

  ; ─── ÉTAPE 3 : installateur de l'application ────────────────────────
  !insertmacro SetPB 92
  DetailPrint "Téléchargement terminé. Ouverture de l'installateur..."
  ; Cette fenêtre se cache pour que l'installateur ne reste pas derrière elle
  HideWindow
  ExecWait '"${WORK_DIR}\${SETUP_NAME}.exe"' $R6
  BringToFront

  ; ─── ÉTAPE 4 : vérification réelle de l'installation ────────────────
  DetailPrint "Vérification de l'installation..."
  nsExec::ExecToStack '${PS} -File "${WORK_DIR}\verify.ps1" -Version "$Version" -Process "${SETUP_NAME}" -Out "${WORK_DIR}\verify.txt"'
  Pop $0
  Pop $1
  StrCpy $R7 "ABSENT"
  ${If} ${FileExists} "${WORK_DIR}\verify.txt"
    FileOpen $0 "${WORK_DIR}\verify.txt" r
    FileRead $0 $R7
    FileClose $0
  ${EndIf}

  StrCpy $0 $R7 3
  ${If} $0 == "OK|"
    StrCpy $AppExe $R7 "" 3
    StrCpy $Reussi 1
    !insertmacro SetPB 100
    DetailPrint "${APP_NAME} $Version est installée : $AppExe"
    Goto Cleanup
  ${EndIf}

  StrCpy $0 $R7 6
  ${If} $0 == "AUTRE|"
    StrCpy $1 $R7 "" 6
    !insertmacro Echec "L'installation de la version $Version ne s'est pas terminée (code $R6) : c'est toujours la version $1 qui est installée.$\r$\n$\r$\nRelancez SSF-Bootstrap.exe et suivez la fenêtre de l'installateur jusqu'au bouton « Fermer »."
  ${EndIf}

  !insertmacro Echec "L'installation ne s'est pas terminée (code $R6) : ${APP_NAME} n'est pas installée.$\r$\n$\r$\nLa fenêtre de l'installateur a peut-être été fermée ou annulée.$\r$\nRelancez SSF-Bootstrap.exe et suivez-la jusqu'au bouton « Fermer ».$\r$\n$\r$\nVos données (secours enregistrés) ne sont pas touchées."

  ; ─── NETTOYAGE ───────────────────────────────────────────────────────
  Cleanup:
    SetOutPath "$TEMP"
    RMDir /r "${WORK_DIR}"

SectionEnd
