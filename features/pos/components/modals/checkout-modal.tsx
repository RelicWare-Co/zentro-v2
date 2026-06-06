import { useEffect, useId, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CheckoutCreditSection } from "@/features/pos/components/checkout/checkout-credit-section";
import { CheckoutCustomerSection } from "@/features/pos/components/checkout/checkout-customer-section";
import { CheckoutDiscountSection } from "@/features/pos/components/checkout/checkout-discount-section";
import { getConfirmButtonText } from "@/features/pos/components/checkout/checkout-footer.helpers";
import { PaymentMethodGrid } from "@/features/pos/components/checkout/checkout-payment-method-grid";
import { CheckoutPaymentsSection } from "@/features/pos/components/checkout/checkout-payments-section";
import { CheckoutSummaryFooter } from "@/features/pos/components/checkout/checkout-summary-footer";
import { usePosPage } from "@/features/pos/pos-page-context";
import { isPosModalOpen } from "@/features/pos/pos-page-modals.shared";
import { formatCurrency } from "@/features/pos/utils";
import { useIsMobile } from "@/hooks/use-mobile";

export function CheckoutModal() {
  const { state, actions, meta } = usePosPage();
  const paymentAmountInputRef = useRef<HTMLInputElement | null>(null);
  const isMobile = useIsMobile();
  const creditSaleId = useId();

  useEffect(() => {
    if (!isPosModalOpen(state.activeModal, "checkout") || isMobile) {
      return;
    }

    const focusTimeout = window.setTimeout(() => {
      paymentAmountInputRef.current?.focus();
      paymentAmountInputRef.current?.select();
    }, 0);

    return () => window.clearTimeout(focusTimeout);
  }, [isMobile, state.activeModal]);

  const isOpen = isPosModalOpen(state.activeModal, "checkout");

  const firstPaymentMethod = state.payments[0]?.method ?? "";

  const handleMethodSelect = (methodId: string) => {
    actions.updatePayment(0, "method", methodId);
  };

  return (
    <Dialog
      onOpenChange={(open) => {
        if (!open) {
          actions.closeActiveModal();
        }
      }}
      open={isOpen}
    >
      <DialogContent className="border-zinc-800 bg-[#151515] text-white sm:max-w-[480px]">
        <DialogHeader className="pb-2">
          <DialogTitle className="font-bold text-xl">Cobrar Orden</DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Total a Pagar */}
          <div className="flex flex-col items-center justify-center rounded-xl border border-zinc-800 bg-[#0F0F0F] p-5">
            <span className="text-sm text-zinc-500">Total a Pagar</span>
            <span className="font-bold text-4xl text-[var(--color-voltage)]">
              {formatCurrency(state.totals.totalAmount)}
            </span>
          </div>

          {/* Cliente */}
          <CheckoutCustomerSection />

          {/* Método de Pago + Checkbox */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-semibold text-sm text-white">
                Método de Pago
              </h4>
              {meta.allowCreditSales ? (
                <div className="flex items-center gap-2">
                  <Checkbox
                    checked={state.isCreditSale}
                    className="border-zinc-600 data-[state=checked]:border-[var(--color-voltage)] data-[state=checked]:bg-[var(--color-voltage)] data-[state=checked]:text-black"
                    id={creditSaleId}
                    onCheckedChange={(checked) =>
                      actions.setIsCreditSale(checked === true)
                    }
                  />
                  <label
                    className="cursor-pointer text-sm text-zinc-400"
                    htmlFor={creditSaleId}
                  >
                    Dejar saldo a crédito
                  </label>
                </div>
              ) : (
                <span className="text-sm text-zinc-500">
                  Crédito deshabilitado en ajustes
                </span>
              )}
            </div>

            {/* Grid de métodos de pago */}
            <PaymentMethodGrid
              onSelect={handleMethodSelect}
              paymentMethodOptions={meta.paymentMethodOptions}
              selectedMethodId={firstPaymentMethod}
            />

            {/* Credit warnings */}
            <CheckoutCreditSection showToggle={false} />

            {/* Payments section */}
            <CheckoutPaymentsSection
              compactMode
              paymentAmountInputRef={paymentAmountInputRef}
            />
          </div>

          {/* Descuento */}
          <CheckoutDiscountSection />

          {/* Footer */}
          <CheckoutSummaryFooter />
        </div>

        <DialogFooter className="border-zinc-800 bg-transparent sm:justify-between">
          <Button
            className="h-11 flex-1 border-zinc-700 bg-transparent text-white hover:bg-zinc-800 hover:text-white"
            onClick={actions.closeActiveModal}
            variant="outline"
          >
            Cancelar
          </Button>
          <Button
            className="h-11 flex-1 bg-[var(--color-voltage)] text-black hover:bg-[#c9e605]"
            disabled={!state.canFinalizeSale || state.isProcessingCheckout}
            onClick={actions.finalizeSale}
          >
            {getConfirmButtonText(
              state.isProcessingCheckout,
              state.shouldCreateCreditBalance
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
