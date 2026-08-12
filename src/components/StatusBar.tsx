import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTabsStore } from "../store/tabsStore";
import { MAX_FONT, MIN_FONT, useSettingsStore } from "../store/settingsStore";
import { isMarkdownLike, languageLabel, languagesForPicker } from "../lib/languages";

export function StatusBar() {
  const tab = useTabsStore((s) => s.tabs.find((t) => t.id === s.activeTabId) ?? null);
  const line = useTabsStore((s) => s.cursorLine);
  const col = useTabsStore((s) => s.cursorColumn);
  const setTabLanguage = useTabsStore((s) => s.setTabLanguage);
  const toggleMarkdownView = useTabsStore((s) => s.toggleMarkdownView);
  const monaco = useTabsStore((s) => s._monaco);
  const showMdToggle = isMarkdownLike(tab?.language);

  const fontSize = useSettingsStore((s) => s.fontSize);
  const setFontSize = useSettingsStore((s) => s.setFontSize);
  const wordWrap = useSettingsStore((s) => s.wordWrap);
  const toggleWordWrap = useSettingsStore((s) => s.toggleWordWrap);

  // Language picker
  const [langOpen, setLangOpen] = useState(false);
  const [langPos, setLangPos] = useState({ bottom: 0, right: 0 });
  const [filter, setFilter] = useState("");
  const langBtnRef = useRef<HTMLButtonElement>(null);
  const langMenuRef = useRef<HTMLDivElement>(null);
  const filterRef = useRef<HTMLInputElement>(null);

  // Font size: button → slider; second click → text entry
  const [fontSliderOpen, setFontSliderOpen] = useState(false);
  const [fontEditing, setFontEditing] = useState(false);
  const [fontDraft, setFontDraft] = useState(String(fontSize));
  const [sliderPos, setSliderPos] = useState({ bottom: 0, left: 0, width: 0 });
  const fontWrapRef = useRef<HTMLDivElement>(null);
  const fontInputRef = useRef<HTMLInputElement>(null);
  const sliderRef = useRef<HTMLDivElement>(null);
  const fontEditingRef = useRef(false);
  const fontDraftRef = useRef(fontDraft);

  fontEditingRef.current = fontEditing;
  fontDraftRef.current = fontDraft;

  const registered = monaco?.languages.getLanguages().map((l) => l.id) ?? [];
  const options = languagesForPicker(registered).filter((l) => {
    if (!filter.trim()) return true;
    const q = filter.trim().toLowerCase();
    return l.id.toLowerCase().includes(q) || l.label.toLowerCase().includes(q);
  });

  const commitFontDraft = useCallback(() => {
    const raw = fontDraftRef.current.replace(/px/gi, "").trim();
    const n = Number.parseInt(raw, 10);
    if (Number.isFinite(n)) {
      setFontSize(n);
      setFontDraft(String(useSettingsStore.getState().fontSize));
    } else {
      setFontDraft(String(useSettingsStore.getState().fontSize));
    }
  }, [setFontSize]);

  const closeFontUi = useCallback(() => {
    if (fontEditingRef.current) commitFontDraft();
    setFontEditing(false);
    setFontSliderOpen(false);
  }, [commitFontDraft]);

  useEffect(() => {
    if (!fontEditing) setFontDraft(String(fontSize));
  }, [fontSize, fontEditing]);

  useLayoutEffect(() => {
    if (!langOpen || !langBtnRef.current) return;
    const rect = langBtnRef.current.getBoundingClientRect();
    setLangPos({
      bottom: window.innerHeight - rect.top + 4,
      right: window.innerWidth - rect.right,
    });
  }, [langOpen]);

  useLayoutEffect(() => {
    if (!fontSliderOpen || !fontWrapRef.current) return;
    const place = () => {
      const rect = fontWrapRef.current!.getBoundingClientRect();
      const width = Math.max(140, rect.width + 48);
      setSliderPos({
        bottom: window.innerHeight - rect.top + 6,
        left: rect.right - width,
        width,
      });
    };
    place();
    window.addEventListener("resize", place);
    return () => window.removeEventListener("resize", place);
  }, [fontSliderOpen, fontSize, fontEditing]);

  useEffect(() => {
    if (!langOpen) return;
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      if (langBtnRef.current?.contains(t) || langMenuRef.current?.contains(t)) return;
      setLangOpen(false);
      setFilter("");
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setLangOpen(false);
        setFilter("");
      }
    };
    const timer = window.setTimeout(() => document.addEventListener("mousedown", onDoc), 0);
    document.addEventListener("keydown", onKey);
    requestAnimationFrame(() => filterRef.current?.focus());
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [langOpen]);

  useEffect(() => {
    if (!fontSliderOpen) return;
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      if (fontWrapRef.current?.contains(t) || sliderRef.current?.contains(t)) return;
      closeFontUi();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setFontDraft(String(useSettingsStore.getState().fontSize));
        setFontEditing(false);
        setFontSliderOpen(false);
        fontInputRef.current?.blur();
      }
    };
    const timer = window.setTimeout(() => document.addEventListener("mousedown", onDoc), 0);
    document.addEventListener("keydown", onKey);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [fontSliderOpen, closeFontUi]);

  useEffect(() => {
    setLangOpen(false);
    setFilter("");
    setFontSliderOpen(false);
    setFontEditing(false);
  }, [tab?.id]);

  useEffect(() => {
    if (fontEditing) {
      requestAnimationFrame(() => fontInputRef.current?.select());
    }
  }, [fontEditing]);

  const pickLang = (id: string) => {
    if (tab) setTabLanguage(tab.id, id);
    setLangOpen(false);
    setFilter("");
  };

  /** First click: open slider. Second click (slider open): enter text mode. */
  const onFontControlClick = () => {
    setLangOpen(false);
    if (!fontSliderOpen) {
      setFontSliderOpen(true);
      setFontEditing(false);
      setFontDraft(String(useSettingsStore.getState().fontSize));
      return;
    }
    if (!fontEditing) {
      setFontEditing(true);
      setFontDraft(String(useSettingsStore.getState().fontSize));
    }
  };

  const langMenu = langOpen
    ? createPortal(
        <div
          ref={langMenuRef}
          className="lang-picker"
          role="listbox"
          aria-label="Select language"
          style={{ bottom: langPos.bottom, right: langPos.right }}
        >
          <input
            ref={filterRef}
            className="lang-picker-filter"
            type="search"
            placeholder="Filter languages…"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && options[0]) {
                e.preventDefault();
                pickLang(options[0].id);
              }
            }}
          />
          <div className="lang-picker-list">
            {options.map((opt) => {
              const active = opt.id === tab?.language;
              return (
                <button
                  key={opt.id}
                  type="button"
                  role="option"
                  aria-selected={active}
                  className={`lang-picker-option${active ? " active" : ""}`}
                  onClick={() => pickLang(opt.id)}
                >
                  <span>{opt.label}</span>
                  <span className="lang-picker-id">{opt.id}</span>
                </button>
              );
            })}
            {options.length === 0 ? (
              <div className="lang-picker-empty">No matches</div>
            ) : null}
          </div>
        </div>,
        document.body,
      )
    : null;

  const fontSlider = fontSliderOpen
    ? createPortal(
        <div
          ref={sliderRef}
          className="font-slider-pop"
          style={{
            bottom: sliderPos.bottom,
            left: sliderPos.left,
            width: sliderPos.width,
          }}
        >
          <input
            className="font-slider-pop-range"
            type="range"
            min={MIN_FONT}
            max={MAX_FONT}
            step={1}
            value={fontSize}
            onChange={(e) => {
              const n = Number(e.target.value);
              setFontSize(n);
              setFontDraft(String(n));
            }}
            aria-label="Font size"
          />
        </div>,
        document.body,
      )
    : null;

  return (
    <footer className="status-bar">
      <div className="status-left">
        <span className="status-item status-path" title={tab?.path ?? undefined}>
          {tab?.path ?? "Untitled"}
        </span>
      </div>
      <div className="status-right">
        {/* Ln/Col only for source (Monaco); formatted MD view has no line map */}
        {tab && (tab.viewMode ?? "source") !== "formatted" ? (
          <span className="status-item">
            Ln {line}, Col {col}
          </span>
        ) : null}
        {showMdToggle && tab ? (
          <button
            type="button"
            className={`status-btn status-md-view${(tab.viewMode ?? "formatted") === "formatted" ? " active" : ""}`}
            title={
              (tab.viewMode ?? "formatted") === "formatted"
                ? "Switch to raw markdown source"
                : "Switch to live formatted view"
            }
            onClick={() => toggleMarkdownView(tab.id)}
          >
            {(tab.viewMode ?? "formatted") === "formatted" ? "Formatted" : "Raw"}
          </button>
        ) : null}
        <button
          ref={langBtnRef}
          type="button"
          className="status-btn status-lang"
          title="Select language mode"
          aria-haspopup="listbox"
          aria-expanded={langOpen}
          disabled={!tab}
          onClick={() => {
            setFontSliderOpen(false);
            setFontEditing(false);
            setLangOpen((v) => !v);
          }}
        >
          {languageLabel(tab?.language)}
        </button>
        <button type="button" className="status-btn" onClick={() => toggleWordWrap()}>
          {wordWrap ? "Wrap" : "No wrap"}
        </button>

        <div
          ref={fontWrapRef}
          className={`status-font-field${fontSliderOpen ? " active" : ""}${fontEditing ? " editing" : ""}`}
          title={
            fontEditing
              ? "Type a font size"
              : fontSliderOpen
                ? "Click again to type a size"
                : "Font size — click for slider"
          }
        >
          {fontEditing ? (
            <input
              ref={fontInputRef}
              className="status-font-input"
              type="text"
              inputMode="numeric"
              spellCheck={false}
              aria-label="Font size in pixels"
              value={fontDraft}
              onChange={(e) => {
                const v = e.target.value.replace(/px/gi, "");
                if (v === "" || /^-?\d*$/.test(v)) setFontDraft(v);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  commitFontDraft();
                  setFontEditing(false);
                }
                if (e.key === "ArrowUp") {
                  e.preventDefault();
                  setFontSize(fontSize + 1);
                }
                if (e.key === "ArrowDown") {
                  e.preventDefault();
                  setFontSize(fontSize - 1);
                }
              }}
              onBlur={() => {
                window.setTimeout(() => {
                  if (sliderRef.current?.matches(":hover")) return;
                  if (fontWrapRef.current?.contains(document.activeElement)) return;
                  commitFontDraft();
                  setFontEditing(false);
                }, 0);
              }}
            />
          ) : (
            <button
              type="button"
              className="status-btn status-font"
              aria-haspopup="dialog"
              aria-expanded={fontSliderOpen}
              onClick={onFontControlClick}
            >
              {fontSize}px
            </button>
          )}
        </div>
      </div>
      {langMenu}
      {fontSlider}
    </footer>
  );
}
