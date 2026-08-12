import { useEffect, useRef, useState } from "react";
import Editor, { type OnMount } from "@monaco-editor/react";
import { ensureMonaco, registerThemes, setupMonacoLoader } from "../lib/monacoSetup";
import { isCodeLanguage, isMarkdownLike } from "../lib/languages";
import { useTabsStore } from "../store/tabsStore";
import { useSettingsStore } from "../store/settingsStore";
import { MarkdownFormattedEditor } from "./MarkdownFormattedEditor";

setupMonacoLoader();

function lineNumberOptions(code: boolean) {
  return {
    lineNumbers: (code ? "on" : "off") as "on" | "off",
    lineDecorationsWidth: code ? 10 : 0,
    lineNumbersMinChars: code ? 3 : 1,
    glyphMargin: false,
    renderLineHighlight: (code ? "line" : "none") as "line" | "none",
  };
}

export function EditorPane() {
  const setMonaco = useTabsStore((s) => s.setMonaco);
  const setEditor = useTabsStore((s) => s.setEditor);
  const setCursor = useTabsStore((s) => s.setCursor);
  const ensureInitialTab = useTabsStore((s) => s.ensureInitialTab);
  const activeTabId = useTabsStore((s) => s.activeTabId);
  const activeTab = useTabsStore((s) => s.tabs.find((t) => t.id === s.activeTabId) ?? null);
  const activeLanguage = activeTab?.language ?? "plaintext";
  const viewMode = activeTab?.viewMode ?? "source";
  const getModel = useTabsStore((s) => s.getModel);

  const resolvedTheme = useSettingsStore((s) => s.resolvedTheme);
  const fontSize = useSettingsStore((s) => s.fontSize);
  const wordWrap = useSettingsStore((s) => s.wordWrap);
  const showLineNumbers = isCodeLanguage(activeLanguage);

  const showFormatted =
    !!activeTabId && isMarkdownLike(activeLanguage) && viewMode === "formatted";

  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const editorRef = useRef<Parameters<OnMount>[0] | null>(null);

  useEffect(() => {
    let cancelled = false;
    ensureMonaco()
      .then(async (monaco) => {
        if (cancelled) return;
        setMonaco(monaco);

        // CLI / "Open with" / drop-on-exe paths (must run after Monaco exists)
        const { getLaunchFilePaths } = await import("../lib/launchFiles");
        const launchPaths = await getLaunchFilePaths();
        if (cancelled) return;

        const { restoreSession } = await import("../lib/session");
        const restored = await restoreSession();
        if (cancelled) return;

        if (launchPaths.length > 0) {
          // Session tabs first (if any), then open requested files and focus them
          await useTabsStore.getState().openPaths(launchPaths);
        } else if (!restored) {
          useTabsStore.getState().ensureInitialTab();
        }

        setReady(true);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        console.error(e);
        setError(e instanceof Error ? e.message : String(e));
      });
    return () => {
      cancelled = true;
    };
  }, [setMonaco]);

  const onMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;
    registerThemes(monaco);
    setMonaco(monaco);
    setEditor(editor);

    monaco.languages.typescript.typescriptDefaults.setDiagnosticsOptions({
      noSemanticValidation: true,
      noSyntaxValidation: true,
    });
    monaco.languages.typescript.javascriptDefaults.setDiagnosticsOptions({
      noSemanticValidation: true,
      noSyntaxValidation: true,
    });

    monaco.editor.setTheme(resolvedTheme === "dark" ? "grimpad-dark" : "grimpad-light");

    try {
      const defaultModel = editor.getModel();
      editor.setModel(null);
      if (defaultModel && !defaultModel.isDisposed()) {
        const ours = [...useTabsStore.getState()._models.values()];
        if (!ours.includes(defaultModel)) {
          defaultModel.dispose();
        }
      }
    } catch {
      /* ignore */
    }

    ensureInitialTab();

    const state = useTabsStore.getState();
    if (state.activeTabId) {
      const model = state.getModel(state.activeTabId);
      if (model) {
        try {
          editor.setModel(model);
        } catch (e) {
          console.warn(e);
        }
      }
    }

    editor.onDidChangeCursorPosition((e) => {
      setCursor(e.position.lineNumber, e.position.column);
    });

    const lang =
      useTabsStore.getState().tabs.find((t) => t.id === useTabsStore.getState().activeTabId)
        ?.language ?? "plaintext";
    editor.updateOptions(lineNumberOptions(isCodeLanguage(lang)));
    editor.focus();
  };

  useEffect(() => {
    const monaco = useTabsStore.getState()._monaco;
    if (!monaco) return;
    monaco.editor.setTheme(resolvedTheme === "dark" ? "grimpad-dark" : "grimpad-light");
  }, [resolvedTheme]);

  useEffect(() => {
    editorRef.current?.updateOptions({
      fontSize,
      wordWrap: wordWrap ? "on" : "off",
    });
  }, [fontSize, wordWrap]);

  useEffect(() => {
    editorRef.current?.updateOptions(lineNumberOptions(showLineNumbers));
  }, [showLineNumbers]);

  useEffect(() => {
    if (showFormatted) return;
    if (!activeTabId || !editorRef.current) return;
    const model = getModel(activeTabId);
    if (!model) return;
    try {
      if (editorRef.current.getModel() !== model) {
        editorRef.current.setModel(model);
      }
      const lang =
        useTabsStore.getState().tabs.find((t) => t.id === activeTabId)?.language ?? "plaintext";
      editorRef.current.updateOptions(lineNumberOptions(isCodeLanguage(lang)));
    } catch (e) {
      console.warn("setModel on tab switch failed", e);
    }
  }, [activeTabId, getModel, showFormatted]);

  useEffect(() => {
    return () => {
      try {
        editorRef.current?.setModel(null);
      } catch {
        /* ignore */
      }
      setEditor(null);
    };
  }, [setEditor]);

  if (error) {
    return (
      <div className="editor-pane editor-error">
        <p>
          <strong>Editor failed to load</strong>
        </p>
        <pre>{error}</pre>
      </div>
    );
  }

  if (!ready) {
    return <div className="editor-pane editor-loading">Loading editor…</div>;
  }

  if (showFormatted && activeTabId) {
    return (
      <div className="editor-pane editor-pane-md">
        <MarkdownFormattedEditor tabId={activeTabId} />
      </div>
    );
  }

  return (
    <div className="editor-pane">
      <Editor
        height="100%"
        keepCurrentModel
        theme={resolvedTheme === "dark" ? "grimpad-dark" : "grimpad-light"}
        loading={<div className="editor-loading">Starting Monaco…</div>}
        onMount={onMount}
        options={{
          fontSize,
          fontFamily:
            "'Cascadia Code', 'Cascadia Mono', Consolas, 'Courier New', monospace",
          fontLigatures: true,
          wordWrap: wordWrap ? "on" : "off",
          minimap: { enabled: false },
          scrollBeyondLastLine: false,
          smoothScrolling: true,
          cursorBlinking: "smooth",
          cursorSmoothCaretAnimation: "on",
          automaticLayout: true,
          padding: { top: 8, bottom: 8 },
          tabSize: 2,
          insertSpaces: true,
          bracketPairColorization: { enabled: true },
          matchBrackets: "always",
          find: {
            addExtraSpaceOnTop: false,
            autoFindInSelection: "never",
          },
          overviewRulerLanes: 0,
          hideCursorInOverviewRuler: true,
          quickSuggestions: false,
          suggestOnTriggerCharacters: false,
          parameterHints: { enabled: false },
          ...lineNumberOptions(showLineNumbers),
        }}
      />
    </div>
  );
}
