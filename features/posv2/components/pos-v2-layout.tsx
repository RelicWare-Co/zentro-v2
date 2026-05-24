import type { KeyboardBarcodeScannerEvent } from "@point-of-sale/keyboard-barcode-scanner";
import { useCallback, useEffect, useRef } from "react";
import { usePosPage } from "@/features/pos/pos-page-context";
import { openPosCashDrawer } from "@/features/pos/printing/print-sale-receipt.client";
import { CartPanelV2 } from "@/features/posv2/components/cart-panel-v2";
import { PosV2Header } from "@/features/posv2/components/pos-v2-header";
import { ProductCatalog } from "@/features/posv2/components/product-catalog";
import { useKeyboardBarcodeScanner } from "@/features/posv2/hooks/use-keyboard-barcode-scanner.client";
import { buildPosV2BarcodeScanPayload } from "@/features/posv2/posv2-barcode.shared";

export function PosV2Layout() {
  const { state, actions, meta } = usePosPage();
  const pendingBarcodeLookupRef = useRef<string[] | null>(null);

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
    state.isModifierModalOpen ||
    state.isCreateCustomerModalOpen ||
    state.isShiftOpenModalOpen ||
    state.isCashMovementModalOpen ||
    state.isCloseShiftModalOpen ||
    state.isCheckoutModalOpen ||
    state.isCheckoutDetailsModalOpen ||
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
    <div className="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)] overflow-hidden bg-[#0a0a0a] text-white">
      <PosV2Header
        activeShift={state.activeShift}
        defaultTerminalName={meta.defaultTerminalName}
        onCashMovement={actions.openCashMovementModal}
        onCloseShift={actions.openCloseShiftModal}
        onOpenDrawer={() => openPosCashDrawer(meta.activeOrganizationId)}
      />

      <div className="grid min-h-0 grid-cols-[minmax(0,1fr)_440px] overflow-hidden">
        <ProductCatalog
          activeCategoryId={state.activeCategoryId}
          categories={state.categories}
          getProductQuantity={actions.getProductQuantity}
          hasMore={state.hasNextPage}
          isActiveShift={!!state.activeShift}
          isBarcodeScannerConnected={isBarcodeScannerConnected}
          isLoading={
            state.isBootstrapLoading ||
            state.isActiveShiftLoading ||
            state.isProductsLoading
          }
          isLoadingMore={state.isFetchingNextPage}
          isTogglingFavorite={meta.isTogglingFavorite}
          onCategoryChange={actions.setActiveCategoryId}
          onClearSearch={() => actions.setSearchQuery("")}
          onLoadMore={actions.fetchNextProductsPage}
          onProductSelect={actions.handleProductSelect}
          onSearchChange={actions.setSearchQuery}
          onToggleFavorite={actions.toggleProductFavorite}
          onViewModeChange={actions.setViewMode}
          products={state.products}
          searchQuery={state.searchQuery}
          viewMode={state.viewMode}
        />

        <CartPanelV2 className="min-h-0" />
      </div>
    </div>
  );
}
