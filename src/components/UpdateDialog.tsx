import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import {
  closeUpdateDialog,
  dismissUpdate,
  installUpdate,
  openDownloadPage,
  useUpdateStore,
} from "../lib/updates";

/** Show 0.7 instead of 0.7.0, same as About. */
function displayVersion(v: string): string {
  return v.replace(/\.0$/, "");
}

export function UpdateDialog() {
  const { open, phase, version, notes, installed, progress, error } = useUpdateStore();
  const primaryRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") dismissUpdate();
    };
    document.addEventListener("keydown", onKey);
    requestAnimationFrame(() => primaryRef.current?.focus());
    return () => document.removeEventListener("keydown", onKey);
  }, [open, phase]);

  if (!open) return null;

  let title = "Updates";
  let body: React.ReactNode = null;
  let actions: React.ReactNode = (
    <button ref={primaryRef} type="button" className="about-ok" onClick={closeUpdateDialog}>
      OK
    </button>
  );

  if (phase === "checking") {
    body = <p className="about-blurb">Checking for updates…</p>;
  } else if (phase === "none") {
    body = <p className="about-blurb">Grimpad is up to date.</p>;
  } else if (phase === "error") {
    title = "Update failed";
    body = (
      <>
        <p className="about-blurb">Couldn't reach the update server or finish the update.</p>
        <p className="about-meta update-error">{error}</p>
      </>
    );
  } else if (phase === "downloading") {
    title = `Updating to ${displayVersion(version)}`;
    body = (
      <>
        <p className="about-blurb">Downloading. Grimpad will close, install and reopen.</p>
        <div className="update-progress" aria-hidden="true">
          <div
            className={progress === null ? "update-progress-bar indeterminate" : "update-progress-bar"}
            style={progress === null ? undefined : { width: `${Math.round(progress * 100)}%` }}
          />
        </div>
      </>
    );
    actions = null;
  } else if (phase === "available") {
    title = `Grimpad ${displayVersion(version)} is available`;
    body = (
      <>
        {notes ? <div className="update-notes">{notes}</div> : null}
        <p className="about-meta">
          {installed
            ? "Grimpad will close, install and reopen. Unsaved tabs in this window come back. Save anything in other Grimpad windows first."
            : "This is the portable copy, so it can't update itself. Download the new version from GitHub."}
        </p>
      </>
    );
    actions = (
      <div className="update-actions">
        <button type="button" className="update-later" onClick={dismissUpdate}>
          Later
        </button>
        {installed ? (
          <button ref={primaryRef} type="button" className="about-ok" onClick={() => void installUpdate()}>
            Install
          </button>
        ) : (
          <button ref={primaryRef} type="button" className="about-ok" onClick={openDownloadPage}>
            Download
          </button>
        )}
      </div>
    );
  }

  return createPortal(
    <div className="about-overlay" role="presentation" onMouseDown={dismissUpdate}>
      <div
        className="about-dialog update-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="update-title"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <h1 id="update-title" className="about-title">
          {title}
        </h1>
        {body}
        {actions}
      </div>
    </div>,
    document.body,
  );
}
