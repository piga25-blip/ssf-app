@echo off
rem ============================================================
rem  Application SSF - sauvegarde complete des donnees AVANT la mise a jour 14
rem  Copie le dossier %APPDATA%\Application SSF dans
rem  Documents\Sauvegarde SSF <date-heure> (rien n'est modifie ni efface).
rem  Double-clic, l'application SSF etant FERMEE.
rem ============================================================
setlocal
tasklist /FI "IMAGENAME eq Application SSF.exe" 2>nul | find /I "Application SSF.exe" >nul
if not errorlevel 1 (
  echo.
  echo L'application SSF est ouverte : fermez-la, puis relancez ce script.
  echo.
  pause
  exit /b 1
)
set "SOURCE=%APPDATA%\Application SSF"
if not exist "%SOURCE%" (
  echo.
  echo Dossier introuvable : %SOURCE%
  echo L'application SSF n'a peut-etre jamais ete utilisee sur ce PC.
  echo.
  pause
  exit /b 1
)
for /f %%d in ('powershell -NoProfile -Command "Get-Date -Format yyyy-MM-dd_HH-mm"') do set "HORODATAGE=%%d"
set "CIBLE=%USERPROFILE%\Documents\Sauvegarde SSF %HORODATAGE%"
robocopy "%SOURCE%" "%CIBLE%" /E /R:1 /W:1 /NFL /NDL /NJH /NP /XD "Cache" "Code Cache" "GPUCache" "DawnGraphiteCache" "DawnWebGPUCache" >nul
if errorlevel 8 (
  echo.
  echo ECHEC de la copie. Ne faites pas la mise a jour : appelez de l'aide.
  echo.
  pause
  exit /b 1
)
echo.
echo OK : donnees sauvegardees dans
echo    %CIBLE%
echo.
echo Notez ce chemin sur la fiche d'essai pilote.
echo.
pause
