; Grimpad registers itself on the Open with list only. It never sets itself
; as the default app for a file type. Tauri's built-in fileAssociations
; always takes the default, so Grimpad does its own registration here.

!define GRIMPAD_PROGID "Grimpad Document"

!macro GRIMPAD_EXTENSIONS MACRO
  !insertmacro ${MACRO} "txt"
  !insertmacro ${MACRO} "text"
  !insertmacro ${MACRO} "log"
  !insertmacro ${MACRO} "nfo"
  !insertmacro ${MACRO} "inf"
  !insertmacro ${MACRO} "ini"
  !insertmacro ${MACRO} "cfg"
  !insertmacro ${MACRO} "conf"
  !insertmacro ${MACRO} "nsh"
  !insertmacro ${MACRO} "properties"
  !insertmacro ${MACRO} "md"
  !insertmacro ${MACRO} "markdown"
  !insertmacro ${MACRO} "mdx"
  !insertmacro ${MACRO} "mdown"
  !insertmacro ${MACRO} "rst"
  !insertmacro ${MACRO} "tex"
  !insertmacro ${MACRO} "json"
  !insertmacro ${MACRO} "jsonc"
  !insertmacro ${MACRO} "json5"
  !insertmacro ${MACRO} "js"
  !insertmacro ${MACRO} "mjs"
  !insertmacro ${MACRO} "cjs"
  !insertmacro ${MACRO} "jsx"
  !insertmacro ${MACRO} "ts"
  !insertmacro ${MACRO} "mts"
  !insertmacro ${MACRO} "cts"
  !insertmacro ${MACRO} "tsx"
  !insertmacro ${MACRO} "html"
  !insertmacro ${MACRO} "htm"
  !insertmacro ${MACRO} "xhtml"
  !insertmacro ${MACRO} "css"
  !insertmacro ${MACRO} "scss"
  !insertmacro ${MACRO} "sass"
  !insertmacro ${MACRO} "less"
  !insertmacro ${MACRO} "xml"
  !insertmacro ${MACRO} "svg"
  !insertmacro ${MACRO} "xsl"
  !insertmacro ${MACRO} "xslt"
  !insertmacro ${MACRO} "xsd"
  !insertmacro ${MACRO} "dtd"
  !insertmacro ${MACRO} "plist"
  !insertmacro ${MACRO} "yaml"
  !insertmacro ${MACRO} "yml"
  !insertmacro ${MACRO} "toml"
  !insertmacro ${MACRO} "py"
  !insertmacro ${MACRO} "pyw"
  !insertmacro ${MACRO} "pyi"
  !insertmacro ${MACRO} "rs"
  !insertmacro ${MACRO} "go"
  !insertmacro ${MACRO} "java"
  !insertmacro ${MACRO} "kt"
  !insertmacro ${MACRO} "kts"
  !insertmacro ${MACRO} "cs"
  !insertmacro ${MACRO} "fs"
  !insertmacro ${MACRO} "fsx"
  !insertmacro ${MACRO} "cpp"
  !insertmacro ${MACRO} "cxx"
  !insertmacro ${MACRO} "cc"
  !insertmacro ${MACRO} "c"
  !insertmacro ${MACRO} "h"
  !insertmacro ${MACRO} "hpp"
  !insertmacro ${MACRO} "hxx"
  !insertmacro ${MACRO} "m"
  !insertmacro ${MACRO} "mm"
  !insertmacro ${MACRO} "rb"
  !insertmacro ${MACRO} "php"
  !insertmacro ${MACRO} "phtml"
  !insertmacro ${MACRO} "pl"
  !insertmacro ${MACRO} "pm"
  !insertmacro ${MACRO} "sh"
  !insertmacro ${MACRO} "bash"
  !insertmacro ${MACRO} "zsh"
  !insertmacro ${MACRO} "ps1"
  !insertmacro ${MACRO} "psm1"
  !insertmacro ${MACRO} "psd1"
  !insertmacro ${MACRO} "bat"
  !insertmacro ${MACRO} "cmd"
  !insertmacro ${MACRO} "vbs"
  !insertmacro ${MACRO} "sql"
  !insertmacro ${MACRO} "r"
  !insertmacro ${MACRO} "lua"
  !insertmacro ${MACRO} "swift"
  !insertmacro ${MACRO} "dart"
  !insertmacro ${MACRO} "vue"
  !insertmacro ${MACRO} "svelte"
  !insertmacro ${MACRO} "graphql"
  !insertmacro ${MACRO} "gql"
  !insertmacro ${MACRO} "proto"
  !insertmacro ${MACRO} "csv"
  !insertmacro ${MACRO} "tsv"
  !insertmacro ${MACRO} "diff"
  !insertmacro ${MACRO} "patch"
  !insertmacro ${MACRO} "cmake"
  !insertmacro ${MACRO} "mk"
  !insertmacro ${MACRO} "asm"
  !insertmacro ${MACRO} "env"
  !insertmacro ${MACRO} "gitignore"
  !insertmacro ${MACRO} "gitattributes"
  !insertmacro ${MACRO} "editorconfig"
  !insertmacro ${MACRO} "htaccess"
  !insertmacro ${MACRO} "npmrc"
  !insertmacro ${MACRO} "srt"
  !insertmacro ${MACRO} "vtt"
  !insertmacro ${MACRO} "reg"
!macroend

; Installers up to 0.6 set "Grimpad Document" as the default for every type
; above and saved the old value as "Grimpad Document_backup". A second
; install backed up Grimpad itself. Put back a real previous default, or
; drop the per-user value so the Windows default (batfile, txtfile, ...)
; applies again.
!macro GRIMPAD_RELEASE_DEFAULT EXT
  ReadRegStr $R0 SHCTX "Software\Classes\.${EXT}" ""
  ${If} $R0 == "${GRIMPAD_PROGID}"
    ReadRegStr $R1 SHCTX "Software\Classes\.${EXT}" "${GRIMPAD_PROGID}_backup"
    ${If} $R1 != ""
    ${AndIf} $R1 != "${GRIMPAD_PROGID}"
      WriteRegStr SHCTX "Software\Classes\.${EXT}" "" "$R1"
    ${Else}
      DeleteRegValue SHCTX "Software\Classes\.${EXT}" ""
    ${EndIf}
  ${EndIf}
  DeleteRegValue SHCTX "Software\Classes\.${EXT}" "${GRIMPAD_PROGID}_backup"
!macroend

!macro GRIMPAD_ADD_OPEN_WITH EXT
  !insertmacro GRIMPAD_RELEASE_DEFAULT "${EXT}"
  WriteRegStr SHCTX "Software\Classes\.${EXT}\OpenWithProgids" "${GRIMPAD_PROGID}" ""
!macroend

!macro GRIMPAD_REMOVE_OPEN_WITH EXT
  !insertmacro GRIMPAD_RELEASE_DEFAULT "${EXT}"
  DeleteRegValue SHCTX "Software\Classes\.${EXT}\OpenWithProgids" "${GRIMPAD_PROGID}"
!macroend

!macro NSIS_HOOK_POSTINSTALL
  Push $R0
  Push $R1
  WriteRegStr SHCTX "Software\Classes\${GRIMPAD_PROGID}" "" "Grimpad Document"
  WriteRegStr SHCTX "Software\Classes\${GRIMPAD_PROGID}\DefaultIcon" "" "$\"$INSTDIR\${MAINBINARYNAME}.exe$\",0"
  WriteRegStr SHCTX "Software\Classes\${GRIMPAD_PROGID}\shell" "" "open"
  WriteRegStr SHCTX "Software\Classes\${GRIMPAD_PROGID}\shell\open" "" "Open with ${PRODUCTNAME}"
  WriteRegStr SHCTX "Software\Classes\${GRIMPAD_PROGID}\shell\open\command" "" "$\"$INSTDIR\${MAINBINARYNAME}.exe$\" $\"%1$\""
  !insertmacro GRIMPAD_EXTENSIONS GRIMPAD_ADD_OPEN_WITH
  !insertmacro UPDATEFILEASSOC
  Pop $R1
  Pop $R0
!macroend

!macro NSIS_HOOK_PREUNINSTALL
  Push $R0
  Push $R1
  !insertmacro GRIMPAD_EXTENSIONS GRIMPAD_REMOVE_OPEN_WITH
  DeleteRegKey SHCTX "Software\Classes\${GRIMPAD_PROGID}"
  !insertmacro UPDATEFILEASSOC
  Pop $R1
  Pop $R0
!macroend
