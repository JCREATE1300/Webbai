; webbai — custom NSIS additions for the Windows installer.
; Included by electron-builder (see package.json → build.nsis.include).

!macro customHeader
  ShowInstDetails show
  ShowUninstDetails show
  !ifndef MUI_WELCOMEPAGE_TITLE
    !define MUI_WELCOMEPAGE_TITLE "Welcome to webbai"
  !endif
  !ifndef MUI_WELCOMEPAGE_TEXT
    !define MUI_WELCOMEPAGE_TEXT "webbai is your AI assistant that can browse websites for you and answer questions — online and offline.$\r$\n$\r$\nThis setup installs webbai and can download the Gemma 4 AI model so the assistant works without an internet connection.$\r$\n$\r$\nClick Next to continue."
  !endif
  !ifndef MUI_FINISHPAGE_TITLE
    !define MUI_FINISHPAGE_TITLE "webbai is ready"
  !endif
  !ifndef MUI_FINISHPAGE_TEXT
    !define MUI_FINISHPAGE_TEXT "webbai has been installed on your computer.$\r$\n$\r$\nIf you downloaded the Gemma 4 model, the assistant will answer locally right away. Otherwise you can pick a model inside webbai at any time."
  !endif
!macroend

!macro customInstall
  ; ---- Local AI model (downloaded during setup, not bundled in the .exe) ----
  IfFileExists "$INSTDIR\resources\ollama\ollama.exe" 0 webbai_skip_model

  MessageBox MB_YESNO|MB_ICONQUESTION "Download the Gemma 4 AI model now (about 9.6 GB)?$\r$\n$\r$\nThis lets webbai answer questions offline as soon as setup finishes. It needs an internet connection and a few minutes.$\r$\n$\r$\nChoose No to pick a model later inside webbai." /SD IDYES IDNO webbai_skip_model

  DetailPrint "Starting the local AI runtime..."
  ExecShell "open" "$INSTDIR\resources\ollama\ollama.exe" "serve" SW_HIDE
  Sleep 5000

  DetailPrint "Downloading Gemma 4 E4B — this can take several minutes..."
  SetDetailsPrint listonly
  nsExec::ExecToLog '"$INSTDIR\resources\ollama\ollama.exe" pull gemma4:e4b'
  Pop $0
  SetDetailsPrint both

  nsExec::Exec 'taskkill /F /IM ollama.exe /T'
  Pop $1

  ${If} $0 == 0
    CreateDirectory "$APPDATA\webbai"
    FileOpen $2 "$APPDATA\webbai\webbai-local.json" w
    FileWrite $2 '{"model":"gemma4:e4b","installedByInstaller":true}'
    FileClose $2
    DetailPrint "Gemma 4 model installed."
  ${Else}
    DetailPrint "Model download did not finish — you can download it later inside webbai."
    MessageBox MB_OK|MB_ICONINFORMATION "The Gemma 4 download did not finish. webbai will still work online, and you can download the model later from inside the app." /SD IDOK
  ${EndIf}

  webbai_skip_model:
!macroend

!macro customUnInstall
  nsExec::Exec 'taskkill /F /IM ollama.exe /T'
  Pop $0
  MessageBox MB_YESNO|MB_ICONQUESTION "Also remove downloaded AI models (frees several GB)?" /SD IDNO IDNO webbai_keep_models
  RMDir /r "$PROFILE\.ollama\models"
  webbai_keep_models:
  Delete "$APPDATA\webbai\webbai-local.json"
!macroend
