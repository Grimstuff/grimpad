import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import appIcon from "../assets/app-icon.png";

/** Fallback if Tauri getVersion is unavailable (browser preview). */
const FALLBACK_VERSION = "0.3.0";

interface AboutDialogProps {
  open: boolean;
  onClose: () => void;
}

export function AboutDialog({ open, onClose }: AboutDialogProps) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const [version, setVersion] = useState(FALLBACK_VERSION);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const { getVersion } = await import("@tauri-apps/api/app");
        const v = await getVersion();
        if (!cancelled && v) setVersion(v);
      } catch {
        /* browser / non-Tauri */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    requestAnimationFrame(() => closeRef.current?.focus());
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div className="about-overlay" role="presentation" onMouseDown={onClose}>
      <div
        className="about-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="about-title"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <img
          className="about-icon"
          src={appIcon}
          alt="Grimpad"
          width={72}
          height={72}
          draggable={false}
        />
        <h1 id="about-title" className="about-title">
          Grimpad
        </h1>
        <p className="about-version">Version {version}</p>
        <p className="about-blurb">A lightweight notepad and code viewer.</p>
        <p className="about-meta">
          Built with Tauri, React, the Monaco Editor, and MDXEditor.
        </p>
        <button ref={closeRef} type="button" className="about-ok" onClick={onClose}>
          OK
        </button>
      </div>
    </div>,
    document.body,
  );
}
