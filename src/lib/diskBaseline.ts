import { getFileMeta, readFile } from "./fileService";
import { useTabsStore } from "../store/tabsStore";
import type { TabId } from "../store/tabsStore";

/**
 * Snapshot mtime/size for a tab's path so fileWatch can detect external edits.
 * Implemented as a free function (not only a store method) so call sites stay
 * valid across HMR / partial store reloads.
 */
export async function refreshDiskBaseline(id: TabId): Promise<void> {
  const tab = useTabsStore.getState().tabs.find((t) => t.id === id);
  if (!tab?.path) {
    useTabsStore.setState((s) => ({
      tabs: s.tabs.map((t) => (t.id === id ? { ...t, disk: undefined } : t)),
    }));
    return;
  }

  try {
    const meta = await getFileMeta(tab.path);
    if (!meta) {
      useTabsStore.setState((s) => ({
        tabs: s.tabs.map((t) =>
          t.id === id
            ? { ...t, disk: { mtimeMs: null, size: 0, missing: true } }
            : t,
        ),
      }));
      return;
    }
    useTabsStore.setState((s) => ({
      tabs: s.tabs.map((t) =>
        t.id === id
          ? {
              ...t,
              disk: {
                mtimeMs: meta.mtimeMs ?? null,
                size: meta.size,
                missing: false,
              },
            }
          : t,
      ),
    }));
  } catch (e) {
    console.warn("refreshDiskBaseline", e);
  }
}

/** Replace buffer with on-disk content; clear dirty; refresh baseline. */
export async function reloadTabFromDisk(id: TabId): Promise<boolean> {
  const state = useTabsStore.getState();
  const tab = state.tabs.find((t) => t.id === id);
  if (!tab?.path) return false;

  const model = state.getModel(id);
  if (!model) return false;

  try {
    const content = await readFile(tab.path);
    model.setValue(content);
    state.markDirty(id, false);
    await refreshDiskBaseline(id);
    return true;
  } catch (e) {
    console.error(e);
    alert(`Could not reload:\n${tab.path}\n\n${e}`);
    return false;
  }
}

/** Keep editor content; adopt current disk fingerprint so we stop prompting. */
export async function acceptDiskVersion(id: TabId): Promise<void> {
  await refreshDiskBaseline(id);
}
