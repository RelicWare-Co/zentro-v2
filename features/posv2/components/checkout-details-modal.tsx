import { Button, Group, Modal, TextInput } from "@mantine/core";
import { useId } from "react";
import { CheckoutCreditSection } from "@/features/pos/components/checkout/checkout-credit-section";
import { CheckoutCustomerSection } from "@/features/pos/components/checkout/checkout-customer-section";
import { CheckoutDiscountSection } from "@/features/pos/components/checkout/checkout-discount-section";
import { CheckoutSummaryFooter } from "@/features/pos/components/checkout/checkout-summary-footer";
import { usePosPage } from "@/features/pos/pos-page-context";
import { isPosModalOpen } from "@/features/pos/pos-page-modals.shared";
import { formatCurrency } from "@/features/pos/utils";
import {
  posV2AccentText,
  posV2OrderCanvasBg,
  posV2OrderInputClassName,
} from "@/features/posv2/components/pos-v2-order-styles";
import { cn, formatMoneyInput, sanitizeMoneyInput } from "@/lib/utils";

export function CheckoutDetailsModal() {
  const { state, actions } = usePosPage();
  const initialPaymentId = useId();

  const canApply =
    !state.shouldCreateCreditBalance || Boolean(state.selectedCustomerId);

  return (
    <Modal
      centered
      onClose={actions.closeActiveModal}
      opened={isPosModalOpen(state.activeModal, "checkout-details")}
      title="Venta a crédito"
    >
      <div className="space-y-4 py-2">
        <div
          className={cn(
            "flex items-center justify-between rounded-lg border border-zinc-800 px-4 py-3",
            posV2OrderCanvasBg
          )}
        >
          <span className="text-sm text-zinc-400">Total de la orden</span>
          <span
            className={cn("font-bold text-xl tabular-nums", posV2AccentText)}
          >
            {formatCurrency(state.totals.totalAmount)}
          </span>
        </div>

        <CheckoutCustomerSection />

        <CheckoutDiscountSection />

        <div className="space-y-2">
          <TextInput
            autoComplete="off"
            classNames={{
              input: cn(
                "h-10 border-zinc-700 text-white",
                posV2OrderCanvasBg,
                posV2OrderInputClassName
              ),
            }}
            id={initialPaymentId}
            inputMode="numeric"
            label="Abono inicial (opcional)"
            leftSection={<span className="text-zinc-500">$</span>}
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
          <p className="text-xs text-zinc-500">
            El restante quedará en la cuenta del cliente.
          </p>
        </div>

        <CheckoutCreditSection showToggle={false} />

        <CheckoutSummaryFooter />
      </div>

      <Group justify="flex-end">
        <Button
          color="gray"
          onClick={actions.closeActiveModal}
          variant="subtle"
        >
          Cancelar
        </Button>
        <Button
          c="black"
          color="voltage.5"
          disabled={!canApply}
          onClick={actions.closeActiveModal}
        >
          Listo
        </Button>
      </Group>
    </Modal>
  );
}
