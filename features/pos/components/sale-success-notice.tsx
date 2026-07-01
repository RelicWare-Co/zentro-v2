import { Transition } from "@mantine/core";
import { Check } from "lucide-react";
import { useEffect, useState } from "react";

interface SaleSuccessNoticeInnerProps {
  token: number;
}

function SaleSuccessNoticeInner({
  token: _token,
}: SaleSuccessNoticeInnerProps) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const hideTimer = setTimeout(() => setVisible(false), 1800);
    return () => clearTimeout(hideTimer);
  }, []);

  return (
    <Transition
      duration={220}
      mounted={visible}
      timingFunction="cubic-bezier(0.22, 1, 0.36, 1)"
      transition="pop"
    >
      {(styles) => (
        <div
          className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center bg-black/30 p-6 backdrop-blur-[2px]"
          style={styles}
        >
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-[var(--color-voltage)]/25 bg-[#0f0f0f] px-8 py-6 shadow-2xl shadow-black/60">
            <div className="flex size-14 items-center justify-center rounded-full bg-[var(--color-voltage)] shadow-[var(--color-voltage)]/30 shadow-lg">
              <Check
                aria-hidden="true"
                className="size-7 text-black"
                strokeWidth={3}
              />
            </div>
            <div className="text-center">
              <p className="font-bold text-base text-white">Venta registrada</p>
              <p className="mt-0.5 text-xs text-zinc-400">
                Cobro completado con éxito
              </p>
            </div>
          </div>
        </div>
      )}
    </Transition>
  );
}

interface SaleSuccessNoticeProps {
  token: number | null;
}

export function SaleSuccessNotice({ token }: SaleSuccessNoticeProps) {
  if (token === null) {
    return null;
  }

  return <SaleSuccessNoticeInner key={token} token={token} />;
}
