import { loader } from "@monaco-editor/react";
import type * as Monaco from "monaco-editor";

let configured = false;
let themesReady = false;

/**
 * Load Monaco's official AMD build from /monaco/vs (copied into public/ by scripts/copy-monaco.mjs).
 * This is the setup that worked before CSP / ESM experiments.
 */
export function setupMonacoLoader(): void {
  if (configured) return;
  configured = true;

  loader.config({
    paths: {
      // Served from public/monaco/vs (dev) and dist/monaco/vs (production)
      vs: "/monaco/vs",
    },
  });
}

export function registerThemes(monaco: typeof Monaco): void {
  if (themesReady) return;
  themesReady = true;

  monaco.editor.defineTheme("grimpad-dark", {
    base: "vs-dark",
    inherit: true,
    rules: [
      { token: "comment", foreground: "6A9955" },
      { token: "string", foreground: "CE9178" },
      { token: "keyword", foreground: "569CD6" },
      { token: "number", foreground: "B5CEA8" },
      { token: "regexp", foreground: "D16969" },
      { token: "type", foreground: "4EC9B0" },
      { token: "class", foreground: "4EC9B0" },
      { token: "function", foreground: "DCDCAA" },
      { token: "variable", foreground: "9CDCFE" },
      { token: "constant", foreground: "4FC1FF" },
      { token: "tag", foreground: "569CD6" },
      { token: "attribute.name", foreground: "9CDCFE" },
      { token: "attribute.value", foreground: "CE9178" },
    ],
    colors: {
      "editor.background": "#1E1E1E",
      "editor.foreground": "#D4D4D4",
      "editor.lineHighlightBackground": "#2A2A2A",
      "editor.selectionBackground": "#264F78",
      "editorLineNumber.foreground": "#858585",
      "editorLineNumber.activeForeground": "#C6C6C6",
      "editorWidget.background": "#252526",
      "editorWidget.border": "#454545",
    },
  });

  monaco.editor.defineTheme("grimpad-light", {
    base: "vs",
    inherit: true,
    rules: [
      { token: "comment", foreground: "008000" },
      { token: "string", foreground: "A31515" },
      { token: "keyword", foreground: "0000FF" },
      { token: "number", foreground: "098658" },
      { token: "type", foreground: "267F99" },
      { token: "function", foreground: "795E26" },
      { token: "variable", foreground: "001080" },
      { token: "tag", foreground: "800000" },
    ],
    colors: {
      "editor.background": "#FFFFFF",
      "editor.foreground": "#000000",
      "editor.lineHighlightBackground": "#F3F3F3",
      "editor.selectionBackground": "#ADD6FF",
      "editorLineNumber.foreground": "#237893",
      "editorWidget.background": "#F3F3F3",
    },
  });
}

export function applyModelLanguage(
  monaco: typeof Monaco,
  model: Monaco.editor.ITextModel,
  language: string,
): void {
  if (model.isDisposed()) return;
  try {
    if (model.getLanguageId() !== language) {
      monaco.editor.setModelLanguage(model, language);
    }
  } catch (e) {
    console.warn("applyModelLanguage", language, e);
  }
}

/** Quiet TS/JS diagnostics when the TS language service is present. */
export function quietTypescriptDiagnostics(monaco: typeof Monaco): void {
  try {
    const ts = (
      monaco.languages as unknown as {
        typescript?: {
          typescriptDefaults?: { setDiagnosticsOptions: (o: object) => void };
          javascriptDefaults?: { setDiagnosticsOptions: (o: object) => void };
        };
      }
    ).typescript;
    if (!ts?.typescriptDefaults || !ts.javascriptDefaults) return;
    const opts = { noSemanticValidation: true, noSyntaxValidation: true };
    ts.typescriptDefaults.setDiagnosticsOptions(opts);
    ts.javascriptDefaults.setDiagnosticsOptions(opts);
  } catch {
    /* language service not loaded yet */
  }
}

export async function ensureMonaco(): Promise<typeof Monaco> {
  setupMonacoLoader();
  const monaco = await loader.init();
  registerThemes(monaco);
  quietTypescriptDiagnostics(monaco);
  return monaco;
}
