; webbai — custom NSIS additions for the Windows installer.
; Included by electron-builder (see package.json → build.nsis.include).

!include "nsDialogs.nsh"
!include "LogicLib.nsh"
!include "FileFunc.nsh"

Var WebbaiPage
Var WebbaiModel          ; ollama model tag, empty = online only
Var WebbaiModelLabel     ; friendly name
Var WebbaiModelKB        ; approximate download size in KB (for progress)
Var WebbaiRb0
Var WebbaiRb1
Var WebbaiRb2
Var WebbaiRb3
Var WebbaiRb4
Var WebbaiRb5
Var WebbaiRb6

!define WEBBAI_PBM_SETPOS     0x0402
!define WEBBAI_PBM_SETRANGE32 0x0406
!define WEBBAI_PBM_SETMARQUEE 0x040A

!macro customHeader
  ShowInstDetails show
  ShowUninstDetails show
  !ifndef MUI_WELCOMEPAGE_TITLE
    !define MUI_WELCOMEPAGE_TITLE "Welcome to webbai"
  !endif
  !ifndef MUI_WELCOMEPAGE_TEXT
    !define MUI_WELCOMEPAGE_TEXT "webbai is your AI assistant that can browse websites for you and answer questions — online and offline.$\r$\n$\r$\nSetup installs webbai and can download an AI model of your choice so the assistant works without an internet connection.$\r$\n$\r$\nClick Next to continue."
  !endif
  !ifndef MUI_FINISHPAGE_TITLE
    !define MUI_FINISHPAGE_TITLE "webbai is ready"
  !endif
  !ifndef MUI_FINISHPAGE_TEXT
    !define MUI_FINISHPAGE_TEXT "webbai has been installed on your computer.$\r$\n$\r$\nIf you chose an offline AI model, the assistant is already set to use it. You can switch models inside webbai at any time."
  !endif
!macroend

; ---------------------------------------------------------------------------
; Model chooser page
; ---------------------------------------------------------------------------
!macro customPageAfterChangeDir
  Page custom WebbaiModelPageCreate WebbaiModelPageLeave
!macroend

Function WebbaiModelPageCreate
  !insertmacro MUI_HEADER_TEXT "Choose an AI model" "Pick the AI model webbai should download and use offline."

  nsDialogs::Create 1018
  Pop $WebbaiPage
  ${If} $WebbaiPage == error
    Abort
  ${EndIf}

  ${NSD_CreateLabel} 0 0 100% 24u "Select the model to download now. Bigger models are smarter but take longer to download and need more disk space. You can always change this later inside webbai."
  Pop $0

  ${NSD_CreateRadioButton} 0 28u 100% 11u "Gemma 4 E4B — best all-round quality (about 9.6 GB)"
  Pop $WebbaiRb0
  ${NSD_CreateRadioButton} 0 41u 100% 11u "Llama 3.2 3B — fast and light (about 2 GB)"
  Pop $WebbaiRb1
  ${NSD_CreateRadioButton} 0 54u 100% 11u "Qwen 2.5 7B — strong general assistant (about 4.7 GB)"
  Pop $WebbaiRb2
  ${NSD_CreateRadioButton} 0 67u 100% 11u "Phi-4 Mini — small and quick (about 2.5 GB)"
  Pop $WebbaiRb3
  ${NSD_CreateRadioButton} 0 80u 100% 11u "Mistral 7B — balanced (about 4.4 GB)"
  Pop $WebbaiRb4
  ${NSD_CreateRadioButton} 0 93u 100% 11u "DeepSeek R1 7B — step-by-step reasoning (about 4.7 GB)"
  Pop $WebbaiRb5
  ${NSD_CreateRadioButton} 0 110u 100% 11u "Don't download anything — use webbai online only"
  Pop $WebbaiRb6

  ${NSD_Check} $WebbaiRb0

  ${NSD_CreateLabel} 0 126u 100% 20u "The model is downloaded from the internet during setup — it is not packed inside this installer, so the download you already made stayed small."
  Pop $0

  nsDialogs::Show
FunctionEnd

Function WebbaiModelPageLeave
  StrCpy $WebbaiModel ""
  StrCpy $WebbaiModelLabel ""
  StrCpy $WebbaiModelKB "0"

  ${NSD_GetState} $WebbaiRb0 $0
  ${If} $0 == ${BST_CHECKED}
    StrCpy $WebbaiModel "gemma4:e4b"
    StrCpy $WebbaiModelLabel "Gemma 4 E4B"
    StrCpy $WebbaiModelKB "10066329"
  ${EndIf}
  ${NSD_GetState} $WebbaiRb1 $0
  ${If} $0 == ${BST_CHECKED}
    StrCpy $WebbaiModel "llama3.2:3b"
    StrCpy $WebbaiModelLabel "Llama 3.2 3B"
    StrCpy $WebbaiModelKB "2097152"
  ${EndIf}
  ${NSD_GetState} $WebbaiRb2 $0
  ${If} $0 == ${BST_CHECKED}
    StrCpy $WebbaiModel "qwen2.5:7b"
    StrCpy $WebbaiModelLabel "Qwen 2.5 7B"
    StrCpy $WebbaiModelKB "4928307"
  ${EndIf}
  ${NSD_GetState} $WebbaiRb3 $0
  ${If} $0 == ${BST_CHECKED}
    StrCpy $WebbaiModel "phi4-mini"
    StrCpy $WebbaiModelLabel "Phi-4 Mini"
    StrCpy $WebbaiModelKB "2621440"
  ${EndIf}
  ${NSD_GetState} $WebbaiRb4 $0
  ${If} $0 == ${BST_CHECKED}
    StrCpy $WebbaiModel "mistral:7b"
    StrCpy $WebbaiModelLabel "Mistral 7B"
    StrCpy $WebbaiModelKB "4613734"
  ${EndIf}
  ${NSD_GetState} $WebbaiRb5 $0
  ${If} $0 == ${BST_CHECKED}
    StrCpy $WebbaiModel "deepseek-r1:7b"
    StrCpy $WebbaiModelLabel "DeepSeek R1 7B"
    StrCpy $WebbaiModelKB "4928307"
  ${EndIf}
FunctionEnd

; ---------------------------------------------------------------------------
; Download with a real progress bar on the install page
; ---------------------------------------------------------------------------
!macro customInstall
  StrCmp $WebbaiModel "" webbai_skip_model
  IfFileExists "$INSTDIR\resources\ollama\ollama.exe" 0 webbai_skip_model

  DetailPrint "Starting the local AI runtime..."
  Exec '"$INSTDIR\resources\ollama\ollama.exe" serve'
  Sleep 4000

  Delete "$PLUGINSDIR\webbai-pull.done"
  DetailPrint "Downloading $WebbaiModelLabel..."
  Exec 'cmd.exe /c ""$INSTDIR\resources\ollama\ollama.exe" pull $WebbaiModel > "$PLUGINSDIR\webbai-pull.log" 2>&1 & echo %ERRORLEVEL% > "$PLUGINSDIR\webbai-pull.done""'

  ; Grab the install page progress bar and drive it ourselves.
  FindWindow $R0 "#32770" "" $HWNDPARENT
  GetDlgItem $R1 $R0 1004
  SendMessage $R1 ${WEBBAI_PBM_SETRANGE32} 0 1000

  StrCpy $R5 "0"   ; last shown percent

  webbai_wait_loop:
    Sleep 1000
    ${GetSize} "$PROFILE\.ollama\models" "/S=0K" $R2 $R3 $R4
    ; percent = downloaded KB * 1000 / expected KB  (progress bar range 0..1000)
    System::Int64Op $R2 * 1000
    Pop $R2
    System::Int64Op $R2 / $WebbaiModelKB
    Pop $R2
    ${If} $R2 > 1000
      StrCpy $R2 "1000"
    ${EndIf}
    SendMessage $R1 ${WEBBAI_PBM_SETPOS} $R2 0

    IntOp $R6 $R2 / 10
    ${If} $R6 != $R5
      StrCpy $R5 $R6
      DetailPrint "Downloading $WebbaiModelLabel — $R5%"
    ${EndIf}

    IfFileExists "$PLUGINSDIR\webbai-pull.done" 0 webbai_wait_loop

  SendMessage $R1 ${WEBBAI_PBM_SETPOS} 1000 0

  ; Did it succeed? ollama writes the model manifest on success.
  nsExec::ExecToStack '"$INSTDIR\resources\ollama\ollama.exe" list'
  Pop $0
  Pop $1

  nsExec::Exec 'taskkill /F /IM ollama.exe /T'
  Pop $2

  ClearErrors
  ${WordFind} "$1" "$WebbaiModel" "E+1{" $3
  ${If} ${Errors}
    DetailPrint "The $WebbaiModelLabel download did not finish — you can download it later inside webbai."
    MessageBox MB_OK|MB_ICONINFORMATION "The $WebbaiModelLabel download did not finish. webbai still works online, and you can download a model later from inside the app." /SD IDOK
  ${Else}
    CreateDirectory "$APPDATA\webbai"
    FileOpen $2 "$APPDATA\webbai\webbai-local.json" w
    FileWrite $2 '{"model":"$WebbaiModel","label":"$WebbaiModelLabel","installedByInstaller":true}'
    FileClose $2
    DetailPrint "$WebbaiModelLabel is installed and ready."
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
