import { Button, Group, Modal, Select, TextInput } from "@mantine/core";
import { usePosPage } from "@/features/pos/pos-page-context";
import {
  isPosModalOpen,
  POS_MODAL_IDS,
} from "@/features/pos/pos-page-modals.shared";
import type { CashMovementType } from "@/features/pos/types";
import { formatMoneyInput, sanitizeMoneyInput } from "@/lib/utils";

const MOVEMENT_TYPE_DATA = [
  { value: "inflow", label: "Ingreso (Entrada manual)" },
  { value: "expense", label: "Gasto Operativo" },
  { value: "payout", label: "Pago a Proveedor" },
];

export function CashMovementModal() {
  const { state, actions, meta } = usePosPage();
  const { shift, paymentMethodOptions } = meta;

  return (
    <Modal
      centered
      onClose={actions.closeActiveModal}
      opened={isPosModalOpen(state.activeModal, POS_MODAL_IDS.CASH_MOVEMENT)}
      title="Movimiento del Turno"
    >
      <div className="grid gap-4 py-2">
        {!state.activeShift && (
          <p className="text-red-400 text-sm">
            Debes abrir un turno antes de registrar movimientos.
          </p>
        )}

        <Select
          data={MOVEMENT_TYPE_DATA}
          label="Tipo de Movimiento"
          onChange={(value) => {
            if (value) {
              shift.setMovementType(value as CashMovementType);
            }
          }}
          placeholder="Tipo de Movimiento"
          value={shift.movementType}
        />

        <Select
          data={paymentMethodOptions.map((paymentMethod) => ({
            value: paymentMethod.id,
            label: paymentMethod.label,
          }))}
          label="Método Afectado"
          onChange={(value) => shift.setMovementPaymentMethod(value ?? "")}
          placeholder="Método de Pago"
          value={shift.movementPaymentMethod}
        />

        <TextInput
          inputMode="numeric"
          label="Monto"
          onChange={(e) =>
            shift.setMovementAmount(sanitizeMoneyInput(e.target.value))
          }
          placeholder="0"
          type="text"
          value={formatMoneyInput(shift.movementAmount)}
        />

        <TextInput
          label="Descripción"
          onChange={(e) => shift.setMovementDescription(e.target.value)}
          placeholder="Ej. Pago de internet, Base adicional..."
          value={shift.movementDescription}
        />

        {shift.cashMovementError instanceof Error && (
          <p className="text-red-400 text-sm">
            {shift.cashMovementError.message}
          </p>
        )}
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
          disabled={!shift.canRegisterCashMovement}
          loading={shift.isRegisteringMovement}
          onClick={actions.confirmCashMovement}
        >
          Registrar Movimiento
        </Button>
      </Group>
    </Modal>
  );
}
