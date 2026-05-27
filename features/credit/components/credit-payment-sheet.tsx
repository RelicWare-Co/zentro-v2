import { CalendarClock } from "lucide-react";
import { type FormEvent, useId, useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { CreditFormField } from "@/features/credit/components/credit-ui-primitives";
import { creditCurrencyFormatter } from "@/features/credit/credit-formatters.shared";
import { useCreditPage } from "@/features/credit/credit-page-context";
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
  const amountId = useId();
  const methodId = useId();
  const saleIdInputId = useId();
  const referenceId = useId();
  const notesId = useId();

  const maxAmount = state.selectedAccount?.balance ?? 0;
  const parsedAmount = parseMoneyInput(amount);
  const isOverpayment = parsedAmount > maxAmount;
  const isValidAmount = parsedAmount > 0 && !isOverpayment;
  const selectedMethod = meta.paymentMethods.find(
    (paymentMethod) => paymentMethod.id === method
  );

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
      <SheetHeader className="shrink-0 border-zinc-800 border-b p-6">
        <SheetTitle className="font-bold text-2xl">Registrar abono</SheetTitle>
        <SheetDescription className="text-zinc-400">
          {state.selectedAccount?.customerName}: Saldo pendiente:{" "}
          <span className="font-semibold text-[var(--color-voltage)]">
            {creditCurrencyFormatter.format(
              state.selectedAccount?.balance ?? 0
            )}
          </span>
        </SheetDescription>
      </SheetHeader>

      <div className="flex-1 space-y-6 overflow-y-auto p-6">
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
          <Alert
            className="border-red-500/20 bg-red-500/10 text-red-100"
            variant="destructive"
          >
            <AlertTitle>No hay turno abierto</AlertTitle>
            <AlertDescription>
              Debes abrir un turno para registrar abonos.
            </AlertDescription>
          </Alert>
        )}

        <div className="grid gap-4">
          <CreditFormField htmlFor={amountId} label="Monto" required>
            <Input
              autoComplete="off"
              className="border-zinc-700 bg-black/20"
              id={amountId}
              inputMode="numeric"
              onChange={(event) =>
                setAmount(sanitizeMoneyInput(event.target.value))
              }
              placeholder="Ej. 50.000"
              required
              type="text"
              value={formatMoneyInput(amount)}
            />
            {isOverpayment ? (
              <p className="text-red-400 text-sm">
                El monto no puede superar el saldo pendiente (
                {creditCurrencyFormatter.format(maxAmount)}).
              </p>
            ) : null}
          </CreditFormField>

          <CreditFormField htmlFor={methodId} label="Método de pago" required>
            <Select onValueChange={setMethod} value={method}>
              <SelectTrigger
                className="w-full border-zinc-700 bg-black/20 text-white"
                id={methodId}
              >
                <SelectValue placeholder="Selecciona método" />
              </SelectTrigger>
              <SelectContent className="border-zinc-800 bg-[var(--color-carbon)] text-white">
                {meta.paymentMethods.map((paymentMethod) => (
                  <SelectItem key={paymentMethod.id} value={paymentMethod.id}>
                    {paymentMethod.label}
                    {paymentMethod.requiresReference ? (
                      <span className="ml-1 text-xs text-zinc-500">
                        (requiere ref.)
                      </span>
                    ) : null}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CreditFormField>

          <CreditFormField
            htmlFor={saleIdInputId}
            label="Venta asociada (opcional)"
          >
            <Input
              className="border-zinc-700 bg-black/20"
              id={saleIdInputId}
              onChange={(event) => setSaleId(event.target.value)}
              placeholder="ID de venta"
              value={saleId}
            />
          </CreditFormField>

          {selectedMethod?.requiresReference ? (
            <CreditFormField htmlFor={referenceId} label="Referencia" required>
              <Input
                className="border-zinc-700 bg-black/20"
                id={referenceId}
                onChange={(event) => setReference(event.target.value)}
                placeholder="Número de referencia"
                required
                value={reference}
              />
            </CreditFormField>
          ) : (
            <CreditFormField
              htmlFor={referenceId}
              label="Referencia (opcional)"
            >
              <Input
                className="border-zinc-700 bg-black/20"
                id={referenceId}
                onChange={(event) => setReference(event.target.value)}
                placeholder="Número de referencia"
                value={reference}
              />
            </CreditFormField>
          )}

          <CreditFormField htmlFor={notesId} label="Notas (opcional)">
            <Input
              className="border-zinc-700 bg-black/20"
              id={notesId}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Observaciones"
              value={notes}
            />
          </CreditFormField>
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
          className="w-full bg-[var(--color-voltage)] text-black hover:bg-[#d9f15c]"
          disabled={
            meta.isPaymentPending ||
            !isValidAmount ||
            !method ||
            !meta.activeShift ||
            (selectedMethod?.requiresReference && !reference.trim())
          }
          type="submit"
        >
          {meta.isPaymentPending ? "Registrando…" : "Registrar abono"}
        </Button>
      </div>
    </form>
  );
}

export function CreditPaymentSheet() {
  const { state, actions } = useCreditPage();
  const isOpen = state.activeOverlay?.type === "payment";

  return (
    <Sheet
      onOpenChange={(open) => {
        if (!open) {
          actions.closeOverlay();
        }
      }}
      open={isOpen}
    >
      <SheetContent className="!w-full !max-w-full sm:!w-[480px] overflow-hidden border-zinc-800 border-l bg-[var(--color-carbon)] p-0 text-white">
        <CreditPaymentSheetForm
          key={isOpen ? (state.selectedAccount?.id ?? "new") : "closed"}
        />
      </SheetContent>
    </Sheet>
  );
}
