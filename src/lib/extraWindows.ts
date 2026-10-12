import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { WebviewWindow } from "@tauri-apps/api/webviewWindow";
import type { SessionSnapshot, SessionTab } from "./session";
import { applySessionSnapshot } from "./session";
import { isMarkdownLike, languageFromPath, titleFromPath } from "./languages";
import { readFile } from "./fileService";
import { useSettingsStore } from "../store/settingsStore";
import { normalizeWindowsPath, useTabsStore } from "../store/tabsStore";

export function isMainWindow(): boolean {
  try {
    return getCurrentWindow().label === "main";
  } catch {
    return true;
  }
}

function bootKey(label: string): string {
  return `grimpad.boot.${label}`;
}

export function takeBootSnapshot(label: string): SessionSnapshot | null {
  try {
    const raw = localStorage.getItem(bootKey(label));
    if (!raw) return null;
    localStorage.removeItem(bootKey(label));
    const parsed = JSON.parse(raw) as SessionSnapshot;
    if (!parsed?.tabs?.length) return null;
    return parsed;
  } catch {
    return null;
  }
}

async function spawnViewWindow(label: string, snap: SessionSnapshot): Promise<void> {
  localStorage.setItem(bootKey(label), JSON.stringify(snap));
  const w = new WebviewWindow(label, {
    title: "Grimpad",
    url: "index.html",
    width: 720,
    height: 900,
    minWidth: 420,
    minHeight: 280,
    decorations: false,
    shadow: true,
    visible: true,
    backgroundColor: "#1e1e1e",
  });
  w.once("tauri://error", () => {
    localStorage.removeItem(bootKey(label));
  });
}

export async function detachTabToNewWindow(tabId: string): Promise<void> {
  const store = useTabsStore.getState();
  const tab = store.tabs.find((t) => t.id === tabId);
  if (!tab) return;
  const content = store.getModel(tabId)?.getValue() ?? "";
  const label = `view-${Date.now()}`;
  const snap: SessionSnapshot = {
    version: 1,
    activeIndex: 0,
    tabs: [
      {
        path: tab.path,
        title: tab.title,
        language: tab.language,
        isDirty: tab.isDirty,
        viewMode: tab.viewMode ?? "source",
        content,
      },
    ],
  };
  await spawnViewWindow(label, snap);
  await store.closeTab(tabId, { skipConfirm: true });
}

async function snapshotFromPaths(paths: string[]): Promise<SessionSnapshot> {
  const tabs: SessionTab[] = [];
  for (const raw of paths) {
    const path = normalizeWindowsPath(raw);
    if (!path) continue;
    try {
      const content = await readFile(path);
      tabs.push({
        path,
        title: titleFromPath(path),
        language: languageFromPath(path),
        isDirty: false,
        viewMode: isMarkdownLike(languageFromPath(path)) ? "formatted" : "source",
        content,
      });
    } catch (e) {
      console.warn("second-instance open failed", path, e);
    }
  }
  if (tabs.length === 0) {
    tabs.push({
      path: null,
      title: "Untitled",
      language: "plaintext",
      isDirty: false,
      viewMode: "source",
      content: "",
    });
  }
  return { version: 1, activeIndex: 0, tabs };
}

/** Main window: extra launches join this session, or open another window. */
export function initSecondInstanceListener(): () => void {
  if (!isMainWindow()) return () => {};
  let unlisten: (() => void) | undefined;
  void listen<string[]>("second-instance", async (event) => {
    const paths = event.payload ?? [];
    const single = useSettingsStore.getState().singleSession;
    if (single) {
      if (paths.length) await useTabsStore.getState().openPaths(paths);
      try {
        await getCurrentWindow().unminimize();
        await getCurrentWindow().setFocus();
      } catch {
        /* ignore */
      }
      return;
    }
    const label = `view-${Date.now()}`;
    const snap = await snapshotFromPaths(paths);
    await spawnViewWindow(label, snap);
  }).then((fn) => {
    unlisten = fn;
  });
  return () => unlisten?.();
}

export { applySessionSnapshot };
