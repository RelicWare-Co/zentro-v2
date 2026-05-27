import { ArrowLeft, Minus, Plus, Search, Send, Trash2 } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { formatCurrency } from "@/features/pos/utils";
import type {
  RestaurantBootstrap,
  RestaurantTableDetail,
} from "@/features/restaurants/restaurants.shared";
import { cn } from "@/lib/utils";

interface Product {
  categoryName: string;
  id: string;
  name: string;
  price: number;
}

function getOrderStatusLabel(status: string): string {
  if (status === "draft") {
    return "Pendiente";
  }
  if (status === "sent") {
    return "En cocina";
  }
  if (status === "ready") {
    return "Listo";
  }
  return "Servido";
}

type OpenOrder = NonNullable<RestaurantTableDetail["openOrder"]>;
type OrderItem = OpenOrder["items"][number];

function OrderItemActions({
  deleteDraftPending,
  item,
  onDeleteDraftItem,
  onMarkItemServed,
  onUpdateDraftQuantity,
  updateDraftPending,
  updateStatusPending,
}: {
  item: OrderItem;
  updateDraftPending: boolean;
  deleteDraftPending: boolean;
  updateStatusPending: boolean;
  onUpdateDraftQuantity: (orderItemId: string, nextQuantity: number) => void;
  onDeleteDraftItem: (orderItemId: string) => void;
  onMarkItemServed: (orderItemId: string) => void;
}) {
  if (item.status === "draft") {
    return (
      <>
        <Button
          className="border-zinc-700 bg-transparent text-zinc-100 hover:bg-white/5"
          disabled={item.quantity <= 1 || updateDraftPending}
          onClick={() => onUpdateDraftQuantity(item.id, item.quantity - 1)}
          size="icon-sm"
          type="button"
          variant="outline"
        >
          <Minus aria-hidden="true" className="size-4" />
        </Button>
        <Button
          className="border-zinc-700 bg-transparent text-zinc-100 hover:bg-white/5"
          disabled={updateDraftPending}
          onClick={() => onUpdateDraftQuantity(item.id, item.quantity + 1)}
          size="icon-sm"
          type="button"
          variant="outline"
        >
          <Plus aria-hidden="true" className="size-4" />
        </Button>
        <Button
          className="border-zinc-700 bg-transparent text-zinc-100 hover:bg-white/5"
          disabled={deleteDraftPending}
          onClick={() => onDeleteDraftItem(item.id)}
          type="button"
          variant="outline"
        >
          <Trash2 aria-hidden="true" className="size-4" />
          Quitar
        </Button>
      </>
    );
  }

  if (item.status === "served") {
    return null;
  }

  return (
    <Button
      className="border-zinc-700 bg-transparent text-zinc-100 hover:bg-white/5"
      disabled={updateStatusPending}
      onClick={() => onMarkItemServed(item.id)}
      type="button"
      variant="outline"
    >
      Marcar servido
    </Button>
  );
}

function OrderItemsPanel({
  deleteDraftPending,
  onDeleteDraftItem,
  onMarkItemServed,
  onUpdateDraftQuantity,
  openOrder,
  updateDraftPending,
  updateStatusPending,
}: {
  openOrder: OpenOrder | null;
  updateDraftPending: boolean;
  deleteDraftPending: boolean;
  updateStatusPending: boolean;
  onUpdateDraftQuantity: (orderItemId: string, nextQuantity: number) => void;
  onDeleteDraftItem: (orderItemId: string) => void;
  onMarkItemServed: (orderItemId: string) => void;
}) {
  if (!openOrder) {
    return (
      <div className="py-8 text-center text-sm text-zinc-400">
        Agrega productos desde la carta para abrir la cuenta.
      </div>
    );
  }

  if (openOrder.items.length === 0) {
    return (
      <div className="py-8 text-center text-sm text-zinc-400">
        La cuenta está vacía. Toca un producto para empezar.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {openOrder.items.map((item) => (
        <div
          className="rounded-xl border border-zinc-800 bg-black/10 p-3"
          key={item.id}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="truncate font-medium text-white">
                {item.quantity} × {item.productName}
              </div>
              <div className="mt-1 text-sm text-zinc-400">
                {formatCurrency(item.totalAmount)}
              </div>
              {item.modifiers.length > 0 ? (
                <div className="mt-2 text-xs text-zinc-500">
                  {item.modifiers.map((modifier) => modifier.name).join(", ")}
                </div>
              ) : null}
            </div>
            <Badge
              className="shrink-0 border-zinc-700 bg-black/20 text-zinc-300"
              variant="outline"
            >
              {getOrderStatusLabel(item.status)}
            </Badge>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            <OrderItemActions
              deleteDraftPending={deleteDraftPending}
              item={item}
              onDeleteDraftItem={onDeleteDraftItem}
              onMarkItemServed={onMarkItemServed}
              onUpdateDraftQuantity={onUpdateDraftQuantity}
              updateDraftPending={updateDraftPending}
              updateStatusPending={updateStatusPending}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

interface RestaurantServiceViewProps {
  activeCategoryId: string;
  addItemPending: boolean;
  bootstrap: RestaurantBootstrap;
  closeOrderPending: boolean;
  deleteDraftPending: boolean;
  guestCountInput: string;
  onAddProduct: (productId: string) => void;
  onBack: () => void;
  onCategoryChange: (value: string) => void;
  onCloseOrder: () => void;
  onDeleteDraftItem: (orderItemId: string) => void;
  onGuestCountChange: (value: string) => void;
  onMarkItemServed: (orderItemId: string) => void;
  onNotesChange: (value: string) => void;
  onPaymentMethodChange: (value: string) => void;
  onPaymentReferenceChange: (value: string) => void;
  onSaveMeta: () => void;
  onSearchChange: (value: string) => void;
  onSendToKitchen: () => void;
  onUpdateDraftQuantity: (orderItemId: string, nextQuantity: number) => void;
  openOrder: RestaurantTableDetail["openOrder"];
  orderNotes: string;
  paymentMethod: string;
  paymentReference: string;
  products: Product[];
  requiresReference: boolean;
  searchQuery: string;
  selectedTable: NonNullable<RestaurantTableDetail["table"]>;
  sendToKitchenPending: boolean;
  updateDraftPending: boolean;
  updateOrderMetaPending: boolean;
  updateStatusPending: boolean;
}

export function RestaurantServiceView({
  bootstrap,
  selectedTable,
  openOrder,
  products,
  searchQuery,
  activeCategoryId,
  guestCountInput,
  orderNotes,
  paymentMethod,
  paymentReference,
  requiresReference,
  addItemPending,
  updateOrderMetaPending,
  sendToKitchenPending,
  closeOrderPending,
  updateDraftPending,
  deleteDraftPending,
  updateStatusPending,
  onBack,
  onSearchChange,
  onCategoryChange,
  onGuestCountChange,
  onNotesChange,
  onSaveMeta,
  onAddProduct,
  onSendToKitchen,
  onCloseOrder,
  onPaymentMethodChange,
  onPaymentReferenceChange,
  onUpdateDraftQuantity,
  onDeleteDraftItem,
  onMarkItemServed,
}: RestaurantServiceViewProps) {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3 border-zinc-800 border-b pb-4">
        <div className="flex min-w-0 items-center gap-3">
          <Button
            className="border-zinc-700 bg-transparent text-zinc-100 hover:bg-white/5"
            onClick={onBack}
            type="button"
            variant="outline"
          >
            <ArrowLeft aria-hidden="true" className="size-4" />
            Plano
          </Button>
          <div className="min-w-0">
            <div className="truncate font-semibold text-white text-xl">
              {selectedTable.name}
            </div>
            <div className="text-sm text-zinc-400">
              {selectedTable.areaName}
            </div>
          </div>
        </div>
        {openOrder ? (
          <Badge
            className="border-[var(--color-voltage)]/30 bg-[var(--color-voltage)]/10 text-[var(--color-voltage)]"
            variant="outline"
          >
            Orden #{openOrder.orderNumber}
          </Badge>
        ) : (
          <Badge
            className="border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
            variant="outline"
          >
            Mesa libre
          </Badge>
        )}
      </div>

      <div className="grid min-h-0 flex-1 gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
        <section className="flex min-h-0 flex-col rounded-2xl border border-zinc-800 bg-[var(--color-carbon)]">
          <div className="border-zinc-800 border-b p-4">
            <div className="mb-3 font-medium text-white">Carta</div>
            <div className="flex flex-wrap items-end gap-3">
              <div className="relative min-w-[220px] flex-1">
                <Search
                  aria-hidden="true"
                  className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-zinc-500"
                />
                <Input
                  autoComplete="off"
                  className="border-zinc-700 bg-black/20 pl-9"
                  onChange={(event) => onSearchChange(event.target.value)}
                  placeholder="Buscar producto…"
                  value={searchQuery}
                />
              </div>
              <NativeSelect
                className="w-[180px] border-zinc-700 bg-black/20"
                onChange={(event) => onCategoryChange(event.target.value)}
                value={activeCategoryId}
              >
                <NativeSelectOption value="all">Todas</NativeSelectOption>
                {bootstrap.categories.map((category) => (
                  <NativeSelectOption key={category.id} value={category.id}>
                    {category.name}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </div>
          </div>

          <ScrollArea className="min-h-[320px] flex-1 p-4">
            {products.length > 0 ? (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {products.map((product) => (
                  <button
                    className="group rounded-xl border border-zinc-800 bg-black/10 p-4 text-left transition-colors hover:border-[var(--color-voltage)]/40 hover:bg-black/20 disabled:opacity-60"
                    disabled={addItemPending}
                    key={product.id}
                    onClick={() => onAddProduct(product.id)}
                    type="button"
                  >
                    <div className="font-medium text-white">{product.name}</div>
                    <div className="mt-1 text-xs text-zinc-400">
                      {product.categoryName}
                    </div>
                    <div className="mt-3 flex items-center justify-between gap-2">
                      <span className="font-medium text-[var(--color-voltage)]">
                        {formatCurrency(product.price)}
                      </span>
                      <span className="flex size-8 items-center justify-center rounded-full border border-zinc-700 bg-black/20 text-zinc-300 transition-colors group-hover:border-[var(--color-voltage)]/50 group-hover:text-[var(--color-voltage)]">
                        <Plus aria-hidden="true" className="size-4" />
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="py-10 text-center text-sm text-zinc-400">
                No hay productos para ese filtro.
              </div>
            )}
          </ScrollArea>
        </section>

        <aside className="flex min-h-0 flex-col rounded-2xl border border-zinc-800 bg-[var(--color-carbon)]">
          <div className="border-zinc-800 border-b p-4">
            <div className="font-medium text-white">Cuenta</div>
            <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
              <div className="grid gap-2">
                <Label htmlFor="serviceGuestCount">Comensales</Label>
                <Input
                  autoComplete="off"
                  className="border-zinc-700 bg-black/20"
                  id="serviceGuestCount"
                  min={0}
                  onChange={(event) => onGuestCountChange(event.target.value)}
                  placeholder="2"
                  type="number"
                  value={guestCountInput}
                />
              </div>
              <div className="grid gap-2 sm:col-span-2 xl:col-span-1">
                <Label htmlFor="serviceOrderNotes">Notas</Label>
                <Textarea
                  autoComplete="off"
                  className="min-h-16 border-zinc-700 bg-black/20"
                  id="serviceOrderNotes"
                  onChange={(event) => onNotesChange(event.target.value)}
                  placeholder="Preferencias, alergias, celebración…"
                  value={orderNotes}
                />
              </div>
              <Button
                className="bg-[var(--color-voltage)] text-black hover:bg-[#d9f15c] sm:col-span-2 xl:col-span-1"
                disabled={!openOrder || updateOrderMetaPending}
                onClick={onSaveMeta}
                type="button"
              >
                {updateOrderMetaPending ? "Guardando…" : "Guardar datos"}
              </Button>
            </div>
          </div>

          <ScrollArea className="min-h-[220px] flex-1 p-4">
            <OrderItemsPanel
              deleteDraftPending={deleteDraftPending}
              onDeleteDraftItem={onDeleteDraftItem}
              onMarkItemServed={onMarkItemServed}
              onUpdateDraftQuantity={onUpdateDraftQuantity}
              openOrder={openOrder}
              updateDraftPending={updateDraftPending}
              updateStatusPending={updateStatusPending}
            />
          </ScrollArea>

          <div className="space-y-3 border-zinc-800 border-t p-4">
            {openOrder ? (
              <>
                <div className="rounded-xl border border-zinc-800 bg-black/10 p-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-zinc-400">Total</span>
                    <span className="font-semibold text-lg text-white">
                      {formatCurrency(openOrder.totals.totalAmount)}
                    </span>
                  </div>
                  <div className="mt-1 flex items-center justify-between text-sm">
                    <span className="text-zinc-400">Ítems</span>
                    <span className="text-zinc-200">
                      {openOrder.totals.itemCount}
                    </span>
                  </div>
                </div>

                <Button
                  className="w-full border-zinc-700 bg-transparent text-zinc-100 hover:bg-white/5"
                  disabled={
                    sendToKitchenPending ||
                    openOrder.totals.draftItemsCount === 0
                  }
                  onClick={onSendToKitchen}
                  type="button"
                  variant="outline"
                >
                  <Send aria-hidden="true" className="size-4" />
                  {sendToKitchenPending ? "Enviando…" : "Enviar a cocina"}
                </Button>

                {bootstrap.activeShift ? (
                  <div className="space-y-3 rounded-xl border border-zinc-800 bg-black/10 p-3">
                    <div className="grid gap-2">
                      <Label htmlFor="servicePaymentMethod">
                        Método de pago
                      </Label>
                      <NativeSelect
                        id="servicePaymentMethod"
                        onChange={(event) =>
                          onPaymentMethodChange(event.target.value)
                        }
                        value={paymentMethod}
                      >
                        {bootstrap.settings.paymentMethods.map((method) => (
                          <NativeSelectOption key={method.id} value={method.id}>
                            {method.label}
                          </NativeSelectOption>
                        ))}
                      </NativeSelect>
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="servicePaymentReference">
                        Referencia
                      </Label>
                      <Input
                        autoComplete="off"
                        className="border-zinc-700 bg-black/20"
                        id="servicePaymentReference"
                        onChange={(event) =>
                          onPaymentReferenceChange(event.target.value)
                        }
                        placeholder="Voucher, transferencia…"
                        value={paymentReference}
                      />
                    </div>
                    <Button
                      className={cn(
                        "w-full bg-[var(--color-voltage)] text-black hover:bg-[#d9f15c]"
                      )}
                      disabled={
                        closeOrderPending ||
                        (requiresReference &&
                          paymentReference.trim().length === 0)
                      }
                      onClick={onCloseOrder}
                      type="button"
                    >
                      {closeOrderPending ? "Cobrando…" : "Cobrar mesa"}
                    </Button>
                  </div>
                ) : (
                  <Alert className="border-zinc-700 bg-black/10 text-[var(--color-photon)]">
                    <AlertTitle>Caja requerida</AlertTitle>
                    <AlertDescription>
                      Abre una caja en POS para poder cobrar la mesa.
                    </AlertDescription>
                  </Alert>
                )}
              </>
            ) : null}
          </div>
        </aside>
      </div>
    </div>
  );
}
