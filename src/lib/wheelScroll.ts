import { invoke } from "@tauri-apps/api/core";

export type WheelScroll =
  | { mode: "none" }
  | { mode: "page" }
  | { mode: "lines"; lines: number };

/** Monaco: one typical mouse notch → 50px when mouseWheelScrollSensitivity is 1. */
const MONACO_PX_PER_NOTCH = 50;

let cached: WheelScroll = { mode: "lines", lines: 3 };
const listeners = new Set<(s: WheelScroll) => void>();

export function getCachedWheelScroll(): WheelScroll {
  return cached;
}

export function monacoWheelSensitivity(
  scroll: WheelScroll,
  lineHeight: number,
  viewportHeight: number,
): number {
  const lh = Math.max(8, lineHeight);
  if (scroll.mode === "none") return 0.05;
  const px = scroll.mode === "page" ? Math.max(lh, viewportHeight) : scroll.lines * lh;
  return Math.max(0.1, Math.min(40, px / MONACO_PX_PER_NOTCH));
}

/** Discrete-notch estimate from a wheel event (Chromium / WebView2). */
export function wheelNotches(e: WheelEvent): number {
  const wd = (e as WheelEvent & { wheelDelta?: number }).wheelDelta;
  if (typeof wd === "number" && wd !== 0) return -wd / 120;
  if (e.deltaMode === WheelEvent.DOM_DELTA_LINE) return e.deltaY;
  if (e.deltaMode === WheelEvent.DOM_DELTA_PAGE) return e.deltaY * 3;
  return e.deltaY / 100;
}

export function subscribeWheelScroll(fn: (s: WheelScroll) => void): () => void {
  listeners.add(fn);
  fn(cached);
  return () => {
    listeners.delete(fn);
  };
}

async function refresh(): Promise<void> {
  try {
    const raw = await invoke<{ mode: string; lines?: number }>("get_wheel_scroll");
    const next: WheelScroll =
      raw.mode === "page"
        ? { mode: "page" }
        : raw.mode === "none"
          ? { mode: "none" }
          : { mode: "lines", lines: Math.max(1, Math.min(100, raw.lines ?? 3)) };
    cached = next;
    for (const fn of listeners) fn(next);
  } catch {
    /* browser preview */
  }
}

export function initWheelScroll(): () => void {
  void refresh();
  const onFocus = () => void refresh();
  window.addEventListener("focus", onFocus);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") void refresh();
  });
  return () => {
    window.removeEventListener("focus", onFocus);
  };
}
