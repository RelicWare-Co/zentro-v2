import "./tailwind.css";
import { AlertTriangle, Loader2, RefreshCw } from "lucide-react";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { usePageContext } from "vike-react/usePageContext";
import { AppLayout } from "@/components/app-layout";
import { Toaster } from "@/components/ui/sonner";
import { TanstackQueryProvider } from "@/lib/query-provider";

type ZeroProviderModule = typeof import("@/src/zero/zero-provider.client");
type ZentroZeroProviderComponent = ZeroProviderModule["ZentroZeroProvider"];
type LoadingState = "error" | "loading" | "ready";
interface RuntimeCacheURLResult {
  cacheURL: string | null;
  state: LoadingState;
}

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

function resolveRuntimeCacheURL(
  cacheURL: string | null
): RuntimeCacheURLResult {
  return {
    cacheURL,
    state: cacheURL ? "ready" : "error",
  };
}

async function readRuntimeCacheURL(
  response: Response,
  fallbackCacheURL: string | undefined
): Promise<RuntimeCacheURLResult> {
  if (!response.ok) {
    return resolveRuntimeCacheURL(getUsableCacheURL(fallbackCacheURL));
  }

  const config = (await response.json()) as { zeroCacheURL?: unknown };
  const cacheURL =
    typeof config.zeroCacheURL === "string"
      ? getUsableCacheURL(config.zeroCacheURL)
      : null;

  return resolveRuntimeCacheURL(cacheURL);
}

function ZeroProviderLoading() {
  return (
    <div className="app-safe-area flex min-h-[100dvh] w-full items-center justify-center bg-[var(--color-void)] text-[var(--color-photon)]">
      <Loader2 className="size-8 animate-spin text-[var(--color-voltage)]" />
    </div>
  );
}

function ZeroProviderProblem({
  actionLabel = "Recargar",
  message,
  onAction = () => window.location.reload(),
  title,
}: {
  actionLabel?: string;
  message: string;
  onAction?: () => void;
  title: string;
}) {
  return (
    <div className="app-safe-area flex min-h-[100dvh] w-full items-center justify-center bg-[var(--color-void)] p-4 text-[var(--color-photon)]">
      <div className="w-full max-w-md rounded-lg border border-zinc-800 bg-[var(--color-carbon)] p-5 shadow-none">
        <div className="flex items-start gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-amber-400/20 bg-amber-400/10 text-amber-200">
            <AlertTriangle className="size-4" />
          </div>
          <div className="min-w-0 space-y-1">
            <h1 className="font-semibold text-base text-white">{title}</h1>
            <p className="text-sm text-zinc-400">{message}</p>
          </div>
        </div>
        <button
          className="mt-5 inline-flex h-9 w-full items-center justify-center gap-2 rounded-lg border border-zinc-700 bg-zinc-900 px-3 font-medium text-sm text-white transition-colors hover:bg-zinc-800"
          onClick={onAction}
          type="button"
        >
          <RefreshCw className="size-4" />
          {actionLabel}
        </button>
      </div>
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
  const initialCacheURL = getUsableCacheURL(pageContext.zeroCacheURL);
  const [ZentroZeroProvider, setProvider] =
    useState<ZentroZeroProviderComponent | null>(null);
  const [providerState, setProviderState] = useState<LoadingState>("loading");
  const [runtimeState, setRuntimeState] = useState<LoadingState>(() =>
    initialCacheURL ? "ready" : "loading"
  );
  const [runtimeCacheURL, setRuntimeCacheURL] = useState<string | null>(
    initialCacheURL
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
    import("@/src/zero/zero-provider.client")
      .then((module) => {
        if (!cancelled) {
          setProvider(() => module.ZentroZeroProvider);
          setProviderState("ready");
        }
      })
      .catch(() => {
        if (!cancelled) {
          setProviderState("error");
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
      .then((response) =>
        readRuntimeCacheURL(response, pageContext.zeroCacheURL)
      )
      .then((result) => {
        if (!cancelled) {
          setRuntimeCacheURL(result.cacheURL);
          setRuntimeState(result.state);
        }
      })
      .catch(() => {
        if (!cancelled) {
          const result = resolveRuntimeCacheURL(
            getUsableCacheURL(pageContext.zeroCacheURL)
          );
          setRuntimeCacheURL(result.cacheURL);
          setRuntimeState(result.state);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [pageContext.zeroCacheURL]);

  const cacheURL = runtimeCacheURL;

  if (providerState === "error") {
    return (
      <ZeroProviderProblem
        message="No se pudo cargar el cliente de sincronización."
        title="Zero no está disponible"
      />
    );
  }

  if (runtimeState === "error") {
    return (
      <ZeroProviderProblem
        message="La URL pública de zero-cache no está configurada para este entorno."
        title="Configuración de Zero incompleta"
      />
    );
  }

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
        mode={allowAnonymous ? "optional" : "required"}
        userID={zeroContext.id}
      >
        {children}
      </Provider>
    );
  }

  if (allowAnonymous) {
    return (
      <Provider cacheURL={resolvedCacheURL} mode="optional" userID={null}>
        {children}
      </Provider>
    );
  }

  // App routes mount Zero hooks in AppLayout. Never render them outside
  // ZeroProvider — pageContext.zeroContext can lag behind client auth in prod.
  return pageContext.user ? (
    <ZeroProviderProblem
      actionLabel="Ir a login"
      message="La sesión existe, pero no se pudo resolver el contexto de sincronización."
      onAction={() => {
        window.location.href = "/login";
      }}
      title="Contexto de Zero no disponible"
    />
  ) : (
    <ZeroProviderLoading />
  );
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
