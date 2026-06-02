import {
  LoaderCircle,
  MonitorCheck,
  RefreshCw,
  Settings,
  WifiOff,
} from "lucide-react";
import { StrictMode, useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import type { DesktopConnectionStatus } from "../desktop-api";
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
      icon: WifiOff,
      title: "No se pudo conectar a la aplicación",
    };
  }

  if (status.state === "configuration-error") {
    return {
      action: "none" as const,
      description: status.message,
      eyebrow: "Configuración pendiente",
      hint: "Cierra la app, define la URL en desktop/.env o en el entorno, y vuelve a abrir Zentro Desktop.",
      icon: Settings,
      title: "Configura la URL web de Zentro",
    };
  }

  return {
    action: "none" as const,
    description: status.message,
    eyebrow: "Verificando conexión",
    hint: "La app principal se abrirá automáticamente cuando responda.",
    icon: LoaderCircle,
    title: "Conectando con Zentro",
  };
};

function DesktopShell() {
  const [status, setStatus] = useState<DesktopConnectionStatus>(initialStatus);
  const [isRetrying, setIsRetrying] = useState(false);
  const content = useMemo(() => statusContent(status), [status]);
  const Icon = content.icon;
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
    <main className="min-h-dvh overflow-hidden bg-background text-foreground">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_color-mix(in_oklch,_var(--primary)_18%,_transparent),_transparent_38%),linear-gradient(135deg,_color-mix(in_oklch,_var(--card)_82%,_transparent),_var(--background))]" />
      <section className="relative flex min-h-dvh items-center justify-center p-6">
        <Card className="w-full max-w-[520px] border border-border/60 bg-card/95 shadow-2xl shadow-black/25 backdrop-blur">
          <CardHeader className="gap-3 text-center">
            <div className="mx-auto flex size-14 items-center justify-center rounded-2xl border border-border bg-muted/60 text-primary">
              <Icon
                aria-hidden="true"
                className={isChecking ? "size-7 animate-spin" : "size-7"}
              />
            </div>
            <div className="space-y-2">
              <p className="font-medium text-muted-foreground text-xs uppercase tracking-[0.28em]">
                {content.eyebrow}
              </p>
              <CardTitle className="text-2xl">{content.title}</CardTitle>
              <CardDescription className="mx-auto max-w-[420px] leading-6">
                {content.description}
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 text-center">
            {status.webAppUrl ? (
              <div className="rounded-lg border bg-muted/40 px-3 py-2 font-mono text-muted-foreground text-xs">
                {status.webAppUrl}
              </div>
            ) : null}
            {content.action === "retry" ? (
              <Button
                className="w-full sm:w-auto"
                disabled={isChecking}
                onClick={handleRetry}
                size="lg"
                type="button"
              >
                <RefreshCw
                  aria-hidden="true"
                  className={isChecking ? "animate-spin" : undefined}
                />
                {isChecking ? "Reintentando..." : "Reintentar conexión"}
              </Button>
            ) : (
              <div className="inline-flex items-center gap-2 rounded-lg bg-muted/50 px-3 py-2 text-muted-foreground text-sm">
                <MonitorCheck aria-hidden="true" className="size-4" />
                {content.hint}
              </div>
            )}
          </CardContent>
        </Card>
      </section>
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
