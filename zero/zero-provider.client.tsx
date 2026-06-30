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
import { ZeroConnectionBoundary } from "./zero-connection-boundary.client";
import { zeroContextFingerprint } from "./zero-context-stable.shared";

function useStableZeroContext(context: ZeroContext | undefined) {
  const stableRef = useRef<ZeroContext | undefined>(undefined);
  const fingerprintRef = useRef<string | null | undefined>(undefined);

  const fingerprint = zeroContextFingerprint(context);
  if (fingerprint !== fingerprintRef.current) {
    fingerprintRef.current = fingerprint;
    stableRef.current = context;
  }

  return stableRef.current;
}

export interface ZentroZeroProviderProps {
  cacheURL: string;
  children: ReactNode;
  context?: ZeroContext;
  mode?: "optional" | "required";
  userID: string | null;
}

export function ZentroZeroProvider({
  cacheURL,
  userID,
  context,
  mode = "required",
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

  return (
    <ZeroProvider {...opts}>
      <ZeroConnectionBoundary mode={mode}>{children}</ZeroConnectionBoundary>
    </ZeroProvider>
  );
}
