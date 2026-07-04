import { Text, TextInput } from "@mantine/core";
import { ChevronRight, Tag } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { usePosPage } from "@/features/pos/pos-page-context";
import { formatCurrency } from "@/features/pos/utils";
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
  const [isDiscountEnabled, setIsDiscountEnabled] = useState(
    Number(state.discountInput) > 0
  );

  useEffect(() => {
    setIsDiscountEnabled(Number(state.discountInput) > 0);
  }, [state.discountInput]);

  const handleCardClick = () => {
    const nextValue = !isDiscountEnabled;
    setIsDiscountEnabled(nextValue);
    if (!nextValue) {
      actions.setDiscountInput("0");
      return;
    }
    if (!isMobile) {
      window.setTimeout(() => {
        discountInputRef.current?.focus();
        discountInputRef.current?.select();
      }, 0);
    }
  };

  return (
    <div className={cn("space-y-3", className)}>
      <button
        className={cn(
          "flex w-full items-center justify-between rounded-lg border border-zinc-800 bg-[#0F0F0F] p-3 transition-colors hover:border-zinc-700",
          isDiscountEnabled && "border-zinc-700"
        )}
        onClick={handleCardClick}
        type="button"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-800">
            <Tag className="size-4 text-zinc-400" />
          </div>
          <div className="text-left">
            <p className="font-medium text-sm text-zinc-200">
              Aplicar descuento
            </p>
            <p className="text-xs text-zinc-500">
              {isDiscountEnabled && Number(state.discountInput) > 0
                ? `${formatMoneyInput(state.discountInput)} de descuento`
                : "Sin descuento aplicado"}
            </p>
          </div>
        </div>
        <ChevronRight className="size-4 text-zinc-500" />
      </button>

      {isDiscountEnabled ? (
        <div className="space-y-1">
          <TextInput
            autoComplete="off"
            classNames={{
              input: cn(
                "h-10 touch-manipulation border-zinc-700! bg-[#151515]! text-base text-white! focus-visible:border-[var(--color-voltage)]! md:text-sm",
                inputClassName
              ),
            }}
            id={discountInputId}
            inputMode="numeric"
            leftSection={<span className="text-zinc-500">$</span>}
            onChange={(event) =>
              actions.setDiscountInput(sanitizeMoneyInput(event.target.value))
            }
            placeholder="0"
            ref={discountInputRef}
            type="text"
            value={formatMoneyInput(state.discountInput)}
          />
          {state.hasDiscountError ? (
            <Text className="text-red-400 text-xs">
              El descuento no puede superar{" "}
              {formatCurrency(state.totals.maxSaleDiscount)}
            </Text>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
