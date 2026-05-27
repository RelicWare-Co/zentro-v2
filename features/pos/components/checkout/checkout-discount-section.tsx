import { useEffect, useId, useRef, useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { usePosPage } from "@/features/pos/pos-page-context";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn, formatMoneyInput, sanitizeMoneyInput } from "@/lib/utils";

interface CheckoutDiscountSectionProps {
  className?: string;
  inputClassName?: string;
}

export function CheckoutDiscountSection({
  className,
  inputClassName,
}: CheckoutDiscountSectionProps) {
  const { state, actions } = usePosPage();
  const discountInputRef = useRef<HTMLInputElement | null>(null);
  const isMobile = useIsMobile();
  const discountInputId = useId();
  const discountEnabledId = useId();
  const [isDiscountEnabled, setIsDiscountEnabled] = useState(
    Number(state.discountInput) > 0
  );

  useEffect(() => {
    setIsDiscountEnabled(Number(state.discountInput) > 0);
  }, [state.discountInput]);

  return (
    <div
      className={cn(
        "rounded-lg border border-zinc-800 bg-[#0a0a0a] p-3",
        className
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="font-medium text-sm text-zinc-200">Aplicar descuento</p>
          <p className="text-xs text-zinc-500">
            Actívalo solo cuando la orden lo necesite.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Checkbox
            checked={isDiscountEnabled}
            className="border-zinc-600 data-[state=checked]:border-[var(--color-voltage)] data-[state=checked]:bg-[var(--color-voltage)] data-[state=checked]:text-black"
            id={discountEnabledId}
            onCheckedChange={(checked) => {
              const nextValue = checked === true;
              setIsDiscountEnabled(nextValue);
              if (!nextValue) {
                actions.setDiscountInput("0");
                return;
              }
              if (isMobile) {
                return;
              }

              window.setTimeout(() => {
                discountInputRef.current?.focus();
                discountInputRef.current?.select();
              }, 0);
            }}
          />
          <label
            className="cursor-pointer text-sm text-zinc-300"
            htmlFor={discountEnabledId}
          >
            Agregar
          </label>
        </div>
      </div>

      {isDiscountEnabled ? (
        <div className="relative mt-3">
          <span className="absolute top-1/2 left-3 -translate-y-1/2 text-zinc-500">
            $
          </span>
          <Input
            autoComplete="off"
            className={cn(
              "h-10 touch-manipulation border-zinc-700 bg-[#151515] pl-7 text-base focus-visible:border-[var(--color-voltage)] focus-visible:ring-0 md:text-sm",
              inputClassName
            )}
            id={discountInputId}
            inputMode="numeric"
            onChange={(event) =>
              actions.setDiscountInput(sanitizeMoneyInput(event.target.value))
            }
            placeholder="0"
            ref={discountInputRef}
            type="text"
            value={formatMoneyInput(state.discountInput)}
          />
        </div>
      ) : null}
    </div>
  );
}
