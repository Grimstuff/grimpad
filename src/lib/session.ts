import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { ask } from "@tauri-apps/plugin-dialog";
import type { DocViewMode } from "./languages";
import { isMarkdownLike } from "./languages";
import { getFileMeta, readFile } from "./fileService";
import { useTabsStore } from "../store/tabsStore";

const SESSION_VERSION = 1 as const;

export interface SessionTab {
  path: string | null;
  title: string;
  language: string;
  isDirty: boolean;
  viewMode: DocViewMode;
  content: string;
}

export interface SessionSnapshot {
  version: typeof SESSION_VERSION;
  activeIndex: number;
  tabs: SessionTab[];
}

function buildSnapshot(): SessionSnapshot | null {
  const { tabs, activeTabId, getModel } = useTabsStore.getState();
  if (tabs.length === 0) return null;

  const sessionTabs: SessionTab[] = tabs.map((t) => ({
    path: t.path,
    title: t.title,
    language: t.language,
    isDirty: t.isDirty,
    viewMode: t.viewMode ?? (isMarkdownLike(t.language) ? "formatted" : "source"),
    content: getModel(t.id)?.getValue() ?? "",
  }));

  let activeIndex = tabs.findIndex((t) => t.id === activeTabId);
  if (activeIndex < 0) activeIndex = 0;

  return {
    version: SESSION_VERSION,
    activeIndex,
    tabs: sessionTabs,
  };
}

export async function saveSessionToDisk(): Promise<void> {
  const snap = buildSnapshot();
  if (!snap) return;
  try {
    await invoke("save_session", { data: JSON.stringify(snap) });
  } catch (e) {
    console.warn("save_session failed", e);
  }
}

export async function loadSessionFromDisk(): Promise<SessionSnapshot | null> {
  try {
    const raw = await invoke<string | null>("load_session");
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SessionSnapshot;
    if (!parsed || parsed.version !== SESSION_VERSION || !Array.isArray(parsed.tabs)) {
      return null;
    }
    if (parsed.tabs.length === 0) return null;
    return parsed;
  } catch (e) {
    console.warn("load_session failed", e);
    return null;
  }
}

/**
 * Restore tabs after Monaco is ready.
 * Missing-on-disk paths become dirty untitled buffers (keep title + content).
 * @returns true if a session was restored
 */
export async function restoreSession(): Promise<boolean> {
  const snap = await loadSessionFromDisk();
  if (!snap) return false;

  const store = useTabsStore.getState();
  if (!store._monaco) return false;

  // Clear any boot state
  store.disposeAll();

  const ids: string[] = [];
  for (const t of snap.tabs) {
    let content = t.content ?? "";
    let path = t.path;
    let isDirty = t.isDirty;
    let title = t.title;

    if (path) {
      const meta = await getFileMeta(path).catch(() => null);
      if (!meta) {
        // Ghost path: file gone from disk — keep buffer as unsaved (not a real path).
        isDirty = true;
        path = null;
        title = title || "Untitled";
      } else if (!isDirty) {
        // Clean tab with live file: prefer on-disk content
        try {
          content = await readFile(path);
        } catch {
          isDirty = true;
          path = null;
          title = title || "Untitled";
        }
      }
    }

    const id = store.createTab({
      path,
      content,
      title: title || undefined,
      language: t.language,
      viewMode: t.viewMode,
      isDirty,
      activate: false,
    });
    // Ensure dirty flag sticks even if model listeners raced
    if (isDirty) store.markDirty(id, true);
    ids.push(id);
  }

  if (ids.length === 0) return false;

  const idx = Math.min(Math.max(0, snap.activeIndex), ids.length - 1);
  store.activateTab(ids[idx]!);
  return true;
}

let saveTimer: ReturnType<typeof setTimeout> | null = null;

export function scheduleSessionSave(): void {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    saveTimer = null;
    void saveSessionToDisk();
  }, 500);
}

function flushSessionNow(): void {
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }
  void saveSessionToDisk();
}

/**
 * Prompt for dirty tabs, then save session and destroy the window.
 * Uses preventDefault + destroy with a re-entry guard (no close loop).
 */
async function handleCloseRequested(
  event: { preventDefault: () => void },
): Promise<void> {
  event.preventDefault();

  const store = useTabsStore.getState();
  const dirty = store.tabs.filter((t) => t.isDirty);

  if (dirty.length > 0) {
    const names =
      dirty.length === 1
        ? `"${dirty[0]!.title}"`
        : `${dirty.length} tabs`;
    let saveAll = false;
    try {
      saveAll = await ask(
        `${names} ${dirty.length === 1 ? "has" : "have"} unsaved changes. Save before quitting?`,
        {
          title: "Unsaved changes",
          kind: "warning",
          okLabel: dirty.length === 1 ? "Save" : "Save all",
          cancelLabel: "Don't save",
        },
      );
    } catch {
      // Dialog failed — stay open rather than discard silently
      return;
    }

    if (saveAll) {
      for (const tab of dirty) {
        store.activateTab(tab.id);
        const ok = await useTabsStore.getState().saveActive();
        if (!ok) {
          // User cancelled Save As or save failed — abort quit
          return;
        }
      }
    }
  }

  flushSessionNow();
  // Give the session write a brief chance to land
  await new Promise((r) => setTimeout(r, 50));
  try {
    await getCurrentWindow().destroy();
  } catch (e) {
    console.warn("destroy failed", e);
  }
}

/** Wire close + debounced autosave so tabs survive restarts. */
export function initSessionPersistence(): () => void {
  const unsub = useTabsStore.subscribe(() => {
    scheduleSessionSave();
  });

  let unlistenClose: (() => void) | undefined;
  let closing = false;

  void (async () => {
    try {
      const win = getCurrentWindow();
      unlistenClose = await win.onCloseRequested(async (event) => {
        if (closing) return;
        closing = true;
        try {
          await handleCloseRequested(event);
        } finally {
          // If we stayed open (save cancel), allow another close attempt
          closing = false;
        }
      });
    } catch {
      /* browser */
    }
  })();

  const onHide = () => void saveSessionToDisk();
  window.addEventListener("pagehide", onHide);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") onHide();
  });

  return () => {
    unsub();
    unlistenClose?.();
    window.removeEventListener("pagehide", onHide);
    if (saveTimer) clearTimeout(saveTimer);
  };
}
