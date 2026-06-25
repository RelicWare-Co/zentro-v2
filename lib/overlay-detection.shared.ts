/**
 * Shared overlay detection for scanner blocking.
 *
 * Mantine overlay components (Modal, Drawer, Popover, Menu, Combobox/Select
 * dropdowns) are tagged with the `zentro-overlay` class via theme-level
 * `classNames` in `lib/mantine-theme.ts`. This helper queries for that class
 * so the POS scanners can avoid processing barcodes while an overlay is open.
 */
export function hasOpenOverlay(): boolean {
  if (typeof document === "undefined") {
    return false;
  }

  return Boolean(document.querySelector(".zentro-overlay"));
}
