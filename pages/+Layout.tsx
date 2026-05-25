import "./tailwind.css";
import { Loader2 } from "lucide-react";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { usePageContext } from "vike-react/usePageContext";
import { AppLayout } from "@/components/app-layout";
import { Toaster } from "@/components/ui/sonner";
import { TanstackQueryProvider } from "@/lib/query-provider";

type ZeroProviderModule = typeof import("@/src/zero/zero-provider.client");
type ZentroZeroProviderComponent = ZeroProviderModule["ZentroZeroProvider"];

function isRemotePageWithLocalCacheURL(cacheURL: string) {
  if (typeof window === "undefined") {
    return false;
  }

  const pageHost = window.location.hostname;
  const isLocalPage =
    pageHost === "localhost" || pageHost === "127.0.0.1" || pageHost === "::1";

  if (isLocalPage) {
    return false;
  }

  try {
    const cacheHost = new URL(cacheURL).hostname;
    return cacheHost === "localhost" || cacheHost === "127.0.0.1";
  } catch {
    return false;
  }
}

function getUsableCacheURL(cacheURL: string | undefined) {
  if (!cacheURL?.trim()) {
    return null;
  }

  if (isRemotePageWithLocalCacheURL(cacheURL)) {
    return null;
  }

  return cacheURL;
}

function ZeroProviderLoading() {
  return (
    <div className="app-safe-area flex min-h-[100dvh] w-full items-center justify-center bg-[var(--color-void)] text-[var(--color-photon)]">
      <Loader2 className="size-8 animate-spin text-[var(--color-voltage)]" />
    </div>
  );
}

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
  const [runtimeCacheURL, setRuntimeCacheURL] = useState<string | null>(() =>
    getUsableCacheURL(pageContext.zeroCacheURL)
  );
  const latestZeroContextRef = useRef(pageContext.zeroContext);

  if (!pageContext.user) {
    latestZeroContextRef.current = null;
  } else if (pageContext.zeroContext) {
    latestZeroContextRef.current = pageContext.zeroContext;
  }

  const zeroContext = pageContext.zeroContext ?? latestZeroContextRef.current;

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

  useEffect(() => {
    let cancelled = false;

    fetch("/api/runtime-config", {
      headers: {
        accept: "application/json",
      },
    })
      .then(async (response) => {
        if (!response.ok) {
          return;
        }

        const config = (await response.json()) as { zeroCacheURL?: unknown };
        const cacheURL =
          typeof config.zeroCacheURL === "string"
            ? getUsableCacheURL(config.zeroCacheURL)
            : null;

        if (!(cancelled || !cacheURL)) {
          setRuntimeCacheURL(cacheURL);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setRuntimeCacheURL(getUsableCacheURL(pageContext.zeroCacheURL));
        }
      });

    return () => {
      cancelled = true;
    };
  }, [pageContext.zeroCacheURL]);

  const cacheURL = runtimeCacheURL;

  if (!(ZentroZeroProvider && cacheURL)) {
    return allowAnonymous ? null : <ZeroProviderLoading />;
  }

  const Provider = ZentroZeroProvider;
  const resolvedCacheURL = cacheURL;

  if (zeroContext) {
    return (
      <Provider
        cacheURL={resolvedCacheURL}
        context={zeroContext}
        userID={zeroContext.id}
      >
        {children}
      </Provider>
    );
  }

  if (allowAnonymous) {
    return (
      <Provider cacheURL={resolvedCacheURL} userID={null}>
        {children}
      </Provider>
    );
  }

  // App routes mount Zero hooks in AppLayout. Never render them outside
  // ZeroProvider — pageContext.zeroContext can lag behind client auth in prod.
  return <ZeroProviderLoading />;
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
