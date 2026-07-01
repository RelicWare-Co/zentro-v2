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
import { ZeroConnectionBoundary } from "./zero-connection-boundary.client";

function useStableZeroContext(context: ZeroContext | undefined) {
  const policy = context?.organizationPolicy;
  const allowSelfServiceCreation = policy?.allowSelfServiceCreation ?? false;
  const contactHref = policy?.contactHref ?? null;
  const contactLabel = policy?.contactLabel ?? "";
  const contactMessage = policy?.contactMessage ?? "";
  const email = context?.email;
  const id = context?.id;
  const orgID = context?.orgID ?? null;
  const role = context?.role ?? null;
  const systemRole = context?.systemRole ?? null;

  // react-doctor-disable-next-line react-doctor/react-compiler-no-manual-memoization -- ZeroProvider should not receive a new context object for unchanged auth facts.
  return useMemo<ZeroContext | undefined>(() => {
    if (!(id && email)) {
      return;
    }

    return {
      email,
      id,
      organizationPolicy: {
        allowSelfServiceCreation,
        contactHref,
        contactLabel,
        contactMessage,
      },
      orgID,
      role,
      systemRole,
    };
  }, [
    allowSelfServiceCreation,
    contactHref,
    contactLabel,
    contactMessage,
    email,
    id,
    orgID,
    role,
    systemRole,
  ]);
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
