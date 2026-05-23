import { type ReactNode, useEffect, useState } from "react";
import { usePageContext } from "vike-react/usePageContext";

// Vike layout for the `(app)` route group.
//
// The app is configured as full CSR (`pages/+config.ts`), but this layout still
// loads the Zero provider through a client-only dynamic import so the IndexedDB
// client never enters the server bundle. We intentionally do not render children
// until the provider is ready: Zero hooks throw outside `<ZeroProvider>`.

type ZeroProviderModule = typeof import("@/src/zero/zero-provider.client");
type ZentroZeroProviderComponent = ZeroProviderModule["ZentroZeroProvider"];

export default function AppGroupLayout({ children }: { children: ReactNode }) {
  const pageContext = usePageContext();
  const [ZentroZeroProvider, setProvider] =
    useState<ZentroZeroProviderComponent | null>(null);

  useEffect(() => {
    let cancelled = false;
    import("@/src/zero/zero-provider.client").then((m) => {
      if (!cancelled) {
        setProvider(() => m.ZentroZeroProvider);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const zeroContext = pageContext.zeroContext;

  if (!(zeroContext && ZentroZeroProvider)) {
    return null;
  }

  return (
    <ZentroZeroProvider context={zeroContext} userID={zeroContext.id}>
      {children}
    </ZentroZeroProvider>
  );
}
