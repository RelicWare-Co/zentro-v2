// Client-only Zero React provider.
//
// The `.client.tsx` suffix tells Vike never to import this file from the
// SSR/server bundle. The Zero client constructor opens an IndexedDB
// connection and is browser-only, so it cannot be imported during SSR.
//
// Mount this through the dynamic-import wrapper in `pages/+Layout.tsx`
// rather than importing it directly from a non-client module.

import { ZeroProvider } from "@rocicorp/zero/react";
import { type ReactNode, useMemo } from "react";
import { createZeroOptions } from "./client";
import type { ZeroContext } from "./context";

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
  const opts = useMemo(
    () =>
      createZeroOptions({
        cacheURL,
        userID,
        context,
      }),
    [cacheURL, context, userID]
  );

  return <ZeroProvider {...opts}>{children}</ZeroProvider>;
}
