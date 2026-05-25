import type { ReactNode } from "react";

export default function PosV2Layout({ children }: { children: ReactNode }) {
  return (
    <div className="absolute inset-0 flex flex-col overflow-hidden">
      {children}
    </div>
  );
}
