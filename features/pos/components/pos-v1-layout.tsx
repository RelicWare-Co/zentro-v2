import { Button, Drawer } from "@mantine/core";
import { ShoppingCart } from "lucide-react";
import { useCallback, useState } from "react";
import { CartPanel } from "@/features/pos/components/cart-panel";
import { PosHeader } from "@/features/pos/components/pos-header";
import { ProductGrid } from "@/features/pos/components/product-grid";
import { usePosPage } from "@/features/pos/pos-page-context";
import { openPosCashDrawer } from "@/features/pos/printing/print-sale-receipt.client";
import { RestaurantPosTables } from "@/features/restaurants/components/restaurant-pos-overlay";
import { useIsMobile } from "@/hooks/use-mobile";

export function PosV1Layout() {
  const { state, actions, meta } = usePosPage();
  const isMobile = useIsMobile();
  const [isTablesOverlayOpen, setIsTablesOverlayOpen] = useState(false);

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

  const handleOpenDrawer = useCallback(() => {
    if (!state.activeShift) {
      actions.openShiftModal();
      return;
    }
    openPosCashDrawer(meta.activeOrganizationId).catch(() => undefined);
  }, [state.activeShift, actions, meta.activeOrganizationId]);

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-[var(--color-void)] text-[var(--color-photon)]">
      <PosHeader
        activeShift={state.activeShift}
        customers={state.customers}
        defaultTerminalName={meta.defaultTerminalName}
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
        <div className="relative flex min-h-0 min-w-0 flex-1 overflow-hidden">
          <ProductGrid
            className={isMobile ? "border-r-0" : undefined}
            shouldAutoFocusSearch={!(isMobile || isTablesOverlayOpen)}
          />

          <RestaurantPosTables
            activeTableId={state.tableSession?.tableId ?? null}
            isOpen={isTablesOverlayOpen}
            onOpenChange={setIsTablesOverlayOpen}
            onSelectTable={actions.enterTableMode}
          />
        </div>

        {!isMobile && (
          <CartPanel
            cart={state.cart}
            deliveryInfo={state.deliveryInfo}
            isQuickSaleMode={state.isQuickSaleMode}
            onCheckout={handleCheckout}
            onClearCart={actions.clearCart}
            onDeliveryInfoChange={actions.setDeliveryInfo}
            onExitTable={actions.exitTableMode}
            onRemoveItem={actions.removeFromCart}
            onSendToKitchen={actions.sendTableOrderToKitchen}
            onUpdateItemDiscount={actions.updateItemDiscount}
            onUpdateQuantity={actions.updateQuantity}
            tableSession={state.tableSession}
            totalItems={state.totalItems}
            totals={state.totals}
          />
        )}
      </div>

      {isMobile && (
        <>
          <Button
            className="fixed right-4 bottom-4 z-50 size-14 rounded-full bg-[var(--color-voltage)] p-0 text-black shadow-lg hover:bg-[#c9e605]"
            onClick={() => actions.setIsMobileCartOpen(true)}
          >
            <span className="relative">
              <ShoppingCart className="size-5" />
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
                deliveryInfo={state.deliveryInfo}
                isQuickSaleMode={state.isQuickSaleMode}
                onCheckout={handleCheckout}
                onClearCart={actions.clearCart}
                onDeliveryInfoChange={actions.setDeliveryInfo}
                onExitTable={actions.exitTableMode}
                onRemoveItem={actions.removeFromCart}
                onSendToKitchen={actions.sendTableOrderToKitchen}
                onUpdateItemDiscount={actions.updateItemDiscount}
                onUpdateQuantity={actions.updateQuantity}
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
