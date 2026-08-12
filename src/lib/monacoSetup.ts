import { loader } from "@monaco-editor/react";
import * as monaco from "monaco-editor";
// 0.56 exports remap monaco-editor/X → esm/vs/X (not esm/vs/esm/vs/X)
import editorWorker from "monaco-editor/editor/editor.worker?worker&inline";
import jsonWorker from "monaco-editor/language/json/json.worker?worker&inline";
import cssWorker from "monaco-editor/language/css/css.worker?worker&inline";
import htmlWorker from "monaco-editor/language/html/html.worker?worker&inline";
import tsWorker from "monaco-editor/language/typescript/ts.worker?worker&inline";

let configured = false;
let themesReady = false;

type MonacoApi = typeof monaco;

/**
 * Vite bundles workers as blobs/assets. That works in `tauri dev` (HTTP)
 * and in the packaged exe (tauri.localhost) — unlike AMD /monaco/vs.
 */
function installMonacoWorkers(): void {
  const g = globalThis as typeof globalThis & {
    MonacoEnvironment?: { getWorker: (_id: string, label: string) => Worker };
  };
  if (g.MonacoEnvironment) return;
  g.MonacoEnvironment = {
    getWorker(_id: string, label: string) {
      if (label === "json") return new jsonWorker();
      if (label === "css" || label === "scss" || label === "less") return new cssWorker();
      if (label === "html" || label === "handlebars" || label === "razor") {
        return new htmlWorker();
      }
      if (label === "typescript" || label === "javascript") return new tsWorker();
      return new editorWorker();
    },
  };
}

export function setupMonacoLoader(): void {
  if (configured) return;
  configured = true;
  installMonacoWorkers();
  loader.config({ monaco });
}

export function registerThemes(m: MonacoApi): void {
  if (themesReady) return;
  themesReady = true;

  m.editor.defineTheme("grimpad-dark", {
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

  m.editor.defineTheme("grimpad-light", {
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
  m: MonacoApi,
  model: monaco.editor.ITextModel,
  language: string,
): void {
  if (model.isDisposed()) return;
  try {
    if (model.getLanguageId() !== language) {
      m.editor.setModelLanguage(model, language);
    }
  } catch (e) {
    console.warn("applyModelLanguage", language, e);
  }
}

/** Quiet TS/JS diagnostics when the TS language service is present. */
export function quietTypescriptDiagnostics(m: MonacoApi): void {
  try {
    const ts = (
      m.languages as unknown as {
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

export async function ensureMonaco(): Promise<MonacoApi> {
  setupMonacoLoader();
  const api = await loader.init();
  registerThemes(api);
  quietTypescriptDiagnostics(api);
  return api;
}
