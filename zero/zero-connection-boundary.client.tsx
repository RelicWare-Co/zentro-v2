import type { ConnectionState } from "@rocicorp/zero";
import { useConnectionState, useZero } from "@rocicorp/zero/react";
import { AlertTriangle, RefreshCw, RotateCcw } from "lucide-react";
import {
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { Button } from "@/components/ui/button";

const SLOW_CONNECTION_MS = 15_000;

type NeedsAuthReason = Extract<
  ConnectionState,
  { name: "needs-auth" }
>["reason"];

function formatNeedsAuthReason(reason: NeedsAuthReason) {
  if (typeof reason === "string") {
    return reason;
  }

  if (reason.type === "zero-cache") {
    return reason.reason;
  }

  return `La autenticación falló al sincronizar ${reason.type === "query" ? "consultas" : "mutaciones"} (${reason.status}).`;
}

function ZeroConnectionProblem({
  actionLabel,
  message,
  onAction,
  title,
}: {
  actionLabel: string;
  message: string;
  onAction: () => void;
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
        <Button
          className="mt-5 w-full border-zinc-700 bg-zinc-900 text-white hover:bg-zinc-800"
          onClick={onAction}
          type="button"
          variant="outline"
        >
          <RefreshCw className="size-4" />
          {actionLabel}
        </Button>
      </div>
    </div>
  );
}

function OfflineBanner({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="absolute top-3 right-3 left-3 z-[70] mx-auto flex max-w-xl items-center gap-3 rounded-lg border border-amber-400/20 bg-zinc-950/95 px-3 py-2 text-amber-100 text-sm shadow-lg backdrop-blur">
      <AlertTriangle className="size-4 shrink-0" />
      <span className="min-w-0 flex-1 truncate">
        Sin conexión con Zero. Se muestran datos locales mientras se reconecta.
      </span>
      <button
        aria-label="Reintentar conexión con Zero"
        className="inline-flex size-7 shrink-0 items-center justify-center rounded-md text-amber-100 transition-colors hover:bg-white/10"
        onClick={onRetry}
        type="button"
      >
        <RotateCcw className="size-4" />
      </button>
    </div>
  );
}

export function ZeroConnectionBoundary({
  children,
  mode = "required",
}: {
  children: ReactNode;
  mode?: "optional" | "required";
}) {
  const zero = useZero();
  const connectionState = useConnectionState();
  const hasConnectedRef = useRef(connectionState.name === "connected");
  const [isSlowConnection, setIsSlowConnection] = useState(false);

  if (connectionState.name === "connected") {
    hasConnectedRef.current = true;
  }

  useEffect(() => {
    if (connectionState.name !== "connecting") {
      setIsSlowConnection(false);
      return;
    }

    const timeout = window.setTimeout(() => {
      setIsSlowConnection(true);
    }, SLOW_CONNECTION_MS);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [connectionState.name]);

  const retryConnection = useCallback(() => {
    zero.connection.connect().catch(() => undefined);
  }, [zero]);

  const reload = useCallback(() => {
    window.location.reload();
  }, []);

  const goToLogin = useCallback(() => {
    window.location.href = "/login";
  }, []);

  if (mode === "optional") {
    return children;
  }

  if (connectionState.name === "needs-auth") {
    return (
      <ZeroConnectionProblem
        actionLabel="Iniciar sesión"
        message={formatNeedsAuthReason(connectionState.reason)}
        onAction={goToLogin}
        title="La sesión de sincronización expiró"
      />
    );
  }

  if (connectionState.name === "error") {
    return (
      <ZeroConnectionProblem
        actionLabel="Reintentar"
        message={connectionState.reason}
        onAction={retryConnection}
        title="Zero detuvo la sincronización"
      />
    );
  }

  if (connectionState.name === "closed") {
    return (
      <ZeroConnectionProblem
        actionLabel="Recargar"
        message={connectionState.reason}
        onAction={reload}
        title="La conexión de Zero se cerró"
      />
    );
  }

  if (connectionState.name === "disconnected" && !hasConnectedRef.current) {
    return (
      <ZeroConnectionProblem
        actionLabel="Recargar"
        message={connectionState.reason}
        onAction={reload}
        title="No se pudo conectar con Zero"
      />
    );
  }

  if (
    connectionState.name === "connecting" &&
    isSlowConnection &&
    !hasConnectedRef.current
  ) {
    return (
      <ZeroConnectionProblem
        actionLabel="Recargar"
        message="La sincronización inicial está tardando más de lo esperado."
        onAction={reload}
        title="Conectando con Zero"
      />
    );
  }

  if (connectionState.name === "disconnected" && hasConnectedRef.current) {
    return (
      <div className="relative min-h-0 flex-1">
        <OfflineBanner onRetry={retryConnection} />
        {children}
      </div>
    );
  }

  return children;
}
