import type { ReactNode } from "react";
import { PosCartProvider } from "@/features/pos/pos-cart-context";
import { PosCatalogProvider } from "@/features/pos/pos-catalog-context";
import { PosCheckoutProvider } from "@/features/pos/pos-checkout-context";
import { PosCustomerProvider } from "@/features/pos/pos-customer-context";
import { PosModalProvider } from "@/features/pos/pos-modal-context";
import { PosPageCompatProvider } from "@/features/pos/pos-page-compat-context";
import { PosSaleModeProvider } from "@/features/pos/pos-sale-mode-context";
import { PosShiftProvider } from "@/features/pos/pos-shift-context";

// biome-ignore-start lint/performance/noBarrelFile: temporary re-exports for backward compatibility during ADR-010 migration. Removed in step 9.
export { usePosPage } from "@/features/pos/pos-page-compat-context";
export type { PosTableSessionState } from "@/features/pos/sale-modes/types";
// biome-ignore-end lint/performance/noBarrelFile: temporary re-exports for backward compatibility during ADR-010 migration. Removed in step 9.

export function PosPageProvider({ children }: { children: ReactNode }) {
  return (
    <PosModalProvider>
      <PosCatalogProvider>
        <PosShiftProvider>
          <PosCustomerProvider>
            <PosSaleModeProvider>
              <PosCartProvider>
                <PosCheckoutProvider>
                  <PosPageCompatProvider>{children}</PosPageCompatProvider>
                </PosCheckoutProvider>
              </PosCartProvider>
            </PosSaleModeProvider>
          </PosCustomerProvider>
        </PosShiftProvider>
      </PosCatalogProvider>
    </PosModalProvider>
  );
}
