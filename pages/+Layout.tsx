import "./tailwind.css";
import { QueryClientProvider } from "@tanstack/react-query";
import { type ReactNode, useEffect, useState } from "react";
import { usePageContext } from "vike-react/usePageContext";
import { AppLayout } from "@/components/app-layout";
import { queryClient } from "@/lib/query-client";

type ZeroProviderModule = typeof import("@/src/zero/zero-provider.client");
type ZentroZeroProviderComponent = ZeroProviderModule["ZentroZeroProvider"];

function ZeroProviderGate({
  allowAnonymous = false,
  children,
}: {
  allowAnonymous?: boolean;
  children: ReactNode;
}) {
  const pageContext = usePageContext();
  const [ZentroZeroProvider, setProvider] =
    useState<ZentroZeroProviderComponent | null>(null);

  useEffect(() => {
    let cancelled = false;
    import("@/src/zero/zero-provider.client").then((module) => {
      if (!cancelled) {
        setProvider(() => module.ZentroZeroProvider);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const zeroContext = pageContext.zeroContext;

  if (zeroContext) {
    if (!ZentroZeroProvider) {
      return null;
    }

    return (
      <ZentroZeroProvider context={zeroContext} userID={zeroContext.id}>
        {children}
      </ZentroZeroProvider>
    );
  }

  if (allowAnonymous && ZentroZeroProvider) {
    return <ZentroZeroProvider userID={null}>{children}</ZentroZeroProvider>;
  }

  return <>{children}</>;
}

export default function Layout({ children }: { children: React.ReactNode }) {
  const pageContext = usePageContext();
  const isAuthPage =
    pageContext.urlPathname === "/login" || pageContext.urlPathname === "/join";
  const isFullScreenPage =
    pageContext.urlPathname === "/pos" || pageContext.urlPathname === "/posv2";

  if (isAuthPage) {
    return (
      <QueryClientProvider client={queryClient}>
        <ZeroProviderGate allowAnonymous>{children}</ZeroProviderGate>
      </QueryClientProvider>
    );
  }

  if (isFullScreenPage) {
    return (
      <QueryClientProvider client={queryClient}>
        <ZeroProviderGate>{children}</ZeroProviderGate>
      </QueryClientProvider>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <ZeroProviderGate>
        <AppLayout>{children}</AppLayout>
      </ZeroProviderGate>
    </QueryClientProvider>
  );
}
