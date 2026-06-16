import { type ReactNode, useEffect } from "react";

export function PrintReceiptLifecycle({
  children,
  onReady,
}: {
  children: ReactNode;
  onReady: () => void;
}) {
  useEffect(() => {
    const timeoutId = window.setTimeout(onReady, 60);
    return () => window.clearTimeout(timeoutId);
  }, [onReady]);

  return <>{children}</>;
}
