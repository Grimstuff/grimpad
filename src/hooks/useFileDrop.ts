import { useEffect } from "react";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import { useTabsStore } from "../store/tabsStore";

/** Open files dropped onto the window (Tauri drag-drop). */
export function useFileDrop() {
  useEffect(() => {
    let unlisten: (() => void) | undefined;

    (async () => {
      try {
        unlisten = await getCurrentWebview().onDragDropEvent((event) => {
          if (event.payload.type === "drop") {
            const paths = event.payload.paths;
            if (paths?.length) {
              void useTabsStore.getState().openPaths(paths);
            }
          }
        });
      } catch {
        // Not running under Tauri (e.g. browser preview)
      }
    })();

    return () => {
      unlisten?.();
    };
  }, []);
}
