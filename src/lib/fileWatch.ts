import { useTabsStore } from "../store/tabsStore";
import {
  acceptDiskVersion,
  refreshDiskBaseline,
  reloadTabFromDisk,
} from "./diskBaseline";
import {
  confirmExternalChange,
  confirmExternalDelete,
  getFileMeta,
} from "./fileService";

const POLL_MS = 1500;

/** Tab ids currently showing a dialog (avoid re-entry / spam). */
const prompting = new Set<string>();

function metaChanged(
  disk: { mtimeMs: number | null; size: number; missing?: boolean } | undefined,
  meta: { mtimeMs: number | null; size: number },
): boolean {
  if (!disk || disk.missing) return true;
  if (disk.size !== meta.size) return true;
  // Prefer mtime when both sides have it
  if (disk.mtimeMs != null && meta.mtimeMs != null) {
    return disk.mtimeMs !== meta.mtimeMs;
  }
  return false;
}

async function checkTab(tabId: string): Promise<void> {
  if (prompting.has(tabId)) return;

  const tab = useTabsStore.getState().tabs.find((t) => t.id === tabId);
  if (!tab?.path) return;

  let meta: Awaited<ReturnType<typeof getFileMeta>>;
  try {
    meta = await getFileMeta(tab.path);
  } catch (e) {
    console.warn("getFileMeta", e);
    return;
  }

  // Still matches baseline — nothing to do
  if (meta && tab.disk && !tab.disk.missing && !metaChanged(tab.disk, meta)) {
    return;
  }

  // First baseline after open can be missing — set without prompting
  if (!tab.disk && meta) {
    await refreshDiskBaseline(tabId);
    return;
  }

  // Deleted / missing
  if (!meta) {
    if (tab.disk?.missing) return;
    prompting.add(tabId);
    try {
      const keep = await confirmExternalDelete(tab.title);
      if (keep) {
        // Detach from path so Save asks for a new location
        useTabsStore.setState((s) => ({
          tabs: s.tabs.map((t) =>
            t.id === tabId
              ? {
                  ...t,
                  path: null,
                  title: t.title || "Untitled",
                  isDirty: true,
                  disk: undefined,
                }
              : t,
          ),
        }));
        useTabsStore.getState().markDirty(tabId, true);
      } else {
        await useTabsStore.getState().closeTab(tabId, { skipConfirm: true });
      }
    } finally {
      prompting.delete(tabId);
    }
    return;
  }

  // Exists but fingerprint changed
  if (tab.disk && !tab.disk.missing && metaChanged(tab.disk, meta)) {
    prompting.add(tabId);
    try {
      // Bring window focus so the dialog is noticeable
      try {
        const { getCurrentWindow } = await import("@tauri-apps/api/window");
        await getCurrentWindow().setFocus();
      } catch {
        /* ignore */
      }

      const reload = await confirmExternalChange(tab.title, tab.isDirty);
      if (reload) {
        await reloadTabFromDisk(tabId);
      } else {
        await acceptDiskVersion(tabId);
      }
    } finally {
      prompting.delete(tabId);
    }
  }
}

async function pollOnce(): Promise<void> {
  const tabs = useTabsStore.getState().tabs.filter((t) => t.path);
  for (const t of tabs) {
    await checkTab(t.id);
  }
}

/** Poll open file paths for external edits/deletes. */
export function initFileWatch(): () => void {
  const id = window.setInterval(() => {
    void pollOnce();
  }, POLL_MS);

  // Check when app gains focus (common time external editors save)
  const onFocus = () => void pollOnce();
  window.addEventListener("focus", onFocus);

  return () => {
    window.clearInterval(id);
    window.removeEventListener("focus", onFocus);
  };
}
