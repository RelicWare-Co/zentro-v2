import { useEffect, useId, useRef } from "react";
import { Button } from "@/components/ui/button";
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

  return (
    <Dialog
      onOpenChange={(open) => {
        if (!open) {
          actions.closeActiveModal();
        }
      }}
      open={isOpen}
    >
      <DialogContent className="border-zinc-800 bg-[#151515] text-white sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="text-xl">Cobrar Orden</DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <div className="flex items-center justify-between rounded-lg border border-zinc-800 bg-[#0a0a0a] p-4">
            <span className="font-medium text-zinc-400">Total a Pagar</span>
            <span className="font-bold text-3xl text-[var(--color-voltage)]">
              {formatCurrency(state.totals.totalAmount)}
            </span>
          </div>

          <div className="space-y-4">
            <CheckoutCustomerSection />

            <CheckoutDiscountSection />

            <div className="flex items-center justify-between">
              <h4 className="font-semibold text-sm text-zinc-300">
                Métodos de Pago
              </h4>
              {meta.allowCreditSales ? (
                <div className="flex items-center gap-2">
                  <input
                    checked={state.isCreditSale}
                    className="size-4 rounded border-zinc-700 bg-[#0a0a0a] text-[var(--color-voltage)] focus:ring-[var(--color-voltage)]"
                    id={creditSaleId}
                    onChange={(event) =>
                      actions.setIsCreditSale(event.target.checked)
                    }
                    type="checkbox"
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

            <CheckoutCreditSection showToggle={false} />

            <CheckoutPaymentsSection
              paymentAmountInputRef={paymentAmountInputRef}
            />
          </div>

          <CheckoutSummaryFooter />
        </div>

        <DialogFooter>
          <Button
            className="text-zinc-400 hover:text-white"
            onClick={actions.closeActiveModal}
            variant="ghost"
          >
            Cancelar
          </Button>
          <Button
            className="bg-[var(--color-voltage)] text-black hover:bg-[#c9e605]"
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
