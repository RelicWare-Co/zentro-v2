// Client-only Zero React provider.
//
// The `.client.tsx` suffix tells Vike never to import this file from the
// SSR/server bundle. The Zero client constructor opens an IndexedDB
// connection and is browser-only, so it cannot be imported during SSR.
//
// Mount this through the dynamic-import wrapper in `pages/(app)/+Layout.tsx`
// rather than importing it directly from a non-client module.

import { ZeroProvider } from "@rocicorp/zero/react";
import { type ReactNode, useMemo } from "react";
import { createZeroOptions } from "./client";
import type { ZeroContext } from "./context";

export interface ZentroZeroProviderProps {
  children: ReactNode;
  context: ZeroContext;
  userID: string;
}

export function ZentroZeroProvider({
  userID,
  context,
  children,
}: ZentroZeroProviderProps) {
  const { id, orgID, role, systemRole } = context;
  const opts = useMemo(
    () =>
      createZeroOptions({
        userID,
        context: { id, orgID, role, systemRole },
      }),
    [id, orgID, role, systemRole, userID]
  );

  return <ZeroProvider {...opts}>{children}</ZeroProvider>;
}
