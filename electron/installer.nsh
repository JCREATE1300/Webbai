; webbai — custom NSIS additions for the Windows installer.
; Included by electron-builder (see package.json -> build.nsis.include).
; AI models are NOT downloaded during setup; webbai asks for one on first use.

!macro customHeader
  ShowInstDetails show
  ShowUninstDetails show
  !ifndef MUI_WELCOMEPAGE_TITLE
    !define MUI_WELCOMEPAGE_TITLE "Welcome to webbai"
  !endif
  !ifndef MUI_WELCOMEPAGE_TEXT
    !define MUI_WELCOMEPAGE_TEXT "webbai is your AI assistant that can browse websites for you, see your screen and answer questions.$\r$\n$\r$\nAfter setup, pick and download any AI model right inside webbai."
  !endif
  !ifndef MUI_FINISHPAGE_TITLE
    !define MUI_FINISHPAGE_TITLE "webbai is ready"
  !endif
  !ifndef MUI_FINISHPAGE_TEXT
    !define MUI_FINISHPAGE_TEXT "webbai has been installed.$\r$\n$\r$\nThe first time you ask a question, webbai will let you choose an AI model to download."
  !endif
!macroend

!macro customUnInstall
  nsExec::Exec 'taskkill /F /IM ollama.exe /T'
  Pop $0
  MessageBox MB_YESNO|MB_ICONQUESTION "Also remove downloaded AI models (frees several GB)?" /SD IDNO IDNO webbai_keep_models
  RMDir /r "$PROFILE\.ollama\models"
webbai_keep_models:
  Delete "$APPDATA\webbai\webbai-local.json"
!macroend
