!include LogicLib.nsh

; Grimpad 0.6.1 and earlier claimed .bat, .cmd, .vbs and .reg, so double-clicking
; a script opened it in Grimpad instead of running it. Hand those back to Windows.
!macro GRIMPAD_RELEASE_EXT EXT
  ReadRegStr $R0 SHCTX "Software\Classes\.${EXT}" ""
  ${If} $R0 == "Grimpad Document"
    ; Repeat installs backed up Grimpad's own value, so a backup equal to it is not the original.
    ReadRegStr $R1 SHCTX "Software\Classes\.${EXT}" "Grimpad Document_backup"
    DeleteRegValue SHCTX "Software\Classes\.${EXT}" "Grimpad Document_backup"
    ${If} $R1 == ""
    ${OrIf} $R1 == "Grimpad Document"
      DeleteRegValue SHCTX "Software\Classes\.${EXT}" ""
    ${Else}
      WriteRegStr SHCTX "Software\Classes\.${EXT}" "" $R1
    ${EndIf}
  ${EndIf}
!macroend

!macro NSIS_HOOK_POSTINSTALL
  !insertmacro GRIMPAD_RELEASE_EXT "bat"
  !insertmacro GRIMPAD_RELEASE_EXT "cmd"
  !insertmacro GRIMPAD_RELEASE_EXT "vbs"
  !insertmacro GRIMPAD_RELEASE_EXT "reg"
  System::Call 'shell32::SHChangeNotify(i 0x08000000, i 0, p 0, p 0)'
!macroend
