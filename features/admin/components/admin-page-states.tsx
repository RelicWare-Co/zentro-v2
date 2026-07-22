import { Button } from "@mantine/core";
import { AlertTriangle, Loader2 } from "lucide-react";
import { getErrorMessage } from "@/lib/utils";

export function AdminPageLoading() {
  return (
    <div className="flex min-h-[50dvh] items-center justify-center">
      <Loader2 className="size-8 animate-spin text-[var(--color-voltage)]" />
    </div>
  );
}

export function AdminTabLoading() {
  return (
    <div className="flex min-h-[30dvh] items-center justify-center">
      <Loader2 className="size-7 animate-spin text-[var(--color-voltage)]" />
    </div>
  );
}

export function AdminTabError({
  error,
  fallbackMessage,
  onRetry,
  title,
}: {
  error: unknown;
  fallbackMessage: string;
  onRetry?: () => void;
  title: string;
}) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-zinc-800 bg-[var(--color-carbon)] p-5">
      <div className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-amber-400/20 bg-amber-400/10 text-amber-200">
        <AlertTriangle className="size-4" />
      </div>
      <div className="min-w-0 space-y-1">
        <h2 className="font-semibold text-base text-white">{title}</h2>
        <p className="text-sm text-zinc-400">
          {getErrorMessage(error, fallbackMessage)}
        </p>
        {onRetry ? (
          <Button onClick={onRetry} size="compact-sm" variant="subtle">
            Reintentar
          </Button>
        ) : null}
      </div>
    </div>
  );
}

export function AdminPageError({ error }: { error: unknown }) {
  return (
    <div className="flex min-h-[50dvh] items-center justify-center p-6">
      <div className="flex max-w-md items-start gap-3 rounded-xl border border-zinc-800 bg-[var(--color-carbon)] p-5">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-amber-400/20 bg-amber-400/10 text-amber-200">
          <AlertTriangle className="size-4" />
        </div>
        <div className="min-w-0 space-y-1">
          <h2 className="font-semibold text-base text-white">
            No se pudo cargar el panel de administración
          </h2>
          <p className="text-sm text-zinc-400">
            {getErrorMessage(
              error,
              "Ocurrió un error al cargar los usuarios. Intenta de nuevo."
            )}
          </p>
        </div>
      </div>
    </div>
  );
}
