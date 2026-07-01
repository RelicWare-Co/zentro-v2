import { Button, Checkbox, Group, Modal } from "@mantine/core";
import { useEffect, useId, useRef } from "react";
import { CheckoutCreditSection } from "@/features/pos/components/checkout/checkout-credit-section";
import { CheckoutCustomerSection } from "@/features/pos/components/checkout/checkout-customer-section";
import { CheckoutDiscountSection } from "@/features/pos/components/checkout/checkout-discount-section";
import { getConfirmButtonText } from "@/features/pos/components/checkout/checkout-footer.helpers";
import { PaymentMethodGrid } from "@/features/pos/components/checkout/checkout-payment-method-grid";
import { CheckoutPaymentsSection } from "@/features/pos/components/checkout/checkout-payments-section";
import { CheckoutSummaryFooter } from "@/features/pos/components/checkout/checkout-summary-footer";
import { usePosPage } from "@/features/pos/pos-page-context";
import {
  isPosModalOpen,
  POS_MODAL_IDS,
} from "@/features/pos/pos-page-modals.shared";
import { formatCurrency } from "@/features/pos/utils";
import { useIsMobile } from "@/hooks/use-mobile";

export function CheckoutModal() {
  const { state, actions, meta } = usePosPage();
  const paymentAmountInputRef = useRef<HTMLInputElement | null>(null);
  const isMobile = useIsMobile();
  const creditSaleId = useId();

  useEffect(() => {
    if (
      !isPosModalOpen(state.activeModal, POS_MODAL_IDS.CHECKOUT) ||
      isMobile
    ) {
      return;
    }

    const focusTimeout = window.setTimeout(() => {
      paymentAmountInputRef.current?.focus();
      paymentAmountInputRef.current?.select();
    }, 0);

    return () => window.clearTimeout(focusTimeout);
  }, [isMobile, state.activeModal]);

  const isOpen = isPosModalOpen(state.activeModal, POS_MODAL_IDS.CHECKOUT);

  const firstPaymentMethod = state.payments[0]?.method ?? "";

  const handleMethodSelect = (methodId: string) => {
    actions.updatePayment(0, "method", methodId);
  };

  return (
    <Modal
      centered
      onClose={actions.closeActiveModal}
      opened={isOpen}
      title="Cobrar Orden"
    >
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
            <h4 className="font-semibold text-sm text-white">Método de Pago</h4>
            {meta.allowCreditSales ? (
              <Checkbox
                checked={state.isCreditSale}
                color="voltage.5"
                id={creditSaleId}
                label="Dejar saldo a crédito"
                onChange={(event) =>
                  actions.setIsCreditSale(event.currentTarget.checked)
                }
              />
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

      <Group grow mt="md">
        <Button onClick={actions.closeActiveModal} size="md" variant="outline">
          Cancelar
        </Button>
        <Button
          c="black"
          color="voltage.5"
          disabled={!state.canFinalizeSale}
          loading={state.isProcessingCheckout}
          onClick={actions.finalizeSale}
          size="md"
        >
          {getConfirmButtonText(
            state.isProcessingCheckout,
            state.shouldCreateCreditBalance
          )}
        </Button>
      </Group>
    </Modal>
  );
}
