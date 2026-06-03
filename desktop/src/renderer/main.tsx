import {
  LoaderCircle,
  MonitorCheck,
  RefreshCw,
  Settings,
  WifiOff,
} from "lucide-react";
import { StrictMode, useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";

import type { DesktopConnectionStatus } from "../desktop-api";
import { ZentroAppIcon, ZentroBrandHeader } from "./zentro-brand";
import "./styles.css";

const initialStatus: DesktopConnectionStatus = {
  message: "Estamos verificando la conexión con la aplicación web de Zentro.",
  state: "checking",
  webAppUrl: null,
};

const statusContent = (status: DesktopConnectionStatus) => {
  if (status.state === "offline") {
    return {
      action: "retry" as const,
      description: status.message,
      eyebrow: "Aplicación no disponible",
      overlay: <WifiOff aria-hidden className="size-5 text-amber-200" />,
      title: "No se pudo conectar a la aplicación",
    };
  }

  if (status.state === "configuration-error") {
    return {
      action: "none" as const,
      description: status.message,
      eyebrow: "Configuración pendiente",
      hint: "Cierra la app, define la URL en desktop/.env o en el entorno, y vuelve a abrir Zentro Desktop.",
      overlay: <Settings aria-hidden className="size-5 text-zinc-300" />,
      title: "Configura la URL web de Zentro",
    };
  }

  return {
    action: "none" as const,
    description: status.message,
    eyebrow: "Verificando conexión",
    hint: "La app principal se abrirá automáticamente cuando responda.",
    overlay: (
      <LoaderCircle
        aria-hidden
        className="size-5 animate-spin text-[var(--color-voltage)]"
      />
    ),
    title: "Conectando con Zentro",
  };
};

function DesktopShell() {
  const [status, setStatus] = useState<DesktopConnectionStatus>(initialStatus);
  const [isRetrying, setIsRetrying] = useState(false);
  const content = useMemo(() => statusContent(status), [status]);
  const isChecking = status.state === "checking" || isRetrying;

  useEffect(() => {
    let isMounted = true;

    window.zentroDesktop?.getConnectionStatus().then((nextStatus) => {
      if (isMounted) {
        setStatus(nextStatus);
      }
    });

    const unsubscribe = window.zentroDesktop?.onConnectionStatus(
      (nextStatus) => {
        setStatus(nextStatus);
        if (nextStatus.state !== "checking") {
          setIsRetrying(false);
        }
      }
    );

    return () => {
      isMounted = false;
      unsubscribe?.();
    };
  }, []);

  const handleRetry = async () => {
    setIsRetrying(true);

    try {
      await window.zentroDesktop?.retryConnection();
    } finally {
      setIsRetrying(false);
    }
  };

  return (
    <main className="flex min-h-dvh items-center justify-center bg-[var(--color-void)] p-4 text-[var(--color-photon)]">
      <div className="w-full max-w-md rounded-lg border border-zinc-800 bg-[var(--color-carbon)] p-5">
        <div className="flex items-start gap-3">
          <ZentroAppIcon overlay={content.overlay} />
          <div className="min-w-0">
            <ZentroBrandHeader
              subtitle={content.eyebrow}
              title={content.title}
            />
            <p className="mt-1 text-sm text-zinc-400">{content.description}</p>
          </div>
        </div>

        {status.webAppUrl ? (
          <div className="mt-4 rounded-lg border border-zinc-800 bg-zinc-900/50 px-3 py-2 font-mono text-xs text-zinc-500">
            {status.webAppUrl}
          </div>
        ) : null}

        {content.action === "retry" ? (
          <button
            className="mt-5 inline-flex h-9 w-full items-center justify-center gap-2 rounded-lg border border-zinc-700 bg-zinc-900 px-3 font-medium text-sm text-white transition-colors hover:bg-zinc-800 disabled:opacity-50"
            disabled={isChecking}
            onClick={handleRetry}
            type="button"
          >
            <RefreshCw
              aria-hidden="true"
              className={isChecking ? "size-4 animate-spin" : "size-4"}
            />
            {isChecking ? "Reintentando..." : "Reintentar conexión"}
          </button>
        ) : (
          <div className="mt-5 inline-flex w-full items-center gap-2 rounded-lg bg-zinc-900/50 px-3 py-2 text-sm text-zinc-400">
            <MonitorCheck aria-hidden="true" className="size-4" />
            {content.hint}
          </div>
        )}
      </div>
    </main>
  );
}

const root = document.getElementById("root");

if (root) {
  createRoot(root).render(
    <StrictMode>
      <DesktopShell />
    </StrictMode>
  );
}
