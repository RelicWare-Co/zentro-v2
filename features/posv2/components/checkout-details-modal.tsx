import { useId } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { CheckoutCreditSection } from "@/features/pos/components/checkout/checkout-credit-section";
import { CheckoutCustomerSection } from "@/features/pos/components/checkout/checkout-customer-section";
import { CheckoutDiscountSection } from "@/features/pos/components/checkout/checkout-discount-section";
import { CheckoutSummaryFooter } from "@/features/pos/components/checkout/checkout-summary-footer";
import { usePosPage } from "@/features/pos/pos-page-context";
import { isPosModalOpen } from "@/features/pos/pos-page-modals.shared";
import { formatCurrency } from "@/features/pos/utils";
import { posV2OrderInputClassName } from "@/features/posv2/components/pos-v2-order-styles";
import { cn, formatMoneyInput, sanitizeMoneyInput } from "@/lib/utils";

export function CheckoutDetailsModal() {
  const { state, actions } = usePosPage();
  const initialPaymentId = useId();

  const canApply =
    !state.shouldCreateCreditBalance || Boolean(state.selectedCustomerId);

  return (
    <Dialog
      onOpenChange={(open) => {
        if (!open) {
          actions.closeActiveModal();
        }
      }}
      open={isPosModalOpen(state.activeModal, "checkout-details")}
    >
      <DialogContent className="border-zinc-800 bg-[#151515] text-white sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="text-xl">Venta a crédito</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="flex items-center justify-between rounded-lg border border-zinc-800 bg-[#0a0a0a] px-4 py-3">
            <span className="text-sm text-zinc-400">Total de la orden</span>
            <span className="font-bold text-[#dfff06] text-xl tabular-nums">
              {formatCurrency(state.totals.totalAmount)}
            </span>
          </div>

          <CheckoutCustomerSection />

          <CheckoutDiscountSection />

          <div className="space-y-2">
            <label
              className="font-medium text-sm text-zinc-300"
              htmlFor={initialPaymentId}
            >
              Abono inicial (opcional)
            </label>
            <div className="relative">
              <span className="absolute top-1/2 left-3 -translate-y-1/2 text-zinc-500">
                $
              </span>
              <Input
                autoComplete="off"
                className={cn(
                  "h-10 border-zinc-700 bg-[#0a0a0a] pl-7 text-white focus-visible:border-[#dfff06]/40 focus-visible:ring-0",
                  posV2OrderInputClassName
                )}
                id={initialPaymentId}
                inputMode="numeric"
                onChange={(event) =>
                  actions.updatePayment(
                    0,
                    "amount",
                    sanitizeMoneyInput(event.target.value)
                  )
                }
                placeholder="0"
                type="text"
                value={formatMoneyInput(state.payments[0]?.amount ?? "")}
              />
            </div>
            <p className="text-xs text-zinc-500">
              El restante quedará en la cuenta del cliente.
            </p>
          </div>

          <CheckoutCreditSection showToggle={false} />

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
            className="bg-[#dfff06] text-black hover:bg-[#c9e605]"
            disabled={!canApply}
            onClick={actions.closeActiveModal}
          >
            Listo
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
