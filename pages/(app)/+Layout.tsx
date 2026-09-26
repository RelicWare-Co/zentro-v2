import { type ComponentType, type ReactNode, useEffect, useState } from "react";

function ClientCajaPrintQueueWatcher() {
  const [Watcher, setWatcher] = useState<ComponentType | null>(null);

  useEffect(() => {
    let cancelled = false;

    import("@/components/caja-print-queue-watcher.client").then((module) => {
      if (!cancelled) {
        setWatcher(() => module.CajaPrintQueueWatcher);
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  return Watcher ? <Watcher /> : null;
}

export default function AppGroupLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <ClientCajaPrintQueueWatcher />
      {children}
    </>
  );
}
