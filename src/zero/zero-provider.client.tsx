// Client-only Zero React provider.
//
// The `.client.tsx` suffix tells Vike never to import this file from the
// SSR/server bundle. The Zero client constructor opens an IndexedDB
// connection and is browser-only, so it cannot be imported during SSR.
//
// Mount this through the dynamic-import wrapper in `pages/+Layout.tsx`
// rather than importing it directly from a non-client module.

import { ZeroProvider } from "@rocicorp/zero/react";
import { type ReactNode, useMemo, useRef } from "react";
import { createZeroOptions } from "./client";
import type { ZeroContext } from "./context";
import { resolveStableZeroContext } from "./zero-context-stable.shared";

function useStableZeroContext(context: ZeroContext | undefined) {
  const stableRef = useRef<ZeroContext | undefined>(context);
  const signatureRef = useRef<string | null>(null);

  return useMemo(() => {
    const resolved = resolveStableZeroContext(
      stableRef.current,
      signatureRef.current,
      context
    );
    stableRef.current = resolved.context;
    signatureRef.current = resolved.signature;
    return resolved.context;
  }, [context]);
}

export interface ZentroZeroProviderProps {
  cacheURL: string;
  children: ReactNode;
  context?: ZeroContext;
  userID: string | null;
}

export function ZentroZeroProvider({
  cacheURL,
  userID,
  context,
  children,
}: ZentroZeroProviderProps) {
  const stableContext = useStableZeroContext(context);
  const opts = useMemo(
    () =>
      createZeroOptions({
        cacheURL,
        userID,
        context: stableContext,
      }),
    [cacheURL, stableContext, userID]
  );

  return <ZeroProvider {...opts}>{children}</ZeroProvider>;
}
