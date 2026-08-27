import { isMarkdownLike } from "./languages";
import { useTabsStore } from "../store/tabsStore";

export const MONACO_FIND = "actions.find";
export const MONACO_REPLACE = "editor.action.startFindReplaceAction";
export const MONACO_GOTO_LINE = "editor.action.gotoLine";

type Editor = NonNullable<ReturnType<typeof useTabsStore.getState>["_editor"]>;

let pendingAction: string | null = null;
let forceLineNumbers = false;
const lineNumberListeners = new Set<(on: boolean) => void>();

export function subscribeForceLineNumbers(fn: (on: boolean) => void): () => void {
  lineNumberListeners.add(fn);
  fn(forceLineNumbers);
  return () => {
    lineNumberListeners.delete(fn);
  };
}

export function getForceLineNumbers(): boolean {
  return forceLineNumbers;
}

function setForceLineNumbers(on: boolean): void {
  if (forceLineNumbers === on) return;
  forceLineNumbers = on;
  for (const fn of lineNumberListeners) fn(on);
}

function waitForEditorReady(ms = 2000): Promise<Editor | null> {
  const t0 = Date.now();
  return new Promise((resolve) => {
    const tick = () => {
      const ed = useTabsStore.getState()._editor;
      if (ed && ed.getModel()) {
        resolve(ed);
        return;
      }
      if (Date.now() - t0 > ms) {
        resolve(ed ?? null);
        return;
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
}

function gotoWidgetOpen(): boolean {
  const nodes = document.querySelectorAll<HTMLElement>(
    ".quick-input-widget, .monaco-quick-input-widget",
  );
  for (const el of nodes) {
    if (el.offsetParent !== null || el.classList.contains("visible")) return true;
  }
  return false;
}

function watchGotoLineWidget(): void {
  setForceLineNumbers(true);
  let seen = false;
  const started = Date.now();
  const stop = () => {
    window.clearInterval(iv);
    document.removeEventListener("keydown", onKey, true);
    setForceLineNumbers(false);
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === "Escape") stop();
    if (e.key === "Enter" && seen) {
      window.setTimeout(stop, 50);
    }
  };
  document.addEventListener("keydown", onKey, true);
  const iv = window.setInterval(() => {
    const open = gotoWidgetOpen();
    if (open) seen = true;
    const elapsed = Date.now() - started;
    if (seen && !open) stop();
    else if (elapsed > 20_000) stop();
  }, 50);
}

function fire(editor: Editor, actionId: string): void {
  if (actionId === MONACO_GOTO_LINE) setForceLineNumbers(true);
  editor.focus();
  requestAnimationFrame(() => {
    editor.focus();
    editor.trigger("keyboard", actionId, null);
    if (actionId === MONACO_GOTO_LINE) watchGotoLineWidget();
  });
}

/** Call at the end of Monaco onMount so a pending Find/Goto survives Formatted → Raw. */
export function flushPendingMonacoAction(editor: Editor): void {
  const action = pendingAction;
  if (!action) return;
  pendingAction = null;
  fire(editor, action);
}

/**
 * Run a Monaco action. Markdown Formatted has no Monaco — switch to Raw, then
 * fire once the source editor has a model (one keypress, not two).
 */
export async function runMonacoAction(actionId: string): Promise<void> {
  const store = useTabsStore.getState();
  const tab = store.getActiveTab();
  if (tab && isMarkdownLike(tab.language) && tab.viewMode === "formatted") {
    pendingAction = actionId;
    store.setViewMode(tab.id, "source");
    const editor = await waitForEditorReady();
    if (pendingAction === actionId && editor) {
      pendingAction = null;
      fire(editor, actionId);
    }
    return;
  }

  const editor = await waitForEditorReady();
  if (editor) fire(editor, actionId);
}
