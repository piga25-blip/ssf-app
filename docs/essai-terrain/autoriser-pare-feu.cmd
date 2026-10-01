@echo off
rem ============================================================
rem  Application SSF Reseau (test) - autorisation dans le pare-feu Windows
rem  A lancer UNE FOIS sur le PC principal (double-clic, puis "Oui").
rem  Ouvre les ports TCP 8080 a 8089 pour les autres postes du reseau,
rem  y compris sur un reseau "public" (routeur de terrain).
rem ============================================================
net session >nul 2>&1
if errorlevel 1 (
  powershell -NoProfile -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
  exit /b
)
rem Retire les regles creees par Windows (dont un eventuel "Bloquer" apres un clic sur Annuler)
netsh advfirewall firewall delete rule name="Application SSF Reseau (test)" >nul 2>&1
netsh advfirewall firewall add rule name="Application SSF Reseau (test)" dir=in action=allow protocol=TCP localport=8080-8089 profile=any
if errorlevel 1 (
  echo.
  echo ECHEC : la regle n'a pas pu etre ajoutee.
) else (
  echo.
  echo OK : les autres postes peuvent se connecter a ce PC.
)
echo.
pause
