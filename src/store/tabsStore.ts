import { create } from "zustand";
import type * as MonacoNS from "monaco-editor";
import {
  type DocViewMode,
  isMarkdownLike,
  languageFromPath,
  suggestedFilenameFromContent,
  titleFromPath,
} from "../lib/languages";
import {
  confirmCloseDirty,
  openFilesDialog,
  readFile,
  saveFileDialog,
  writeFile,
} from "../lib/fileService";
import { applyModelLanguage } from "../lib/monacoSetup";
import { useSettingsStore } from "./settingsStore";
import {
  detectLanguageFromText,
  readyForFormattedMarkdown,
  shouldLockLanguage,
} from "../lib/detectLanguage";

export type TabId = string;

export interface DiskBaseline {
  /** Unix ms; null if unknown */
  mtimeMs: number | null;
  size: number;
  /** Path was missing last time we checked (user already notified). */
  missing?: boolean;
}

export interface EditorTab {
  id: TabId;
  path: string | null;
  title: string;
  language: string;
  isDirty: boolean;
  encoding: "utf-8";
  /** Markdown: live formatted view vs raw source in Monaco. */
  viewMode: DocViewMode;
  /** Stop auto-detect (user picked, file has a path, or guess is locked in). */
  languageLocked: boolean;
  /** Last known on-disk fingerprint for external-change detection. */
  disk?: DiskBaseline;
}

interface TabsState {
  tabs: EditorTab[];
  activeTabId: TabId | null;
  cursorLine: number;
  cursorColumn: number;
  /** Monaco models keyed by tab id — owned by us, not by @monaco-editor/react. */
  _models: Map<TabId, MonacoNS.editor.ITextModel>;
  _viewStates: Map<TabId, MonacoNS.editor.ICodeEditorViewState | null>;
  _disposables: Map<TabId, { dispose: () => void }>;
  _monaco: typeof MonacoNS | null;
  _editor: MonacoNS.editor.IStandaloneCodeEditor | null;

  setMonaco: (monaco: typeof MonacoNS) => void;
  setEditor: (editor: MonacoNS.editor.IStandaloneCodeEditor | null) => void;
  setCursor: (line: number, column: number) => void;

  ensureInitialTab: () => void;
  createTab: (opts?: {
    path?: string | null;
    content?: string;
    title?: string;
    /** Default true. Set false when bulk-restoring a session. */
    activate?: boolean;
    language?: string;
    viewMode?: DocViewMode;
    isDirty?: boolean;
  }) => TabId;
  activateTab: (id: TabId) => void;
  closeTab: (id: TabId, opts?: { skipConfirm?: boolean }) => Promise<boolean>;
  markDirty: (id: TabId, dirty: boolean) => void;
  openFiles: () => Promise<void>;
  openPaths: (paths: string[]) => Promise<void>;
  saveActive: () => Promise<boolean>;
  saveActiveAs: () => Promise<boolean>;
  cycleTab: (dir: 1 | -1) => void;
  activateIndex: (index: number) => void;
  getActiveTab: () => EditorTab | null;
  getModel: (id: TabId) => MonacoNS.editor.ITextModel | undefined;
  setTabLanguage: (id: TabId, language: string, opts?: { lock?: boolean }) => void;
  setViewMode: (id: TabId, mode: DocViewMode) => void;
  toggleMarkdownView: (id: TabId) => void;
  refreshDiskBaseline: (id: TabId) => Promise<void>;
  reloadTabFromDisk: (id: TabId) => Promise<boolean>;
  acceptDiskVersion: (id: TabId) => Promise<void>;
  disposeAll: () => void;
}

function uid(): string {
  return crypto.randomUUID();
}

/** Consecutive same auto-detect hits per untitled tab (not persisted). */
const detectStreak = new Map<TabId, { id: string; n: number }>();
const detectTimers = new Map<TabId, ReturnType<typeof setTimeout>>();
const formattedTimers = new Map<TabId, ReturnType<typeof setTimeout>>();

function latestText(get: () => TabsState, tabId: TabId, fallback: string): string {
  return get().getModel(tabId)?.getValue() ?? fallback;
}

function maybeSwitchToFormattedMarkdown(get: () => TabsState, tabId: TabId) {
  const prev = formattedTimers.get(tabId);
  if (prev) clearTimeout(prev);
  formattedTimers.set(
    tabId,
    setTimeout(() => {
      formattedTimers.delete(tabId);
      const tab = get().tabs.find((t) => t.id === tabId);
      if (!tab || tab.path || tab.viewMode === "formatted") return;
      if (!isMarkdownLike(tab.language)) return;
      const text = latestText(get, tabId, "");
      if (!readyForFormattedMarkdown(text)) return;
      get().setViewMode(tabId, "formatted");
    }, 850),
  );
}

function maybeAutoDetectLanguage(get: () => TabsState, tabId: TabId, text: string) {
  const prevTimer = detectTimers.get(tabId);
  if (prevTimer) clearTimeout(prevTimer);
  // Keep postponing Formatted remount while keys are still coming
  const pendingFmt = formattedTimers.get(tabId);
  if (pendingFmt) {
    clearTimeout(pendingFmt);
    formattedTimers.delete(tabId);
  }

  detectTimers.set(
    tabId,
    setTimeout(() => {
      detectTimers.delete(tabId);
      const tab = get().tabs.find((t) => t.id === tabId);
      if (!tab || tab.languageLocked || tab.path) {
        if (tab && isMarkdownLike(tab.language) && tab.viewMode !== "formatted") {
          maybeSwitchToFormattedMarkdown(get, tabId);
        }
        return;
      }

      const live = latestText(get, tabId, text);
      const guess = detectLanguageFromText(live);
      if (!guess) return;

      const prev = detectStreak.get(tabId);
      const streak =
        prev && prev.id === guess.id ? { id: guess.id, n: prev.n + 1 } : { id: guess.id, n: 1 };
      detectStreak.set(tabId, streak);

      const lock = shouldLockLanguage(live, streak.n);
      if (guess.id !== tab.language && guess.score >= 0.4) {
        get().setTabLanguage(tabId, guess.id, { lock });
      } else if (lock) {
        get().setTabLanguage(tabId, tab.language, { lock: true });
      }

      if (isMarkdownLike(guess.id)) {
        if (/^ {0,3}#{1,6}[ \t]+\S[^\n]*\n/.test(live)) {
          // Enter after a heading — swap now; line is finished
          get().setViewMode(tabId, "formatted");
        } else if (readyForFormattedMarkdown(live)) {
          maybeSwitchToFormattedMarkdown(get, tabId);
        }
      }
    }, 220),
  );
}

/** Unique URI per tab so models never share identity across tabs. */
function tabModelUri(monaco: typeof MonacoNS, tabId: string, path: string | null) {
  if (path) {
    const normalized = path.replace(/\\/g, "/");
    const encoded = encodeURI(normalized.startsWith("/") ? normalized : `/${normalized}`);
    // Query keeps each tab's model distinct even for the same path.
    return monaco.Uri.parse(`file://${encoded}?tab=${tabId}`);
  }
  return monaco.Uri.parse(`inmemory://grimpad/${tabId}`);
}

function isAlive(model: MonacoNS.editor.ITextModel | null | undefined): model is MonacoNS.editor.ITextModel {
  return !!model && !model.isDisposed();
}

function updateWindowTitle(tab: EditorTab | null | undefined) {
  if (typeof document === "undefined") return;
  if (!tab) {
    document.title = "Grimpad";
    return;
  }
  const dirty = tab.isDirty ? "• " : "";
  document.title = `${dirty}${tab.title} — Grimpad`;
}

function saveViewState(get: () => TabsState) {
  const { _editor, activeTabId, _viewStates } = get();
  if (_editor && activeTabId) {
    try {
      _viewStates.set(activeTabId, _editor.saveViewState());
    } catch {
      /* editor may be mid-dispose */
    }
  }
}

function attachModel(get: () => TabsState, tabId: TabId) {
  const { _editor, _models, _viewStates } = get();
  const model = _models.get(tabId);
  if (!_editor || !isAlive(model)) return;
  try {
    if (_editor.getModel() !== model) {
      _editor.setModel(model);
    }
    const restored = _viewStates.get(tabId);
    if (restored) _editor.restoreViewState(restored);
    _editor.focus();
  } catch (e) {
    console.warn("attachModel failed", e);
  }
}

function disposeTabModel(get: () => TabsState, tabId: TabId) {
  const { _editor, _models, _viewStates, _disposables } = get();
  const model = _models.get(tabId);

  // Detach before dispose — Monaco throws "Model is disposed!" if still attached.
  try {
    if (_editor && model && _editor.getModel() === model) {
      _editor.setModel(null);
    }
  } catch {
    /* ignore */
  }

  _disposables.get(tabId)?.dispose();
  _disposables.delete(tabId);

  if (isAlive(model)) {
    try {
      model.dispose();
    } catch {
      /* ignore */
    }
  }
  _models.delete(tabId);
  _viewStates.delete(tabId);
}

export const useTabsStore = create<TabsState>((set, get) => ({
  tabs: [],
  activeTabId: null,
  cursorLine: 1,
  cursorColumn: 1,
  _models: new Map(),
  _viewStates: new Map(),
  _disposables: new Map(),
  _monaco: null,
  _editor: null,

  setMonaco: (monaco) => set({ _monaco: monaco }),

  setEditor: (editor) => set({ _editor: editor }),

  setCursor: (line, column) => set({ cursorLine: line, cursorColumn: column }),

  ensureInitialTab: () => {
    if (get().tabs.length === 0) {
      get().createTab();
    } else if (get().activeTabId) {
      attachModel(get, get().activeTabId!);
    }
  },

  createTab: (opts = {}) => {
    const id = uid();
    const path = opts.path ?? null;
    const title = opts.title ?? titleFromPath(path, "Untitled");
    const language = opts.language ?? languageFromPath(path);
    const monaco = get()._monaco;
    const activate = opts.activate !== false;

    const tab: EditorTab = {
      id,
      path,
      title,
      language,
      isDirty: opts.isDirty ?? false,
      encoding: "utf-8",
      viewMode:
        opts.viewMode ??
        (isMarkdownLike(language) ? "formatted" : "source"),
      // Saved files follow extension. Untitled stays unlocked until detect/user pick.
      languageLocked: Boolean(path) || (opts.language != null && opts.language !== "plaintext"),
    };

    if (monaco) {
      const uri = tabModelUri(monaco, id, path);
      // Never reuse another tab's model.
      let model = monaco.editor.getModel(uri);
      if (!isAlive(model)) {
        model = monaco.editor.createModel(opts.content ?? "", language, uri);
      } else {
        if (opts.content !== undefined) {
          model.setValue(opts.content);
        }
        applyModelLanguage(monaco, model, language);
      }
      get()._models.set(id, model);

      const sub = model.onDidChangeContent(() => {
        if (!isAlive(model)) return;
        const t = get().tabs.find((x) => x.id === id);
        if (t && !t.isDirty) get().markDirty(id, true);
        if (t && !t.path && !t.languageLocked) {
          maybeAutoDetectLanguage(get, id, model.getValue());
        }
        // Keep session snapshot fresh while typing
        void import("../lib/session").then((m) => m.scheduleSessionSave());
      });
      get()._disposables.set(id, sub);
    } else {
      console.warn("Monaco not ready; tab created without model");
    }

    if (activate) saveViewState(get);

    set((s) => ({
      tabs: [...s.tabs, tab],
      activeTabId: activate ? id : s.activeTabId ?? id,
    }));

    if (activate || get().activeTabId === id) {
      attachModel(get, id);
      updateWindowTitle(get().tabs.find((t) => t.id === get().activeTabId));
    }
    if (path) {
      // Dynamic import avoids circular dep with diskBaseline → tabsStore
      void import("../lib/diskBaseline").then((m) => m.refreshDiskBaseline(id));
    }
    return id;
  },

  activateTab: (id) => {
    const state = get();
    const tab = state.tabs.find((t) => t.id === id);
    if (!tab || state.activeTabId === id) {
      // Still re-attach if needed (e.g. after remount)
      if (tab) attachModel(get, id);
      return;
    }

    saveViewState(get);
    set({ activeTabId: id });
    attachModel(get, id);
    updateWindowTitle(tab);
  },

  closeTab: async (id, opts) => {
    const state = get();
    const tab = state.tabs.find((t) => t.id === id);
    if (!tab) return true;

    if (!opts?.skipConfirm && tab.isDirty && useSettingsStore.getState().confirmClose) {
      const action = await confirmCloseDirty(tab.title);
      if (action === "cancel") return false;
      if (action === "save") {
        if (state.activeTabId !== id) get().activateTab(id);
        const ok = await get().saveActive();
        if (!ok) return false;
      }
    }

    detectStreak.delete(id);
    const tmr = detectTimers.get(id);
    if (tmr) clearTimeout(tmr);
    detectTimers.delete(id);
    const fmt = formattedTimers.get(id);
    if (fmt) clearTimeout(fmt);
    formattedTimers.delete(id);

    const idx = state.tabs.findIndex((t) => t.id === id);
    const nextTabs = state.tabs.filter((t) => t.id !== id);

    let nextActive: TabId | null = state.activeTabId;
    if (state.activeTabId === id) {
      nextActive =
        nextTabs.length === 0
          ? null
          : nextTabs[Math.min(idx, nextTabs.length - 1)].id;
    }

    // Switch editor off this model first, then dispose.
    if (nextActive) {
      saveViewState(get);
      set({ tabs: nextTabs, activeTabId: nextActive });
      attachModel(get, nextActive);
    } else {
      set({ tabs: nextTabs, activeTabId: null });
      try {
        get()._editor?.setModel(null);
      } catch {
        /* ignore */
      }
    }

    disposeTabModel(get, id);

    if (nextTabs.length === 0) {
      get().createTab();
      return true;
    }

    const active = get().getActiveTab();
    updateWindowTitle(active);
    return true;
  },

  markDirty: (id, dirty) => {
    set((s) => ({
      tabs: s.tabs.map((t) => (t.id === id ? { ...t, isDirty: dirty } : t)),
    }));
    const active = get().getActiveTab();
    if (active?.id === id) updateWindowTitle(get().tabs.find((t) => t.id === id));
  },

  openFiles: async () => {
    const paths = await openFilesDialog();
    if (!paths?.length) return;
    await get().openPaths(paths);
  },

  openPaths: async (paths) => {
    const norm = (p: string) => p.replace(/\//g, "\\").toLowerCase();
    let lastOpened: TabId | null = null;

    for (const raw of paths) {
      const path = raw.trim();
      if (!path) continue;

      const existing = get().tabs.find(
        (t) => t.path && norm(t.path) === norm(path),
      );
      if (existing) {
        get().activateTab(existing.id);
        lastOpened = existing.id;
        continue;
      }
      try {
        const content = await readFile(path);
        const id = get().createTab({ path, content, title: titleFromPath(path) });
        get().markDirty(id, false);
        lastOpened = id;
      } catch (e) {
        console.error(e);
        alert(`Could not open file:\n${path}\n\n${e}`);
      }
    }

    // Focus the last file from this open batch (e.g. CLI / Open with)
    if (lastOpened) get().activateTab(lastOpened);
  },

  saveActive: async () => {
    const tab = get().getActiveTab();
    if (!tab) return false;
    const model = get()._models.get(tab.id);
    if (!isAlive(model)) return false;

    let path = tab.path;
    if (!path) {
      const suggested = suggestedFilenameFromContent(model.getValue(), tab.language);
      path = await saveFileDialog(suggested);
      if (!path) return false;
    }

    try {
      await writeFile(path, model.getValue());
      const language = languageFromPath(path);
      const title = titleFromPath(path);
      const monaco = get()._monaco;
      if (monaco) applyModelLanguage(monaco, model, language);
      detectStreak.delete(tab.id);

      set((s) => ({
        tabs: s.tabs.map((t) =>
          t.id === tab.id
            ? { ...t, path, title, language, isDirty: false, languageLocked: true }
            : t,
        ),
      }));
      updateWindowTitle(get().tabs.find((t) => t.id === tab.id));
      await import("../lib/diskBaseline").then((m) => m.refreshDiskBaseline(tab.id));
      return true;
    } catch (e) {
      console.error(e);
      alert(`Could not save file:\n${path}\n\n${e}`);
      return false;
    }
  },

  saveActiveAs: async () => {
    const tab = get().getActiveTab();
    if (!tab) return false;
    const model = get()._models.get(tab.id);
    if (!isAlive(model)) return false;

    const suggested =
      tab.path ?? suggestedFilenameFromContent(model.getValue(), tab.language);
    const path = await saveFileDialog(suggested);
    if (!path) return false;

    try {
      await writeFile(path, model.getValue());
      const language = languageFromPath(path);
      const title = titleFromPath(path);
      const monaco = get()._monaco;
      if (monaco) applyModelLanguage(monaco, model, language);
      detectStreak.delete(tab.id);

      set((s) => ({
        tabs: s.tabs.map((t) =>
          t.id === tab.id
            ? { ...t, path, title, language, isDirty: false, languageLocked: true }
            : t,
        ),
      }));
      updateWindowTitle(get().tabs.find((t) => t.id === tab.id));
      await import("../lib/diskBaseline").then((m) => m.refreshDiskBaseline(tab.id));
      return true;
    } catch (e) {
      console.error(e);
      alert(`Could not save file:\n${path}\n\n${e}`);
      return false;
    }
  },

  cycleTab: (dir) => {
    const { tabs, activeTabId } = get();
    if (tabs.length < 2 || !activeTabId) return;
    const idx = tabs.findIndex((t) => t.id === activeTabId);
    const next = (idx + dir + tabs.length) % tabs.length;
    get().activateTab(tabs[next].id);
  },

  activateIndex: (index) => {
    const tab = get().tabs[index];
    if (tab) get().activateTab(tab.id);
  },

  getActiveTab: () => {
    const { tabs, activeTabId } = get();
    return tabs.find((t) => t.id === activeTabId) ?? null;
  },

  getModel: (id) => {
    const model = get()._models.get(id);
    return isAlive(model) ? model : undefined;
  },

  setTabLanguage: (id, language, opts) => {
    const monaco = get()._monaco;
    const model = get()._models.get(id);
    if (!monaco || !isAlive(model)) return;

    try {
      applyModelLanguage(monaco, model, language);
    } catch (e) {
      console.warn("setModelLanguage failed", e);
      return;
    }

    // Picker / save / explicit call locks. Auto-detect may pass lock: false.
    const lock = opts?.lock !== false;

    set((s) => ({
      tabs: s.tabs.map((t) => {
        if (t.id !== id) return t;
        const md = isMarkdownLike(language);
        return {
          ...t,
          language,
          languageLocked: lock || t.languageLocked,
          viewMode: md ? t.viewMode ?? "formatted" : "source",
        };
      }),
    }));
    if (lock) detectStreak.delete(id);
  },

  setViewMode: (id, mode) => {
    set((s) => ({
      tabs: s.tabs.map((t) => {
        if (t.id !== id) return t;
        if (!isMarkdownLike(t.language) && mode === "formatted") return t;
        return { ...t, viewMode: mode };
      }),
    }));
  },

  toggleMarkdownView: (id) => {
    const tab = get().tabs.find((t) => t.id === id);
    if (!tab || !isMarkdownLike(tab.language)) return;
    const next: DocViewMode = tab.viewMode === "formatted" ? "source" : "formatted";
    get().setViewMode(id, next);
  },

  refreshDiskBaseline: async (id) => {
    const m = await import("../lib/diskBaseline");
    await m.refreshDiskBaseline(id);
  },
  reloadTabFromDisk: async (id) => {
    const m = await import("../lib/diskBaseline");
    return m.reloadTabFromDisk(id);
  },
  acceptDiskVersion: async (id) => {
    const m = await import("../lib/diskBaseline");
    await m.acceptDiskVersion(id);
  },

  disposeAll: () => {
    const ids = [...get()._models.keys()];
    try {
      get()._editor?.setModel(null);
    } catch {
      /* ignore */
    }
    for (const id of ids) disposeTabModel(get, id);
    detectStreak.clear();
    for (const t of detectTimers.values()) clearTimeout(t);
    detectTimers.clear();
    for (const t of formattedTimers.values()) clearTimeout(t);
    formattedTimers.clear();
    set({ tabs: [], activeTabId: null });
  },
}));
