import { create } from "zustand";

export type ThemeMode = "system" | "light" | "dark";

interface SettingsState {
  themeMode: ThemeMode;
  resolvedTheme: "light" | "dark";
  fontSize: number;
  wordWrap: boolean;
  setThemeMode: (mode: ThemeMode) => void;
  setResolvedTheme: (theme: "light" | "dark") => void;
  setFontSize: (size: number) => void;
  bumpFontSize: (delta: number) => void;
  resetFontSize: () => void;
  setWordWrap: (wrap: boolean) => void;
  toggleWordWrap: () => void;
}

export const DEFAULT_FONT = 14;
export const MIN_FONT = 10;
export const MAX_FONT = 32;

const FONT_KEY = "grimpad.fontSize";
const THEME_KEY = "grimpad.themeMode";
const WRAP_KEY = "grimpad.wordWrap";

function detectSystemTheme(): "light" | "dark" {
  if (typeof window === "undefined") return "dark";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function clampFont(size: number): number {
  return Math.min(MAX_FONT, Math.max(MIN_FONT, Math.round(size)));
}

function loadStoredFontSize(): number {
  try {
    const raw = localStorage.getItem(FONT_KEY);
    if (raw == null) return DEFAULT_FONT;
    const n = Number.parseInt(raw, 10);
    if (!Number.isFinite(n)) return DEFAULT_FONT;
    return clampFont(n);
  } catch {
    return DEFAULT_FONT;
  }
}

function loadStoredThemeMode(): ThemeMode {
  try {
    const raw = localStorage.getItem(THEME_KEY);
    if (raw === "system" || raw === "light" || raw === "dark") return raw;
  } catch {
    /* ignore */
  }
  return "system";
}

function loadStoredWordWrap(): boolean {
  try {
    const raw = localStorage.getItem(WRAP_KEY);
    if (raw === "0" || raw === "false") return false;
    if (raw === "1" || raw === "true") return true;
  } catch {
    /* ignore */
  }
  return true;
}

function persist(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* private mode / quota */
  }
}

const initialTheme = typeof window !== "undefined" ? loadStoredThemeMode() : "system";

export const useSettingsStore = create<SettingsState>((set, get) => ({
  themeMode: initialTheme,
  resolvedTheme:
    initialTheme === "system" ? detectSystemTheme() : initialTheme,
  fontSize: typeof window !== "undefined" ? loadStoredFontSize() : DEFAULT_FONT,
  wordWrap: typeof window !== "undefined" ? loadStoredWordWrap() : true,

  setThemeMode: (mode) => {
    const resolved = mode === "system" ? detectSystemTheme() : mode;
    set({ themeMode: mode, resolvedTheme: resolved });
    document.documentElement.dataset.theme = resolved;
    persist(THEME_KEY, mode);
  },

  setResolvedTheme: (theme) => {
    set({ resolvedTheme: theme });
    document.documentElement.dataset.theme = theme;
  },

  setFontSize: (size) => {
    const next = clampFont(size);
    set({ fontSize: next });
    persist(FONT_KEY, String(next));
  },

  bumpFontSize: (delta) => {
    get().setFontSize(get().fontSize + delta);
  },

  resetFontSize: () => {
    get().setFontSize(DEFAULT_FONT);
  },

  setWordWrap: (wrap) => {
    set({ wordWrap: wrap });
    persist(WRAP_KEY, wrap ? "1" : "0");
  },

  toggleWordWrap: () => {
    get().setWordWrap(!get().wordWrap);
  },
}));

export function initThemeListener() {
  // Apply stored theme to the document on boot
  const { themeMode, resolvedTheme } = useSettingsStore.getState();
  document.documentElement.dataset.theme =
    themeMode === "system" ? detectSystemTheme() : resolvedTheme;

  const mq = window.matchMedia("(prefers-color-scheme: dark)");
  const apply = () => {
    const { themeMode: mode, setResolvedTheme } = useSettingsStore.getState();
    if (mode === "system") {
      setResolvedTheme(mq.matches ? "dark" : "light");
    }
  };
  apply();
  mq.addEventListener("change", apply);
  return () => mq.removeEventListener("change", apply);
}
