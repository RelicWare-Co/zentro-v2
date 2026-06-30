import { useState } from "react";

export function isZentroDesktop() {
  return (
    typeof window !== "undefined" && window.zentroDesktop?.isDesktop === true
  );
}

export function useIsZentroDesktop() {
  const [isDesktop] = useState(() => isZentroDesktop());

  return isDesktop;
}

export async function openZentroDesktopDevTools() {
  await window.zentroDesktop?.openDevTools();
}
