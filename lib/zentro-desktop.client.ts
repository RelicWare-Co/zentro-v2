import { useEffect, useState } from "react";

export function isZentroDesktop() {
  return (
    typeof window !== "undefined" && window.zentroDesktop?.isDesktop === true
  );
}

export function useIsZentroDesktop() {
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    setIsDesktop(isZentroDesktop());
  }, []);

  return isDesktop;
}

export async function openZentroDesktopDevTools() {
  await window.zentroDesktop?.openDevTools();
}
