import { Minus, Plus, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { formatMoneyInput, sanitizeMoneyInput } from "@/lib/utils";
import type { CartItem } from "@/features/pos/types";
import { calculateItemTotal, formatCurrency } from "@/features/pos/utils";

interface CartItemCardV2Props {
  item: CartItem;
  onUpdateQuantity: (delta: number) => void;
  onRemove: () => void;
  onUpdateDiscount: (value: string) => void;
}

export function CartItemCardV2({
  item,
  onUpdateQuantity,
  onRemove,
  onUpdateDiscount,
}: CartItemCardV2Props) {
  return (
    <div className="bg-[#151515] p-3 rounded-xl border border-[rgba(255,255,255,0.08)] hover:border-[rgba(255,255,255,0.15)] transition-colors group">
      <div className="flex flex-col gap-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <h4 className="font-medium text-sm text-white truncate leading-tight">
              {item.product.name}
            </h4>
            <div className="text-xs text-[#6b6b6b] font-medium mt-0.5 tabular-nums">
              {formatCurrency(item.product.price)} / un
            </div>
            {item.modifiers.length > 0 && (
              <div className="mt-1 flex flex-wrap gap-1.5">
                {item.modifiers.map((modifier) => (
                  <span
                    key={`${item.id}-${modifier.id}`}
                    className="text-[10px] bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.08)] rounded px-1.5 py-0.5 text-[#a0a0a0]"
                  >
                    x{modifier.quantity} {modifier.name}
                  </span>
                ))}
              </div>
            )}
          </div>
          <div className="font-bold text-sm text-white text-right shrink-0 tabular-nums">
            {formatCurrency(calculateItemTotal(item))}
          </div>
        </div>

        <div className="mt-1">
          <label
            htmlFor={`item-discount-${item.id}`}
            className="text-[10px] text-[#6b6b6b]"
          >
            Descuento ítem
          </label>
          <div className="relative mt-1">
            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[#6b6b6b] text-xs">
              $
            </span>
            <Input
              id={`item-discount-${item.id}`}
              type="text"
              inputMode="numeric"
              autoComplete="off"
              value={formatMoneyInput(item.discountAmount)}
              onChange={(event) =>
                onUpdateDiscount(sanitizeMoneyInput(event.target.value))
              }
              className="h-9 touch-manipulation border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)] pl-6 text-white text-base md:h-8 md:text-xs focus-visible:border-[#dfff06]/30 focus-visible:ring-[#dfff06]/10"
            />
          </div>
        </div>

        <div className="flex items-center justify-between mt-1">
          <div className="flex items-center bg-[rgba(255,255,255,0.03)] rounded-lg border border-[rgba(255,255,255,0.08)]">
            <button
              type="button"
              onClick={() => onUpdateQuantity(-1)}
              className="h-7 w-8 flex items-center justify-center text-[#6b6b6b] hover:text-white hover:bg-[rgba(255,255,255,0.08)] rounded-l-lg transition-colors disabled:opacity-50"
              aria-label="Disminuir cantidad"
            >
              <Minus className="h-3 w-3" />
            </button>
            <div className="w-8 text-center text-sm font-semibold text-white">
              {item.quantity}
            </div>
            <button
              type="button"
              onClick={() => onUpdateQuantity(1)}
              className="h-7 w-8 flex items-center justify-center text-[#6b6b6b] hover:text-white hover:bg-[rgba(255,255,255,0.08)] rounded-r-lg transition-colors"
              aria-label="Aumentar cantidad"
            >
              <Plus className="h-3 w-3" />
            </button>
          </div>
          <button
            type="button"
            onClick={onRemove}
            className="text-[#6b6b6b] hover:text-red-400 p-1.5 rounded-lg hover:bg-red-400/10 transition-colors"
            aria-label="Eliminar producto"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
