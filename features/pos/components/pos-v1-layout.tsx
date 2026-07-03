import { Button, Drawer } from "@mantine/core";
import { ShoppingCart } from "lucide-react";
import { useModuleCapabilities } from "@/features/modules/hooks/use-module-capabilities";
import { usePosExtensions } from "@/features/modules/hooks/use-pos-extensions";
import { CartPanel } from "@/features/pos/components/cart-panel";
import { PosHeader } from "@/features/pos/components/pos-header";
import { ProductGrid } from "@/features/pos/components/product-grid";
import type { PosExtensionRenderProps } from "@/features/pos/pos-extension.shared";
import { usePosPage } from "@/features/pos/pos-page-context";
import { isAnyPosModalOpen } from "@/features/pos/pos-page-modals.shared";
import { openPosCashDrawer } from "@/features/pos/printing/print-sale-receipt.client";
import { useIsMobile } from "@/hooks/use-mobile";

export function PosV1Layout() {
  const { state, actions, meta } = usePosPage();
  const isMobile = useIsMobile();
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

  const handleCheckout = () => {
    if (isMobile) {
      actions.setIsMobileCartOpen(false);
    }
    if (state.isQuickSaleMode) {
      actions.handleQuickSale();
      return;
    }
    actions.openCheckout();
  };

  const handleOpenDrawer = () => {
    if (!state.activeShift) {
      actions.openShiftModal();
      return;
    }
    openPosCashDrawer(meta.activeOrganizationId).catch(() => undefined);
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-[var(--color-page-bg)] text-[var(--color-photon)]">
      <PosHeader
        activeShift={state.activeShift}
        customers={state.customers}
        defaultTerminalName={meta.defaultTerminalName}
        headerActions={headerActionExtensions.map(({ Component, id }) => (
          <Component key={id} {...extensionRenderProps} />
        ))}
        isQuickSaleMode={state.isQuickSaleMode}
        onCashMovement={actions.openCashMovementModal}
        onCloseShift={actions.openCloseShiftModal}
        onCreateCustomer={actions.openCreateCustomerModal}
        onCustomerChange={actions.setSelectedCustomerId}
        onOpenDrawer={handleOpenDrawer}
        onOpenShift={actions.openShiftModal}
        onToggleQuickSaleMode={actions.toggleQuickSaleMode}
        selectedCustomerId={state.selectedCustomerId}
      />

      <div className="flex min-h-0 flex-1 overflow-hidden">
        <div className="relative flex min-h-0 min-w-0 flex-1 overflow-hidden bg-[var(--color-page-bg)]">
          <ProductGrid
            className={isMobile ? "border-r-0" : undefined}
            shouldAutoFocusSearch={
              !(isMobile || isAnyPosModalOpen(state.activeModal))
            }
          />

          {catalogOverlayExtensions.map(({ Component, id }) => (
            <Component key={id} {...extensionRenderProps} />
          ))}
        </div>

        {!isMobile && (
          <CartPanel
            cart={state.cart}
            isQuickSaleMode={state.isQuickSaleMode}
            onCheckout={handleCheckout}
            onClearCart={actions.clearCart}
            onExitTable={actions.exitTableMode}
            onRemoveItem={actions.removeFromCart}
            onSendToKitchen={actions.sendTableOrderToKitchen}
            onUpdateItemDiscount={actions.updateItemDiscount}
            onUpdateQuantity={actions.updateQuantity}
            saleSuccessToken={state.saleSuccessToken}
            tableSession={state.tableSession}
            totalItems={state.totalItems}
            totals={state.totals}
          />
        )}
      </div>

      {isMobile && (
        <>
          <Button
            aria-label={`Abrir carrito${state.totalItems > 0 ? `, ${state.totalItems} productos` : ""}`}
            className="fixed right-4 bottom-4 z-50 size-14 rounded-full bg-[var(--color-voltage)] p-0 text-black shadow-lg hover:bg-[#c9e605]"
            onClick={() => actions.setIsMobileCartOpen(true)}
          >
            <span className="relative">
              <ShoppingCart aria-hidden="true" className="size-5" />
              {state.totalItems > 0 && (
                <span className="absolute -top-2 -right-2 flex size-5 items-center justify-center rounded-full bg-red-500 font-bold text-[10px] text-white">
                  {state.totalItems}
                </span>
              )}
            </span>
          </Button>
          <Drawer
            onClose={() => actions.setIsMobileCartOpen(false)}
            opened={state.isMobileCartOpen}
            position="bottom"
            size="85%"
            title="Orden Actual"
          >
            <div className="flex h-full flex-col">
              <CartPanel
                cart={state.cart}
                className="w-full flex-1 border-l-0"
                isQuickSaleMode={state.isQuickSaleMode}
                onCheckout={handleCheckout}
                onClearCart={actions.clearCart}
                onExitTable={actions.exitTableMode}
                onRemoveItem={actions.removeFromCart}
                onSendToKitchen={actions.sendTableOrderToKitchen}
                onUpdateItemDiscount={actions.updateItemDiscount}
                onUpdateQuantity={actions.updateQuantity}
                saleSuccessToken={state.saleSuccessToken}
                tableSession={state.tableSession}
                totalItems={state.totalItems}
                totals={state.totals}
              />
            </div>
          </Drawer>
        </>
      )}
    </div>
  );
}
