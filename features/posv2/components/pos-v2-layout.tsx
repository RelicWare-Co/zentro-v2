import type { KeyboardBarcodeScannerEvent } from "@point-of-sale/keyboard-barcode-scanner";
import { useCallback, useEffect, useRef, useState } from "react";
import { usePosPage } from "@/features/pos/pos-page-context";
import { isPosOverlayBlockingCatalog } from "@/features/pos/pos-page-modals.shared";
import { openPosCashDrawer } from "@/features/pos/printing/print-sale-receipt.client";
import { CartPanelV2 } from "@/features/posv2/components/cart-panel-v2";
import { PosV2Header } from "@/features/posv2/components/pos-v2-header";
import { posV2OrderCanvasBg } from "@/features/posv2/components/pos-v2-order-styles";
import { ProductCatalog } from "@/features/posv2/components/product-catalog";
import { useKeyboardBarcodeScanner } from "@/features/posv2/hooks/use-keyboard-barcode-scanner.client";
import { buildPosV2BarcodeScanPayload } from "@/features/posv2/posv2-barcode.shared";
import { RestaurantPosTables } from "@/features/restaurants/components/restaurant-pos-overlay";
import { cn } from "@/lib/utils";

export function PosV2Layout() {
  const { state, actions, meta } = usePosPage();
  const pendingBarcodeLookupRef = useRef<string[] | null>(null);
  const [isTablesOverlayOpen, setIsTablesOverlayOpen] = useState(false);

  const handleOpenDrawer = useCallback(() => {
    if (!state.activeShift) {
      actions.openShiftModal();
      return;
    }
    openPosCashDrawer(meta.activeOrganizationId).catch(() => undefined);
  }, [state.activeShift, actions, meta.activeOrganizationId]);

  const handleBarcodeScan = useCallback(
    (event: KeyboardBarcodeScannerEvent) => {
      const payload = buildPosV2BarcodeScanPayload(event);
      if (payload.lookupValues.length === 0) {
        return false;
      }

      if (!state.activeShift) {
        actions.handleBarcodeScanV2(event);
        return false;
      }

      const matchedProduct = meta.resolveBarcodeProduct(payload.lookupValues);
      if (matchedProduct) {
        pendingBarcodeLookupRef.current = null;
        actions.setSearchQuery("");
        actions.handleProductSelect(matchedProduct);
        return true;
      }

      pendingBarcodeLookupRef.current = payload.lookupValues;
      actions.setSearchQuery(payload.value);
      return false;
    },
    [state.activeShift, actions, meta.resolveBarcodeProduct]
  );

  const isBarcodeScannerEnabled = !(
    isPosOverlayBlockingCatalog(state.activeModal, state.isMobileCartOpen) ||
    state.isProcessingCheckout ||
    isTablesOverlayOpen
  );

  const { isConnected: isBarcodeScannerConnected } = useKeyboardBarcodeScanner({
    enabled: isBarcodeScannerEnabled,
    onScan: handleBarcodeScan,
  });

  useEffect(() => {
    const pendingLookup = pendingBarcodeLookupRef.current;
    if (!(pendingLookup && state.activeShift)) {
      return;
    }

    const matchedProduct = meta.resolveBarcodeProduct(pendingLookup);
    if (!matchedProduct) {
      return;
    }

    pendingBarcodeLookupRef.current = null;
    actions.setSearchQuery("");
    actions.handleProductSelect(matchedProduct);
  }, [
    state.activeShift,
    actions.setSearchQuery,
    actions.handleProductSelect,
    meta.resolveBarcodeProduct,
  ]);

  return (
    <div
      className={cn(
        "grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)] overflow-hidden text-white",
        posV2OrderCanvasBg
      )}
    >
      <PosV2Header
        activeShift={state.activeShift}
        defaultTerminalName={meta.defaultTerminalName}
        onCashMovement={actions.openCashMovementModal}
        onCloseShift={actions.openCloseShiftModal}
        onOpenDrawer={handleOpenDrawer}
      />

      <div className="grid min-h-0 grid-cols-[minmax(0,1fr)_440px] overflow-hidden">
        <div className="relative grid min-h-0 overflow-hidden">
          <ProductCatalog
            isBarcodeScannerConnected={isBarcodeScannerConnected}
          />

          <RestaurantPosTables
            activeTableId={state.tableSession?.tableId ?? null}
            isOpen={isTablesOverlayOpen}
            onOpenChange={setIsTablesOverlayOpen}
            onSelectTable={actions.enterTableMode}
          />
        </div>

        <CartPanelV2 className="min-h-0" />
      </div>
    </div>
  );
}
