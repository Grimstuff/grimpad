import { useEffect } from "react";
import { useTabsStore } from "../store/tabsStore";
import { useSettingsStore } from "../store/settingsStore";

export function useKeyboardShortcuts() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      if (!mod) return;

      const key = e.key.toLowerCase();
      const tabs = useTabsStore.getState();
      const settings = useSettingsStore.getState();

      // Ctrl+N / Ctrl+T — new tab
      if (!e.shiftKey && (key === "n" || key === "t")) {
        e.preventDefault();
        tabs.createTab();
        return;
      }

      // Ctrl+O — open
      if (!e.shiftKey && key === "o") {
        e.preventDefault();
        void tabs.openFiles();
        return;
      }

      // Ctrl+S — save / Ctrl+Shift+S — save as
      if (key === "s") {
        e.preventDefault();
        if (e.shiftKey) void tabs.saveActiveAs();
        else void tabs.saveActive();
        return;
      }

      // Ctrl+W — close tab
      if (!e.shiftKey && key === "w") {
        e.preventDefault();
        if (tabs.activeTabId) void tabs.closeTab(tabs.activeTabId);
        return;
      }

      // Ctrl+Tab / Ctrl+Shift+Tab
      if (key === "tab") {
        e.preventDefault();
        tabs.cycleTab(e.shiftKey ? -1 : 1);
        return;
      }

      // Ctrl+1..9 — jump to tab
      if (!e.shiftKey && key >= "1" && key <= "9") {
        e.preventDefault();
        tabs.activateIndex(Number(key) - 1);
        return;
      }

      // Zoom: Ctrl+= / Ctrl++ / Ctrl+- / Ctrl+0
      if (key === "=" || key === "+") {
        e.preventDefault();
        settings.bumpFontSize(1);
        return;
      }
      if (key === "-") {
        e.preventDefault();
        settings.bumpFontSize(-1);
        return;
      }
      if (key === "0") {
        e.preventDefault();
        settings.resetFontSize();
        return;
      }
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
}
