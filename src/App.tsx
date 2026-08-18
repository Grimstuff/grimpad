import { useEffect } from "react";
import { AppChrome } from "./components/AppChrome";
import { EditorPane } from "./components/EditorPane";
import { StatusBar } from "./components/StatusBar";
import { useKeyboardShortcuts } from "./hooks/useKeyboardShortcuts";
import { useFileDrop } from "./hooks/useFileDrop";
import { initThemeListener, useSettingsStore } from "./store/settingsStore";
import { initSystemAccent } from "./lib/systemAccent";
import { initWheelScroll } from "./lib/wheelScroll";
import { revealMainWindow } from "./lib/revealWindow";
import { initSessionPersistence } from "./lib/session";
import { initFileWatch } from "./lib/fileWatch";
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
    void revealMainWindow();
    return () => {
      untheme();
      unaccent();
      unwheel();
      unsession();
      unwatch();
    };
  }, []);

  return (
    <div className="app">
      <AppChrome />
      <EditorPane />
      <StatusBar />
    </div>
  );
}

export default App;
