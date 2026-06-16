import { Alert, Button, Drawer, Select, TextInput } from "@mantine/core";
import { CalendarClock } from "lucide-react";
import { type FormEvent, useState } from "react";
import { creditCurrencyFormatter } from "@/features/credit/credit-formatters.shared";
import { useCreditPage } from "@/features/credit/credit-page-context";
import {
  darkDrawerStyles,
  darkInputStyles,
  darkSelectStyles,
} from "@/lib/mantine-dark";
import {
  formatMoneyInput,
  getErrorMessage,
  parseMoneyInput,
  sanitizeMoneyInput,
} from "@/lib/utils";

function CreditPaymentSheetForm() {
  const { state, actions, meta } = useCreditPage();
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("");
  const [saleId, setSaleId] = useState("");
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");

  const maxAmount = state.selectedAccount?.balance ?? 0;
  const parsedAmount = parseMoneyInput(amount);
  const isOverpayment = parsedAmount > maxAmount;
  const isValidAmount = parsedAmount > 0 && !isOverpayment;
  const selectedMethod = meta.paymentMethods.find(
    (paymentMethod) => paymentMethod.id === method
  );

  const methodData = meta.paymentMethods.map((paymentMethod) => ({
    value: paymentMethod.id,
    label: paymentMethod.requiresReference
      ? `${paymentMethod.label} (requiere ref.)`
      : paymentMethod.label,
  }));

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!(isValidAmount && method && meta.activeShift)) {
      return;
    }
    await actions.registerPayment({
      amount: parsedAmount,
      method,
      saleId,
      reference,
      notes,
    });
  };

  return (
    <form className="flex h-full flex-col" onSubmit={handleSubmit}>
      <div className="flex-1 space-y-6 overflow-y-auto p-6">
        <p className="text-sm text-zinc-400">
          {state.selectedAccount?.customerName}: Saldo pendiente:{" "}
          <span className="font-semibold text-[var(--color-voltage)]">
            {creditCurrencyFormatter.format(
              state.selectedAccount?.balance ?? 0
            )}
          </span>
        </p>

        {meta.activeShift ? (
          <div className="flex items-center gap-2 rounded-xl border border-zinc-800 bg-black/10 p-3 text-sm text-zinc-300">
            <CalendarClock className="size-4 text-zinc-500" />
            <span>
              Turno activo:{" "}
              <span className="font-medium text-white">
                {meta.activeShift.terminalName || "Caja principal"}
              </span>
            </span>
          </div>
        ) : (
          <Alert color="red" title="No hay turno abierto" variant="light">
            Debes abrir un turno para registrar abonos.
          </Alert>
        )}

        <div className="grid gap-4">
          <div>
            <TextInput
              autoComplete="off"
              inputMode="numeric"
              label="Monto"
              onChange={(event) =>
                setAmount(sanitizeMoneyInput(event.target.value))
              }
              placeholder="Ej. 50.000"
              required
              styles={darkInputStyles}
              type="text"
              value={formatMoneyInput(amount)}
              withAsterisk
            />
            {isOverpayment ? (
              <p className="mt-1 text-red-400 text-sm">
                El monto no puede superar el saldo pendiente (
                {creditCurrencyFormatter.format(maxAmount)}).
              </p>
            ) : null}
          </div>

          <Select
            data={methodData}
            label="Método de pago"
            onChange={(value) => setMethod(value ?? "")}
            placeholder="Selecciona método"
            required
            styles={darkSelectStyles}
            value={method}
            withAsterisk
          />

          <TextInput
            label="Venta asociada (opcional)"
            onChange={(event) => setSaleId(event.target.value)}
            placeholder="ID de venta"
            styles={darkInputStyles}
            value={saleId}
          />

          <TextInput
            label={
              selectedMethod?.requiresReference
                ? "Referencia"
                : "Referencia (opcional)"
            }
            onChange={(event) => setReference(event.target.value)}
            placeholder="Número de referencia"
            required={selectedMethod?.requiresReference}
            styles={darkInputStyles}
            value={reference}
            withAsterisk={selectedMethod?.requiresReference}
          />

          <TextInput
            label="Notas (opcional)"
            onChange={(event) => setNotes(event.target.value)}
            placeholder="Observaciones"
            styles={darkInputStyles}
            value={notes}
          />
        </div>

        {meta.paymentError ? (
          <p className="rounded-md border border-red-400/20 bg-red-400/10 p-3 font-medium text-red-300 text-sm">
            {getErrorMessage(
              meta.paymentError,
              "No se pudo registrar el abono."
            )}
          </p>
        ) : null}
      </div>

      <div className="shrink-0 border-zinc-800 border-t bg-black/30 p-6">
        <Button
          c="black"
          color="voltage.5"
          disabled={
            !(isValidAmount && method && meta.activeShift) ||
            (selectedMethod?.requiresReference && !reference.trim())
          }
          fullWidth
          loading={meta.isPaymentPending}
          type="submit"
        >
          Registrar abono
        </Button>
      </div>
    </form>
  );
}

export function CreditPaymentSheet() {
  const { state, actions } = useCreditPage();
  const isOpen = state.activeOverlay?.type === "payment";

  return (
    <Drawer
      onClose={actions.closeOverlay}
      opened={isOpen}
      position="right"
      size={480}
      styles={darkDrawerStyles}
      title="Registrar abono"
    >
      <CreditPaymentSheetForm
        key={isOpen ? (state.selectedAccount?.id ?? "new") : "closed"}
      />
    </Drawer>
  );
}
