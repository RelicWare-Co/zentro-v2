import { Minus, Plus, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import type { CartItem } from "@/features/pos/types";
import { calculateItemTotal, formatCurrency } from "@/features/pos/utils";
import {
  posV2OrderBorder,
  posV2OrderInputClassName,
  posV2OrderSurfaceClassName,
} from "@/features/posv2/components/pos-v2-order-styles";
import { cn, formatMoneyInput, sanitizeMoneyInput } from "@/lib/utils";

interface CartItemCardV2Props {
  item: CartItem;
  onRemove: () => void;
  onUpdateDiscount: (value: string) => void;
  onUpdateQuantity: (delta: number) => void;
}

export function CartItemCardV2({
  item,
  onUpdateQuantity,
  onRemove,
  onUpdateDiscount,
}: CartItemCardV2Props) {
  return (
    <div
      className={cn(
        "group p-3 transition-colors hover:border-[rgba(255,255,255,0.15)]",
        posV2OrderSurfaceClassName
      )}
    >
      <div className="flex flex-col gap-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <h4 className="truncate font-medium text-sm text-white leading-tight">
              {item.product.name}
            </h4>
            <div className="mt-0.5 font-medium text-[#6b6b6b] text-xs tabular-nums">
              {formatCurrency(item.product.price)} / un
            </div>
            {item.modifiers.length > 0 && (
              <div className="mt-1 flex flex-wrap gap-1.5">
                {item.modifiers.map((modifier) => (
                  <span
                    className={cn(
                      "rounded px-1.5 py-0.5 text-[#a0a0a0] text-[10px]",
                      posV2OrderBorder,
                      "bg-[#111111]"
                    )}
                    key={`${item.id}-${modifier.id}`}
                  >
                    x{modifier.quantity} {modifier.name}
                  </span>
                ))}
              </div>
            )}
          </div>
          <div className="shrink-0 text-right font-bold text-sm text-white tabular-nums">
            {formatCurrency(calculateItemTotal(item))}
          </div>
        </div>

        <div className="mt-1 flex items-center justify-between gap-2">
          <div className="flex min-w-0 flex-1 items-center gap-1.5">
            <label
              className="shrink-0 text-[#6b6b6b] text-[10px]"
              htmlFor={`item-discount-${item.id}`}
            >
              Desc.
            </label>
            <div className="relative min-w-0 flex-1">
              <span className="absolute top-1/2 left-2 -translate-y-1/2 text-[#6b6b6b] text-xs">
                $
              </span>
              <Input
                autoComplete="off"
                className={cn(
                  "h-8 touch-manipulation pl-6 md:text-xs",
                  posV2OrderInputClassName
                )}
                id={`item-discount-${item.id}`}
                inputMode="numeric"
                onChange={(event) =>
                  onUpdateDiscount(sanitizeMoneyInput(event.target.value))
                }
                type="text"
                value={formatMoneyInput(item.discountAmount)}
              />
            </div>
          </div>

          <div
            className={cn(
              "flex items-center rounded-lg",
              posV2OrderBorder,
              "bg-[#111111]"
            )}
          >
            <button
              aria-label="Disminuir cantidad"
              className="flex h-7 w-8 items-center justify-center rounded-l-lg text-[#6b6b6b] transition-colors hover:bg-[rgba(255,255,255,0.08)] hover:text-white disabled:opacity-50"
              onClick={() => onUpdateQuantity(-1)}
              type="button"
            >
              <Minus className="size-3" />
            </button>
            <div className="w-8 text-center font-semibold text-sm text-white">
              {item.quantity}
            </div>
            <button
              aria-label="Aumentar cantidad"
              className="flex h-7 w-8 items-center justify-center rounded-r-lg text-[#6b6b6b] transition-colors hover:bg-[rgba(255,255,255,0.08)] hover:text-white"
              onClick={() => onUpdateQuantity(1)}
              type="button"
            >
              <Plus className="size-3" />
            </button>
          </div>
          <button
            aria-label="Eliminar producto"
            className="rounded-lg p-1.5 text-[#6b6b6b] transition-colors hover:bg-red-400/10 hover:text-red-400"
            onClick={onRemove}
            type="button"
          >
            <Trash2 className="size-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
