import "./tailwind.css";
import { type ReactNode, useEffect, useState } from "react";
import { usePageContext } from "vike-react/usePageContext";
import { AppLayout } from "@/components/app-layout";
import { Toaster } from "@/components/ui/sonner";
import { TanstackQueryProvider } from "@/lib/query-provider";

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

  if (allowAnonymous) {
    return null;
  }

  return <>{children}</>;
}

export default function Layout({ children }: { children: React.ReactNode }) {
  const pageContext = usePageContext();
  const isAuthPage =
    pageContext.urlPathname === "/login" || pageContext.urlPathname === "/join";

  let content: ReactNode;

  if (isAuthPage) {
    content = <ZeroProviderGate allowAnonymous>{children}</ZeroProviderGate>;
  } else {
    content = (
      <ZeroProviderGate>
        <AppLayout>{children}</AppLayout>
      </ZeroProviderGate>
    );
  }

  return (
    <TanstackQueryProvider>
      {content}
      <Toaster richColors />
    </TanstackQueryProvider>
  );
}
