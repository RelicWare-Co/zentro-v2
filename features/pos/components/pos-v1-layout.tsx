import { ShoppingCart } from "lucide-react";
import { useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { CartPanel } from "@/features/pos/components/cart-panel";
import { PosHeader } from "@/features/pos/components/pos-header";
import { ProductGrid } from "@/features/pos/components/product-grid";
import { usePosPage } from "@/features/pos/pos-page-context";
import { openPosCashDrawer } from "@/features/pos/printing/print-sale-receipt.client";
import { useIsMobile } from "@/hooks/use-mobile";

export function PosV1Layout() {
  const { state, actions, meta } = usePosPage();
  const isMobile = useIsMobile();

  const handleCheckout = () => {
    if (isMobile) {
      actions.setIsMobileCartOpen(false);
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
        onCashMovement={actions.openCashMovementModal}
        onCloseShift={actions.openCloseShiftModal}
        onCreateCustomer={actions.openCreateCustomerModal}
        onCustomerChange={actions.setSelectedCustomerId}
        onOpenDrawer={handleOpenDrawer}
        onOpenShift={actions.openShiftModal}
        selectedCustomerId={state.selectedCustomerId}
      />

      <div className="flex min-h-0 flex-1 overflow-hidden">
        <ProductGrid
          className={isMobile ? "border-r-0" : undefined}
          shouldAutoFocusSearch={!isMobile}
        />

        {!isMobile && (
          <CartPanel
            cart={state.cart}
            onCheckout={handleCheckout}
            onClearCart={actions.clearCart}
            onRemoveItem={actions.removeFromCart}
            onUpdateItemDiscount={actions.updateItemDiscount}
            onUpdateQuantity={actions.updateQuantity}
            totalItems={state.totalItems}
            totals={state.totals}
          />
        )}
      </div>

      {isMobile && (
        <Drawer
          onOpenChange={actions.setIsMobileCartOpen}
          open={state.isMobileCartOpen}
        >
          <DrawerTrigger asChild>
            <Button
              className="fixed right-4 bottom-4 z-50 size-14 rounded-full bg-[var(--color-voltage)] text-black shadow-lg hover:bg-[#c9e605]"
              size="icon"
            >
              <ShoppingCart className="size-5" />
              {state.totalItems > 0 && (
                <span className="absolute -top-1 -right-1 flex size-5 items-center justify-center rounded-full bg-red-500 font-bold text-[10px] text-white">
                  {state.totalItems}
                </span>
              )}
            </Button>
          </DrawerTrigger>
          <DrawerContent className="max-h-[85dvh] border-zinc-800 bg-[var(--color-carbon)] text-white">
            <DrawerHeader className="border-zinc-800 border-b">
              <DrawerTitle>Orden Actual</DrawerTitle>
            </DrawerHeader>
            <div className="flex h-[calc(85dvh-80px)] flex-col">
              <CartPanel
                cart={state.cart}
                className="w-full flex-1 border-l-0"
                onCheckout={handleCheckout}
                onClearCart={actions.clearCart}
                onRemoveItem={actions.removeFromCart}
                onUpdateItemDiscount={actions.updateItemDiscount}
                onUpdateQuantity={actions.updateQuantity}
                totalItems={state.totalItems}
                totals={state.totals}
              />
            </div>
          </DrawerContent>
        </Drawer>
      )}
    </div>
  );
}
