import { useCajaPrintQueue } from "@/features/restaurants/hooks/use-caja-print-queue.client";

/**
 * Componente mudo: monta el watcher de impresión de la caja en toda la app.
 * Se importa dinámicamente desde `pages/(app)/+Layout.tsx` para mantener el
 * módulo `.client` fuera del grafo no-client.
 */
export function CajaPrintQueueWatcher() {
  useCajaPrintQueue();
  return null;
}
