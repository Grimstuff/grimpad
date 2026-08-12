import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useTabsStore } from "../store/tabsStore";
import { useSettingsStore, type ThemeMode } from "../store/settingsStore";
import { AboutDialog } from "./AboutDialog";

/** Frameless chrome: ☰ + tabs + ＋ | drag region | window controls */
export function AppChrome() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 });
  const [aboutOpen, setAboutOpen] = useState(false);
  const [maximized, setMaximized] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const hamburgerRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const tabListRef = useRef<HTMLDivElement>(null);
  /** True when tabs don't all fit — both seek arrows stay mounted so layout doesn't jump. */
  const [tabsOverflow, setTabsOverflow] = useState(false);
  const [canSeekLeft, setCanSeekLeft] = useState(false);
  const [canSeekRight, setCanSeekRight] = useState(false);

  const tabs = useTabsStore((s) => s.tabs);
  const activeTabId = useTabsStore((s) => s.activeTabId);
  const activateTab = useTabsStore((s) => s.activateTab);
  const closeTab = useTabsStore((s) => s.closeTab);
  const createTab = useTabsStore((s) => s.createTab);
  const openFiles = useTabsStore((s) => s.openFiles);
  const saveActive = useTabsStore((s) => s.saveActive);
  const saveActiveAs = useTabsStore((s) => s.saveActiveAs);

  const themeMode = useSettingsStore((s) => s.themeMode);
  const setThemeMode = useSettingsStore((s) => s.setThemeMode);
  const wordWrap = useSettingsStore((s) => s.wordWrap);
  const toggleWordWrap = useSettingsStore((s) => s.toggleWordWrap);

  // Track maximize state for the restore/maximize glyph
  useEffect(() => {
    let unlisten: (() => void) | undefined;
    (async () => {
      try {
        const win = getCurrentWindow();
        setMaximized(await win.isMaximized());
        unlisten = await win.onResized(async () => {
          setMaximized(await win.isMaximized());
        });
      } catch {
        /* browser preview */
      }
    })();
    return () => unlisten?.();
  }, []);

  // Position flyout under hamburger (portaled → not clipped by chrome overflow)
  useLayoutEffect(() => {
    if (!menuOpen || !hamburgerRef.current) return;
    const rect = hamburgerRef.current.getBoundingClientRect();
    setMenuPos({ top: rect.bottom + 2, left: rect.left });
  }, [menuOpen]);

  const updateTabSeek = () => {
    const el = tabListRef.current;
    if (!el) {
      setTabsOverflow(false);
      setCanSeekLeft(false);
      setCanSeekRight(false);
      return;
    }
    const { scrollLeft, scrollWidth, clientWidth } = el;
    const overflow = scrollWidth > clientWidth + 1;
    setTabsOverflow(overflow);
    setCanSeekLeft(overflow && scrollLeft > 1);
    setCanSeekRight(overflow && scrollLeft + clientWidth < scrollWidth - 1);
  };

  const seekTabs = (dir: -1 | 1) => {
    const el = tabListRef.current;
    if (!el) return;
    // ~one tab width
    el.scrollBy({ left: dir * 140, behavior: "smooth" });
  };

  // Keep seek arrows in sync with tab list overflow; wheel → horizontal seek
  useLayoutEffect(() => {
    updateTabSeek();
    const el = tabListRef.current;
    if (!el) return;
    const onScroll = () => updateTabSeek();
    const onWheel = (e: WheelEvent) => {
      if (el.scrollWidth <= el.clientWidth) return;
      const delta = Math.abs(e.deltaY) >= Math.abs(e.deltaX) ? e.deltaY : e.deltaX;
      if (delta === 0) return;
      e.preventDefault();
      el.scrollLeft += delta;
      updateTabSeek();
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    el.addEventListener("wheel", onWheel, { passive: false });
    const ro = new ResizeObserver(() => updateTabSeek());
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", onScroll);
      el.removeEventListener("wheel", onWheel);
      ro.disconnect();
    };
  }, [tabs.length, activeTabId]);

  // Scroll active tab into view
  useLayoutEffect(() => {
    if (!activeTabId || !tabListRef.current) return;
    const active = tabListRef.current.querySelector<HTMLElement>(
      `[data-tab-id="${activeTabId}"]`,
    );
    active?.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "smooth" });
    requestAnimationFrame(updateTabSeek);
  }, [activeTabId, tabs.length]);

  useEffect(() => {
    if (!menuOpen) return;
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      if (menuRef.current?.contains(t)) return;
      if (dropdownRef.current?.contains(t)) return;
      setMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    // Defer so the opening click doesn't immediately close the menu
    const timer = window.setTimeout(() => {
      document.addEventListener("mousedown", onDoc);
    }, 0);
    document.addEventListener("keydown", onKey);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  const run = (fn: () => unknown) => {
    setMenuOpen(false);
    void Promise.resolve(fn());
  };

  const winAction = async (action: "minimize" | "toggleMaximize" | "close") => {
    try {
      const win = getCurrentWindow();
      if (action === "minimize") await win.minimize();
      else if (action === "toggleMaximize") await win.toggleMaximize();
      else {
        // Triggers onCloseRequested (session flush) then destroy — don't hang on close().
        await win.close();
      }
    } catch (e) {
      console.warn(e);
      // Last resort if close is stuck
      if (action === "close") {
        try {
          await getCurrentWindow().destroy();
        } catch {
          /* ignore */
        }
      }
    }
  };

  const themeOptions: { id: ThemeMode; label: string }[] = [
    { id: "system", label: "System" },
    { id: "light", label: "Light" },
    { id: "dark", label: "Dark" },
  ];

  const menu = menuOpen
    ? createPortal(
        <div
          ref={dropdownRef}
          className="menu-dropdown chrome-dropdown"
          role="menu"
          style={{ top: menuPos.top, left: menuPos.left }}
        >
          <button type="button" className="menu-option" onClick={() => run(() => openFiles())}>
            Open… <span className="menu-shortcut">Ctrl+O</span>
          </button>
          <button type="button" className="menu-option" onClick={() => run(() => saveActive())}>
            Save <span className="menu-shortcut">Ctrl+S</span>
          </button>
          <button type="button" className="menu-option" onClick={() => run(() => saveActiveAs())}>
            Save as… <span className="menu-shortcut">Ctrl+Shift+S</span>
          </button>
          <div className="menu-sep" />
          <button
            type="button"
            className="menu-option"
            onClick={() =>
              run(() => {
                useTabsStore.getState()._editor?.trigger("menu", "actions.find", null);
              })
            }
          >
            Find <span className="menu-shortcut">Ctrl+F</span>
          </button>
          <button
            type="button"
            className="menu-option"
            onClick={() =>
              run(() => {
                useTabsStore
                  .getState()
                  ._editor?.trigger("menu", "editor.action.startFindReplaceAction", null);
              })
            }
          >
            Replace <span className="menu-shortcut">Ctrl+H</span>
          </button>
          <button
            type="button"
            className="menu-option"
            onClick={() =>
              run(() => {
                useTabsStore.getState()._editor?.trigger("menu", "editor.action.gotoLine", null);
              })
            }
          >
            Go to line… <span className="menu-shortcut">Ctrl+G</span>
          </button>
          <div className="menu-sep" />
          <button type="button" className="menu-option" onClick={() => run(() => toggleWordWrap())}>
            {wordWrap ? "✓ Word wrap" : "Word wrap"}
          </button>
          <div className="menu-sep" />
          <div className="menu-theme-label">Theme</div>
          {themeOptions.map((opt) => (
            <button
              key={opt.id}
              type="button"
              className="menu-option"
              onClick={() => run(() => setThemeMode(opt.id))}
            >
              {themeMode === opt.id ? `✓ ${opt.label}` : opt.label}
            </button>
          ))}
          <div className="menu-sep" />
          <button
            type="button"
            className="menu-option"
            onClick={() =>
              run(() => {
                setAboutOpen(true);
              })
            }
          >
            About
          </button>
        </div>,
        document.body,
      )
    : null;

  return (
    <header className="chrome">
      <div className="chrome-leading" ref={menuRef}>
        <button
          ref={hamburgerRef}
          type="button"
          className="chrome-hamburger"
          aria-label="Menu"
          aria-expanded={menuOpen}
          aria-haspopup="menu"
          title="Menu"
          onClick={(e) => {
            e.stopPropagation();
            setMenuOpen((v) => !v);
          }}
        >
          <span className="chrome-hamburger-icon" aria-hidden>
            <span />
            <span />
            <span />
          </span>
        </button>

        <div className="tab-cluster">
          {/*
            Layout: [‹?][tabs…][›?][+]
            When overflowing, both arrows stay mounted (disabled at ends) so + never jumps.
            When not overflowing, no arrows — + sits right after the last tab.
          */}
          {tabsOverflow ? (
            <button
              type="button"
              className="tab-seek"
              title="Scroll tabs left"
              aria-label="Scroll tabs left"
              disabled={!canSeekLeft}
              onClick={() => seekTabs(-1)}
            >
              ‹
            </button>
          ) : null}
          <div ref={tabListRef} className="tab-list" role="tablist">
            {tabs.map((tab) => {
              const active = tab.id === activeTabId;
              return (
                <div
                  key={tab.id}
                  data-tab-id={tab.id}
                  role="tab"
                  aria-selected={active}
                  className={`tab${active ? " active" : ""}`}
                  title={tab.path ?? tab.title}
                  onClick={() => activateTab(tab.id)}
                  onMouseDown={(e) => {
                    if (e.button === 1) {
                      e.preventDefault();
                      void closeTab(tab.id);
                    }
                  }}
                >
                  <span className="tab-title">{tab.title}</span>
                  {tab.isDirty ? <span className="tab-dirty" title="Unsaved" /> : null}
                  <button
                    type="button"
                    className="tab-close"
                    title="Close"
                    aria-label={`Close ${tab.title}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      void closeTab(tab.id);
                    }}
                  >
                    ×
                  </button>
                </div>
              );
            })}
          </div>
          {tabsOverflow ? (
            <button
              type="button"
              className="tab-seek"
              title="Scroll tabs right"
              aria-label="Scroll tabs right"
              disabled={!canSeekRight}
              onClick={() => seekTabs(1)}
            >
              ›
            </button>
          ) : null}
          <button
            type="button"
            className="tab-new"
            title="New tab (Ctrl+N)"
            aria-label="New tab"
            onClick={() => createTab()}
          >
            +
          </button>
        </div>
      </div>

      {/* Empty space: drag the window (frameless) */}
      <div
        className="chrome-drag"
        data-tauri-drag-region
        onDoubleClick={() => void winAction("toggleMaximize")}
      />

      <div className="chrome-controls">
        <button
          type="button"
          className="win-btn"
          title="Minimize"
          aria-label="Minimize"
          onClick={() => void winAction("minimize")}
        >
          <svg viewBox="0 0 12 12" aria-hidden>
            <path d="M1.5 6h9" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" />
          </svg>
        </button>
        <button
          type="button"
          className="win-btn"
          title={maximized ? "Restore" : "Maximize"}
          aria-label={maximized ? "Restore" : "Maximize"}
          onClick={() => void winAction("toggleMaximize")}
        >
          {maximized ? (
            <svg viewBox="0 0 12 12" aria-hidden>
              <path
                d="M3 4h6v6H3zM4 3h6v1M10 3v6h-1"
                stroke="currentColor"
                strokeWidth="1.4"
                fill="none"
              />
            </svg>
          ) : (
            <svg viewBox="0 0 12 12" aria-hidden>
              <rect
                x="2"
                y="2"
                width="8"
                height="8"
                stroke="currentColor"
                strokeWidth="1.5"
                fill="none"
              />
            </svg>
          )}
        </button>
        <button
          type="button"
          className="win-btn win-btn-close"
          title="Close"
          aria-label="Close"
          onClick={() => void winAction("close")}
        >
          <svg viewBox="0 0 12 12" aria-hidden>
            <path
              d="M2.5 2.5l7 7M9.5 2.5l-7 7"
              stroke="currentColor"
              strokeWidth="1.5"
              fill="none"
              strokeLinecap="round"
            />
          </svg>
        </button>
      </div>

      {menu}
      <AboutDialog open={aboutOpen} onClose={() => setAboutOpen(false)} />
    </header>
  );
}
