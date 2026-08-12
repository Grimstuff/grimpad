/** Show the main window after first paint (starts hidden to avoid size flash). */
export async function revealMainWindow(): Promise<void> {
  try {
    const { getCurrentWindow } = await import("@tauri-apps/api/window");
    const win = getCurrentWindow();

    // Wait two frames so React/layout can paint on the dark background.
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => resolve());
      });
    });

    // Tiny settle for window-state restore of size/position.
    await new Promise((r) => setTimeout(r, 16));

    await win.show();
    await win.setFocus();
  } catch {
    // Browser preview / non-Tauri
  }
}
