import { Menu, TextInput } from "@mantine/core";
import { MessageSquareText, Minus, Plus, Trash2 } from "lucide-react";
import { formatCurrency } from "@/lib/format-currency.shared";
import { cn, formatMoneyInput, sanitizeMoneyInput } from "@/lib/utils";
import type { CartItem } from "../types";
import { calculateItemTotal } from "../utils";

interface CartItemCardProps {
  item: CartItem;
  onEditComment?: () => void;
  onRemove: () => void;
  onUpdateDiscount: (value: string) => void;
  onUpdateQuantity: (delta: number) => void;
  /** Disables quantity/remove controls (e.g. ítems de mesa ya enviados). */
  readOnly?: boolean;
  /** Hides the per-item discount input (mesas no soportan descuentos). */
  showDiscount?: boolean;
  statusBadge?: { className: string; label: string } | null;
}

export function CartItemCard({
  item,
  onEditComment,
  onUpdateQuantity,
  onRemove,
  onUpdateDiscount,
  readOnly = false,
  showDiscount = true,
  statusBadge = null,
}: CartItemCardProps) {
  const card = (
    <div className="group rounded-lg border border-zinc-800/50 bg-[#151515] p-3 transition-colors hover:border-zinc-700">
      <div className="flex flex-col gap-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <h4 className="truncate font-medium text-sm text-white leading-tight">
              {item.product.name}
            </h4>
            <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
              <span className="font-medium text-xs text-zinc-500 tabular-nums">
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
                    className="rounded border border-zinc-800 bg-black/50 px-1.5 py-0.5 text-[10px] text-zinc-300"
                    key={`${item.id}-${modifier.id}`}
                  >
                    x{modifier.quantity} {modifier.name}
                  </span>
                ))}
              </div>
            )}
            {item.notes ? (
              <p className="mt-2 flex items-start gap-1.5 whitespace-pre-wrap break-words text-amber-100 text-xs leading-snug">
                <MessageSquareText
                  aria-hidden="true"
                  className="mt-0.5 size-3 shrink-0"
                />
                <span>
                  <span className="font-semibold">Nota: </span>
                  {item.notes}
                </span>
              </p>
            ) : null}
          </div>
          <div className="shrink-0 text-right font-bold text-sm text-white tabular-nums">
            {formatCurrency(calculateItemTotal(item))}
          </div>
        </div>

        {showDiscount &&
        !readOnly &&
        item.product.accountingTreatment !== "passthrough" ? (
          <div className="mt-1">
            <label
              className="text-[10px] text-zinc-500"
              htmlFor={`item-discount-${item.id}`}
            >
              Descuento ítem
            </label>
            <TextInput
              autoComplete="off"
              classNames={{
                input:
                  "h-9 touch-manipulation border-zinc-800/80! bg-black/50! text-base text-white! md:h-8 md:text-xs",
              }}
              id={`item-discount-${item.id}`}
              inputMode="numeric"
              leftSection={<span className="text-xs text-zinc-500">$</span>}
              mt={4}
              onChange={(event) =>
                onUpdateDiscount(sanitizeMoneyInput(event.target.value))
              }
              placeholder="0"
              type="text"
              value={formatMoneyInput(item.discountAmount)}
            />
          </div>
        ) : null}

        <div className="mt-1 flex items-center justify-between">
          {readOnly ? (
            <div className="px-1 font-semibold text-sm text-zinc-400 tabular-nums">
              x{item.quantity}
            </div>
          ) : (
            <>
              <div className="flex items-center rounded-md border border-zinc-800/80 bg-black/50">
                <button
                  aria-label="Disminuir cantidad"
                  className="flex h-7 w-8 items-center justify-center rounded-l-md text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-white disabled:opacity-50"
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
                  className="flex h-7 w-8 items-center justify-center rounded-r-md text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-white"
                  onClick={() => onUpdateQuantity(1)}
                  type="button"
                >
                  <Plus className="size-3" />
                </button>
              </div>
              {onEditComment ? (
                <button
                  aria-label={
                    item.notes
                      ? "Editar comentario para cocina"
                      : "Agregar comentario para cocina"
                  }
                  className="rounded-md p-1.5 text-amber-200 transition-colors hover:bg-amber-400/10 hover:text-amber-100"
                  onClick={onEditComment}
                  type="button"
                >
                  <MessageSquareText className="size-4" />
                </button>
              ) : null}
              <button
                aria-label="Eliminar producto"
                className="rounded-md p-1.5 text-red-300 transition-colors hover:bg-red-400/10 hover:text-red-100"
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

  if (!onEditComment) {
    return card;
  }

  return (
    <Menu shadow="md" width={220}>
      <Menu.ContextMenu>{card}</Menu.ContextMenu>
      <Menu.Dropdown>
        <Menu.Item
          leftSection={<MessageSquareText className="size-4" />}
          onClick={onEditComment}
        >
          {item.notes ? "Editar comentario" : "Agregar comentario"}
        </Menu.Item>
      </Menu.Dropdown>
    </Menu>
  );
}
