import { createContext, type ReactNode, use } from "react";

export type PosPageVariant = "v1" | "v2";

const PosVariantContext = createContext<PosPageVariant | null>(null);

export function usePosVariant(): PosPageVariant {
  const variant = use(PosVariantContext);
  if (!variant) {
    throw new Error("usePosVariant must be used within PosVariantProvider.");
  }
  return variant;
}

export function PosVariantProvider({
  children,
  variant,
}: {
  children: ReactNode;
  variant: PosPageVariant;
}) {
  return <PosVariantContext value={variant}>{children}</PosVariantContext>;
}
