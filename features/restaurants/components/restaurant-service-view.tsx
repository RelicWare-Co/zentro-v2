import {
  ActionIcon,
  Alert,
  Badge,
  Button,
  NativeSelect,
  ScrollArea,
  Textarea,
  TextInput,
} from "@mantine/core";
import { ArrowLeft, Minus, Plus, Search, Send, Trash2 } from "lucide-react";
import { formatCurrency } from "@/features/pos/utils";
import type {
  RestaurantBootstrap,
  RestaurantTableDetail,
} from "@/features/restaurants/restaurants.shared";
import { getOrderItemStatusLabel } from "@/features/restaurants/restaurants-ui.shared";
import { darkInputStyles } from "@/lib/mantine-dark";

interface Product {
  categoryName: string;
  id: string;
  name: string;
  price: number;
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
        <ActionIcon
          aria-label="Restar unidad"
          color="gray"
          disabled={item.quantity <= 1 || updateDraftPending}
          onClick={() => onUpdateDraftQuantity(item.id, item.quantity - 1)}
          type="button"
          variant="outline"
        >
          <Minus aria-hidden="true" className="size-4" />
        </ActionIcon>
        <ActionIcon
          aria-label="Sumar unidad"
          color="gray"
          disabled={updateDraftPending}
          onClick={() => onUpdateDraftQuantity(item.id, item.quantity + 1)}
          type="button"
          variant="outline"
        >
          <Plus aria-hidden="true" className="size-4" />
        </ActionIcon>
        <Button
          color="gray"
          disabled={deleteDraftPending}
          leftSection={<Trash2 aria-hidden="true" className="size-4" />}
          onClick={() => onDeleteDraftItem(item.id)}
          type="button"
          variant="outline"
        >
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
      color="gray"
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
            <Badge color="gray" tt="none" variant="outline">
              {getOrderItemStatusLabel(item.status)}
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
            color="gray"
            leftSection={<ArrowLeft aria-hidden="true" className="size-4" />}
            onClick={onBack}
            type="button"
            variant="outline"
          >
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
            tt="none"
            variant="outline"
          >
            Orden #{openOrder.orderNumber}
          </Badge>
        ) : (
          <Badge
            className="border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
            tt="none"
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
              <div className="min-w-[220px] flex-1">
                <TextInput
                  autoComplete="off"
                  leftSection={
                    <Search
                      aria-hidden="true"
                      className="size-4 text-zinc-500"
                    />
                  }
                  onChange={(event) => onSearchChange(event.target.value)}
                  placeholder="Buscar producto…"
                  styles={darkInputStyles}
                  value={searchQuery}
                />
              </div>
              <NativeSelect
                className="w-[180px]"
                data={[
                  { value: "all", label: "Todas" },
                  ...bootstrap.categories.map((category) => ({
                    value: category.id,
                    label: category.name,
                  })),
                ]}
                onChange={(event) => onCategoryChange(event.target.value)}
                styles={darkInputStyles}
                value={activeCategoryId}
              />
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
              <TextInput
                autoComplete="off"
                label="Comensales"
                min={0}
                onChange={(event) => onGuestCountChange(event.target.value)}
                placeholder="2"
                styles={darkInputStyles}
                type="number"
                value={guestCountInput}
              />
              <Textarea
                autoComplete="off"
                className="sm:col-span-2 xl:col-span-1"
                label="Notas"
                onChange={(event) => onNotesChange(event.target.value)}
                placeholder="Preferencias, alergias, celebración…"
                styles={darkInputStyles}
                value={orderNotes}
              />
              <Button
                c="black"
                className="sm:col-span-2 xl:col-span-1"
                color="voltage.5"
                disabled={!openOrder}
                loading={updateOrderMetaPending}
                onClick={onSaveMeta}
                type="button"
              >
                Guardar datos
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
                  color="gray"
                  disabled={
                    sendToKitchenPending ||
                    openOrder.totals.draftItemsCount === 0
                  }
                  fullWidth
                  leftSection={<Send aria-hidden="true" className="size-4" />}
                  onClick={onSendToKitchen}
                  type="button"
                  variant="outline"
                >
                  {sendToKitchenPending ? "Enviando…" : "Enviar a cocina"}
                </Button>

                {bootstrap.activeShift ? (
                  <div className="space-y-3 rounded-xl border border-zinc-800 bg-black/10 p-3">
                    <NativeSelect
                      data={bootstrap.settings.paymentMethods.map((method) => ({
                        value: method.id,
                        label: method.label,
                      }))}
                      label="Método de pago"
                      onChange={(event) =>
                        onPaymentMethodChange(event.target.value)
                      }
                      styles={darkInputStyles}
                      value={paymentMethod}
                    />
                    <TextInput
                      autoComplete="off"
                      label="Referencia"
                      onChange={(event) =>
                        onPaymentReferenceChange(event.target.value)
                      }
                      placeholder="Voucher, transferencia…"
                      styles={darkInputStyles}
                      value={paymentReference}
                    />
                    <Button
                      c="black"
                      color="voltage.5"
                      disabled={
                        closeOrderPending ||
                        (requiresReference &&
                          paymentReference.trim().length === 0)
                      }
                      fullWidth
                      loading={closeOrderPending}
                      onClick={onCloseOrder}
                      type="button"
                    >
                      Cobrar mesa
                    </Button>
                  </div>
                ) : (
                  <Alert color="gray" title="Caja requerida">
                    Abre una caja en POS para poder cobrar la mesa.
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
