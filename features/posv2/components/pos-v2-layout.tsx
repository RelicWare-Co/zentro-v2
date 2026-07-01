import type { KeyboardBarcodeScannerEvent } from "@point-of-sale/keyboard-barcode-scanner";
import { useEffect, useRef } from "react";
import { useModuleCapabilities } from "@/features/modules/hooks/use-module-capabilities";
import { usePosExtensions } from "@/features/modules/hooks/use-pos-extensions";
import type { PosExtensionRenderProps } from "@/features/pos/pos-extension.shared";
import { usePosPage } from "@/features/pos/pos-page-context";
import { isPosOverlayBlockingCatalog } from "@/features/pos/pos-page-modals.shared";
import { openPosCashDrawer } from "@/features/pos/printing/print-sale-receipt.client";
import { CartPanelV2 } from "@/features/posv2/components/cart-panel-v2";
import { PosV2Header } from "@/features/posv2/components/pos-v2-header";
import { posV2OrderCanvasBg } from "@/features/posv2/components/pos-v2-order-styles";
import { ProductCatalog } from "@/features/posv2/components/product-catalog";
import { useKeyboardBarcodeScanner } from "@/features/posv2/hooks/use-keyboard-barcode-scanner.client";
import { buildPosV2BarcodeScanPayload } from "@/features/posv2/posv2-barcode.shared";
import { cn } from "@/lib/utils";

export function PosV2Layout() {
  const { state, actions, meta } = usePosPage();
  const pendingBarcodeLookupRef = useRef<string[] | null>(null);
  const moduleCapabilities = useModuleCapabilities();
  const extensions = usePosExtensions(moduleCapabilities.data?.modules);

  const extensionRenderProps: PosExtensionRenderProps = {
    activeModal: state.activeModal,
    onCloseModal: actions.closeActiveModal,
    onOpenModal: actions.openActiveModal,
    saleMode: {
      enterMode: (payload: unknown) =>
        actions.enterTableMode(payload as string),
      modeId: state.tableSession ? "table" : "counter",
      sessionState: state.tableSession,
      tableId: state.tableSession?.tableId ?? null,
    },
  };

  const catalogOverlayExtensions = extensions.filter(
    (ext) => ext.slot === "catalog-overlay"
  );
  const headerActionExtensions = extensions.filter(
    (ext) => ext.slot === "header-action"
  );

  const handleOpenDrawer = () => {
    if (!state.activeShift) {
      actions.openShiftModal();
      return;
    }
    openPosCashDrawer(meta.activeOrganizationId).catch(() => undefined);
  };

  const handleBarcodeScan = (event: KeyboardBarcodeScannerEvent) => {
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
  };

  const isBarcodeScannerEnabled = !(
    isPosOverlayBlockingCatalog(state.activeModal, state.isMobileCartOpen) ||
    state.isProcessingCheckout
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
        headerActions={headerActionExtensions.map(({ Component, id }) => (
          <Component key={id} {...extensionRenderProps} />
        ))}
        onCashMovement={actions.openCashMovementModal}
        onCloseShift={actions.openCloseShiftModal}
        onOpenDrawer={handleOpenDrawer}
      />

      <div className="grid min-h-0 grid-cols-[minmax(0,1fr)_440px] overflow-hidden">
        <div className="relative grid min-h-0 overflow-hidden">
          <ProductCatalog
            isBarcodeScannerConnected={isBarcodeScannerConnected}
          />

          {catalogOverlayExtensions.map(({ Component, id }) => (
            <Component key={id} {...extensionRenderProps} />
          ))}
        </div>

        <CartPanelV2 className="min-h-0" />
      </div>
    </div>
  );
}
