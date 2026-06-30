import { Button } from "@mantine/core";
import type { ConnectionState } from "@rocicorp/zero";
import { useZero } from "@rocicorp/zero/react";
import { AlertTriangle, RefreshCw, RotateCcw } from "lucide-react";
import { type ReactNode, useMemo, useSyncExternalStore } from "react";

const SLOW_CONNECTION_MS = 15_000;

interface ConnectionStateSource {
  readonly current: ConnectionState;
  subscribe(listener: (state: ConnectionState) => void): () => void;
}

interface ConnectionBoundarySnapshot {
  connectionState: ConnectionState;
  hasConnected: boolean;
  isSlowConnection: boolean;
}

const reload = () => {
  window.location.reload();
};

const goToLogin = () => {
  window.location.href = "/login";
};

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
          color="gray"
          fullWidth
          leftSection={<RefreshCw className="size-4" />}
          mt="lg"
          onClick={onAction}
          type="button"
          variant="outline"
        >
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

function createConnectionBoundaryStore(source: ConnectionStateSource) {
  const listeners = new Set<() => void>();
  let connectionState = source.current;
  let hasConnected = connectionState.name === "connected";
  let isSlowConnection = false;
  let snapshot: ConnectionBoundarySnapshot = {
    connectionState,
    hasConnected,
    isSlowConnection,
  };
  let timeout: number | undefined;
  let unsubscribe: (() => void) | undefined;

  const clearSlowConnectionTimeout = () => {
    if (timeout === undefined) {
      return;
    }

    window.clearTimeout(timeout);
    timeout = undefined;
  };

  const emit = () => {
    for (const listener of listeners) {
      listener();
    }
  };

  const updateSnapshot = () => {
    if (
      Object.is(snapshot.connectionState, connectionState) &&
      snapshot.hasConnected === hasConnected &&
      snapshot.isSlowConnection === isSlowConnection
    ) {
      return false;
    }

    snapshot = {
      connectionState,
      hasConnected,
      isSlowConnection,
    };
    return true;
  };

  const scheduleSlowConnectionTimeout = () => {
    if (timeout !== undefined || isSlowConnection) {
      return;
    }

    timeout = window.setTimeout(() => {
      timeout = undefined;
      if (connectionState.name !== "connecting" || isSlowConnection) {
        return;
      }

      isSlowConnection = true;
      if (updateSnapshot()) {
        emit();
      }
    }, SLOW_CONNECTION_MS);
  };

  const syncConnectionState = (nextState: ConnectionState) => {
    connectionState = nextState;

    if (nextState.name === "connected") {
      hasConnected = true;
    }

    if (nextState.name === "connecting") {
      scheduleSlowConnectionTimeout();
    } else {
      clearSlowConnectionTimeout();
      isSlowConnection = false;
    }

    return updateSnapshot();
  };

  return {
    getSnapshot: () => snapshot,
    subscribe: (listener: () => void) => {
      listeners.add(listener);

      if (syncConnectionState(source.current)) {
        listener();
      }

      unsubscribe ??= source.subscribe((nextState) => {
        if (syncConnectionState(nextState)) {
          emit();
        }
      });

      return () => {
        listeners.delete(listener);

        if (listeners.size > 0) {
          return;
        }

        unsubscribe?.();
        unsubscribe = undefined;
        clearSlowConnectionTimeout();
      };
    },
  };
}

export function ZeroConnectionBoundary({
  children,
  mode = "required",
}: {
  children: ReactNode;
  mode?: "optional" | "required";
}) {
  const zero = useZero();
  const connectionStateSource = zero.connection.state;
  // react-doctor-disable-next-line react-doctor/react-compiler-no-manual-memoization -- store state must persist for a given Zero connection source.
  const connectionStore = useMemo(
    () => createConnectionBoundaryStore(connectionStateSource),
    [connectionStateSource]
  );
  const { connectionState, hasConnected, isSlowConnection } =
    useSyncExternalStore(
      connectionStore.subscribe,
      connectionStore.getSnapshot,
      connectionStore.getSnapshot
    );

  const retryConnection = () => {
    zero.connection.connect().catch(() => undefined);
  };

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

  if (connectionState.name === "disconnected" && !hasConnected) {
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
    !hasConnected
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

  if (connectionState.name === "disconnected" && hasConnected) {
    return (
      <div className="relative min-h-0 flex-1">
        <OfflineBanner onRetry={retryConnection} />
        {children}
      </div>
    );
  }

  return children;
}
