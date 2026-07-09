import { TextInput } from "@mantine/core";
import { Minus, Plus, Trash2 } from "lucide-react";
import type { CartItem } from "@/features/pos/types";
import { calculateItemTotal } from "@/features/pos/utils";
import {
  posV2MutedText,
  posV2OrderBorder,
  posV2OrderHoverBorder,
  posV2OrderHoverSurface,
  posV2OrderInputClassName,
  posV2OrderPanelBg,
  posV2OrderSurfaceClassName,
  posV2SubtleText,
} from "@/features/posv2/components/pos-v2-order-styles";
import { formatCurrency } from "@/lib/format-currency.shared";
import { cn, formatMoneyInput, sanitizeMoneyInput } from "@/lib/utils";

interface CartItemCardV2Props {
  item: CartItem;
  onRemove: () => void;
  onUpdateDiscount: (value: string) => void;
  onUpdateQuantity: (delta: number) => void;
  /** Disables quantity/remove controls (e.g. ítems de mesa ya enviados). */
  readOnly?: boolean;
  /** Hides the per-item discount input (mesas no soportan descuentos). */
  showDiscount?: boolean;
  statusBadge?: { className: string; label: string } | null;
}

export function CartItemCardV2({
  item,
  onUpdateQuantity,
  onRemove,
  onUpdateDiscount,
  readOnly = false,
  showDiscount = true,
  statusBadge = null,
}: CartItemCardV2Props) {
  return (
    <div
      className={cn(
        "group p-3 transition-colors",
        posV2OrderHoverBorder,
        posV2OrderSurfaceClassName
      )}
    >
      <div className="flex flex-col gap-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <h4 className="truncate font-medium text-sm text-white leading-tight">
              {item.product.name}
            </h4>
            <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
              <span
                className={cn(
                  "font-medium text-xs tabular-nums",
                  posV2MutedText
                )}
              >
                {formatCurrency(item.product.price)} / un
              </span>
              {statusBadge ? (
                <span
                  className={cn(
                    "rounded px-1.5 py-0.5 font-medium text-[10px]",
                    statusBadge.className
                  )}
                >
                  {statusBadge.label}
                </span>
              ) : null}
            </div>
            {item.modifiers.length > 0 && (
              <div className="mt-1 flex flex-wrap gap-1.5">
                {item.modifiers.map((modifier) => (
                  <span
                    className={cn(
                      "rounded px-1.5 py-0.5 text-[10px]",
                      posV2SubtleText,
                      posV2OrderBorder,
                      posV2OrderPanelBg
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
          {showDiscount &&
          !readOnly &&
          item.product.accountingTreatment !== "passthrough" ? (
            <div className="flex min-w-0 flex-1 items-center gap-1.5">
              <label
                className={cn("shrink-0 text-[10px]", posV2MutedText)}
                htmlFor={`item-discount-${item.id}`}
              >
                Desc.
              </label>
              <TextInput
                autoComplete="off"
                className="min-w-0 flex-1"
                classNames={{
                  input: cn(
                    "h-8 touch-manipulation md:text-xs",
                    posV2OrderInputClassName
                  ),
                }}
                id={`item-discount-${item.id}`}
                inputMode="numeric"
                leftSection={
                  <span className={cn("text-xs", posV2MutedText)}>$</span>
                }
                onChange={(event) =>
                  onUpdateDiscount(sanitizeMoneyInput(event.target.value))
                }
                placeholder="0"
                type="text"
                value={formatMoneyInput(item.discountAmount)}
              />
            </div>
          ) : (
            <div className="min-w-0 flex-1" />
          )}

          {readOnly ? (
            <div
              className={cn(
                "px-2 font-semibold text-sm tabular-nums",
                posV2SubtleText
              )}
            >
              x{item.quantity}
            </div>
          ) : (
            <>
              <div
                className={cn(
                  "flex items-center rounded-lg",
                  posV2OrderBorder,
                  posV2OrderPanelBg
                )}
              >
                <button
                  aria-label="Disminuir cantidad"
                  className={cn(
                    "flex h-7 w-8 items-center justify-center rounded-l-lg transition-colors hover:text-white disabled:opacity-50",
                    posV2MutedText,
                    posV2OrderHoverSurface
                  )}
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
                  className={cn(
                    "flex h-7 w-8 items-center justify-center rounded-r-lg transition-colors hover:text-white",
                    posV2MutedText,
                    posV2OrderHoverSurface
                  )}
                  onClick={() => onUpdateQuantity(1)}
                  type="button"
                >
                  <Plus className="size-3" />
                </button>
              </div>
              <button
                aria-label="Eliminar producto"
                className={cn(
                  "rounded-lg p-1.5 transition-colors hover:bg-red-400/10 hover:text-red-400",
                  posV2MutedText
                )}
                onClick={onRemove}
                type="button"
              >
                <Trash2 className="size-4" />
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
