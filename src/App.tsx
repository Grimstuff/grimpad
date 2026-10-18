import { useEffect } from "react";
import { AppChrome } from "./components/AppChrome";
import { EditorPane } from "./components/EditorPane";
import { StatusBar } from "./components/StatusBar";
import { UpdateDialog } from "./components/UpdateDialog";
import { useKeyboardShortcuts } from "./hooks/useKeyboardShortcuts";
import { useFileDrop } from "./hooks/useFileDrop";
import { initThemeListener, useSettingsStore } from "./store/settingsStore";
import { initSystemAccent } from "./lib/systemAccent";
import { initWheelScroll } from "./lib/wheelScroll";
import { revealMainWindow } from "./lib/revealWindow";
import { initSessionPersistence } from "./lib/session";
import { initFileWatch } from "./lib/fileWatch";
import { initSecondInstanceListener } from "./lib/extraWindows";
import { initUpdateCheck } from "./lib/updates";
import "./styles/tokens.css";
import "./styles/app.css";

function App() {
  useKeyboardShortcuts();
  useFileDrop();

  useEffect(() => {
    const mode = useSettingsStore.getState().themeMode;
    useSettingsStore.getState().setThemeMode(mode);
    const untheme = initThemeListener();
    const unaccent = initSystemAccent();
    const unwheel = initWheelScroll();
    const unsession = initSessionPersistence();
    const unwatch = initFileWatch();
    const unsecond = initSecondInstanceListener();
    const unupdate = initUpdateCheck();
    void revealMainWindow();
    return () => {
      untheme();
      unaccent();
      unwheel();
      unsession();
      unwatch();
      unsecond();
      unupdate();
    };
  }, []);

  return (
    <div className="app">
      <AppChrome />
      <EditorPane />
      <StatusBar />
      <UpdateDialog />
    </div>
  );
}

export default App;
