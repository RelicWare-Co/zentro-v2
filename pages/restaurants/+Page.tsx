import {
  startTransition,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { usePosProducts } from "@/features/pos/hooks/use-pos-queries";
import { formatCurrency } from "@/features/pos/utils";
import {
  useAddRestaurantOrderItemMutation,
  useCloseRestaurantOrderMutation,
  useDeleteRestaurantDraftItemMutation,
  useRestaurantBootstrap,
  useRestaurantTableDetail,
  useSendRestaurantOrderToKitchenMutation,
  useUpdateRestaurantDraftItemMutation,
  useUpdateRestaurantOrderItemStatusMutation,
  useUpdateRestaurantOrderMetaMutation,
} from "@/features/restaurants/hooks/use-restaurants";
import { buildKitchenTicketDocument } from "@/features/restaurants/printing/kitchen-ticket-documents";
import { useActiveOrganization } from "@/lib/auth-client";

interface KitchenTicket {
  createdAt: number;
  id: string;
  items: KitchenTicketItem[];
  orderNumber: number;
  sequenceNumber: number;
  table: { name: string; areaName: string };
}

interface KitchenTicketItem {
  modifiers: { name: string; quantity: number; unitPrice: number }[];
  notes: string | null;
  productName: string;
  quantity: number;
  totalAmount: number;
}

interface BootstrapData {
  activeShift?: { id: string } | null;
  areas: {
    id: string;
    name: string;
    tables: {
      id: string;
      name: string;
      seats: number;
      openOrder?: { orderNumber: number | string; totalAmount: number } | null;
    }[];
  }[];
  categories: { id: string; name: string }[];
  settings: {
    paymentMethods: {
      id: string;
      label: string;
      requiresReference?: boolean;
    }[];
    restaurant: { kitchen: { displayEnabled: boolean } };
  };
}

interface OpenOrder {
  guestCount: number;
  id: string;
  items: OrderItem[];
  notes?: string | null;
  orderNumber: number | string;
  totals: {
    totalAmount: number;
    itemCount: number;
    draftItemsCount: number;
  };
}

interface OrderItem {
  id: string;
  modifiers: { name: string }[];
  productName: string;
  quantity: number;
  status: string;
  totalAmount: number;
}

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

async function printKitchenTicket(
  ticket: KitchenTicket,
  activeOrganizationId: string | null
) {
  const document = buildKitchenTicketDocument({
    ticketId: ticket.id,
    orderNumber: ticket.orderNumber,
    sequenceNumber: ticket.sequenceNumber,
    createdAt: ticket.createdAt,
    tableName: ticket.table.name,
    areaName: ticket.table.areaName,
    items: ticket.items.map((item) => ({
      productName: item.productName,
      quantity: item.quantity,
      notes: item.notes,
      modifiers: item.modifiers.map((m) => ({
        name: m.name,
        quantity: m.quantity,
        unitPrice: m.unitPrice,
      })),
      totalAmount: item.totalAmount,
    })),
  });
  const { printThermalReceipt } = await import(
    "@/features/pos/printing/print-thermal-receipt.client"
  );
  await printThermalReceipt(document, activeOrganizationId);
}

async function runMutation(
  operation: () => Promise<unknown>,
  onFeedback: (message: string | null) => void,
  errorMessage: string,
  options?: { successMessage?: string; onSuccess?: () => void }
) {
  onFeedback(null);
  try {
    await operation();
    if (options?.successMessage) {
      onFeedback(options.successMessage);
    }
    options?.onSuccess?.();
  } catch (error) {
    onFeedback(error instanceof Error ? error.message : errorMessage);
  }
}

async function performSendToKitchen(
  resultPromise: Promise<unknown>,
  activeOrganizationId: string | null
) {
  const result = (await resultPromise) as {
    ticket: KitchenTicket;
    printing: { enabled: boolean; autoPrintOnSend: boolean };
  };
  if (result.printing.enabled && result.printing.autoPrintOnSend) {
    await printKitchenTicket(result.ticket, activeOrganizationId);
  }
}

function syncDraftInputs(
  signature: string,
  previousRef: React.MutableRefObject<string>,
  openOrder: { guestCount: number; notes?: string | null } | null,
  setGuestCount: (val: string) => void,
  setNotes: (val: string) => void
) {
  if (signature === previousRef.current) {
    return;
  }
  previousRef.current = signature;
  if (openOrder) {
    setGuestCount(String(openOrder.guestCount));
    setNotes(openOrder.notes ?? "");
  } else {
    setGuestCount("0");
    setNotes("");
  }
}

function TableSidebar({
  bootstrap,
  resolvedSelectedTableId,
  onSelectTable,
}: {
  bootstrap: BootstrapData | null;
  resolvedSelectedTableId: string | null;
  onSelectTable: (tableId: string) => void;
}) {
  if (!bootstrap) {
    return null;
  }
  return (
    <Card className="border-zinc-800 bg-[var(--color-carbon)] shadow-none">
      <CardHeader className="border-zinc-800 border-b pb-4">
        <CardTitle className="text-base">Mesas</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5 pt-5">
        {bootstrap.areas.map((area) => (
          <section key={area.id}>
            <h2 className="mb-2 font-medium text-sm text-zinc-300">
              {area.name}
            </h2>
            <div className="space-y-2">
              {area.tables.map((table) => {
                const isSelected = table.id === resolvedSelectedTableId;
                return (
                  <button
                    className={`w-full rounded-lg border px-3 py-3 text-left transition-colors ${
                      isSelected
                        ? "border-[var(--color-voltage)] bg-black/20 text-white"
                        : "border-zinc-800 bg-black/10 text-zinc-200 hover:border-zinc-700 hover:bg-black/20"
                    }`}
                    key={table.id}
                    onClick={() => onSelectTable(table.id)}
                    type="button"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate font-medium">{table.name}</div>
                        <div className="mt-1 text-xs text-zinc-400">
                          {table.seats > 0
                            ? `${table.seats} puestos`
                            : "Sin capacidad definida"}
                        </div>
                      </div>
                      <div className="text-right text-xs text-zinc-400">
                        {table.openOrder ? (
                          <>
                            <div>Orden #{table.openOrder.orderNumber}</div>
                            <div>
                              {formatCurrency(table.openOrder.totalAmount)}
                            </div>
                          </>
                        ) : (
                          <div>Libre</div>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>
        ))}
      </CardContent>
    </Card>
  );
}

function ProductCatalog({
  selectedTable,
  guestCountInput,
  orderNotes,
  openOrder,
  updateOrderMetaPending,
  searchQuery,
  activeCategoryId,
  bootstrap,
  products,
  addItemPending,
  onGuestCountChange,
  onNotesChange,
  onSaveMeta,
  onSearchChange,
  onCategoryChange,
  onAddProduct,
}: {
  selectedTable: { name: string; areaName: string } | null;
  guestCountInput: string;
  orderNotes: string;
  openOrder: OpenOrder | null;
  updateOrderMetaPending: boolean;
  searchQuery: string;
  activeCategoryId: string;
  bootstrap: BootstrapData | null;
  products: Product[];
  addItemPending: boolean;
  onGuestCountChange: (value: string) => void;
  onNotesChange: (value: string) => void;
  onSaveMeta: () => void;
  onSearchChange: (value: string) => void;
  onCategoryChange: (value: string) => void;
  onAddProduct: (productId: string) => void;
}) {
  return (
    <Card className="border-zinc-800 bg-[var(--color-carbon)] shadow-none">
      <CardHeader className="border-zinc-800 border-b pb-4">
        <CardTitle className="text-base">
          {selectedTable
            ? `${selectedTable.name} · ${selectedTable.areaName}`
            : "Selecciona una mesa"}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6 pt-5">
        {selectedTable ? (
          <>
            <div className="grid gap-4 md:grid-cols-[120px_minmax(0,1fr)_auto]">
              <div className="grid gap-2">
                <Label htmlFor="guestCount">Comensales</Label>
                <Input
                  autoComplete="off"
                  className="border-zinc-700 bg-black/20"
                  id="guestCount"
                  min={0}
                  name="guestCount"
                  onChange={(event) => onGuestCountChange(event.target.value)}
                  type="number"
                  value={guestCountInput}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="orderNotes">Notas de la cuenta</Label>
                <Textarea
                  autoComplete="off"
                  className="min-h-20 border-zinc-700 bg-black/20"
                  id="orderNotes"
                  name="orderNotes"
                  onChange={(event) => onNotesChange(event.target.value)}
                  value={orderNotes}
                />
              </div>
              <div className="flex items-end">
                <Button
                  className="bg-[var(--color-voltage)] text-black hover:bg-[#d9f15c]"
                  disabled={!openOrder || updateOrderMetaPending}
                  onClick={onSaveMeta}
                  type="button"
                >
                  {updateOrderMetaPending ? "Guardando…" : "Guardar"}
                </Button>
              </div>
            </div>

            <section>
              <div className="mb-3 flex flex-wrap items-end gap-3">
                <div className="grid min-w-[220px] flex-1 gap-2">
                  <Label htmlFor="restaurantSearch">Buscar producto</Label>
                  <Input
                    autoComplete="off"
                    className="border-zinc-700 bg-black/20"
                    id="restaurantSearch"
                    name="restaurantSearch"
                    onChange={(event) => onSearchChange(event.target.value)}
                    placeholder="Nombre, SKU o código…"
                    value={searchQuery}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="restaurantCategory">Categoría</Label>
                  <NativeSelect
                    className="w-[180px]"
                    id="restaurantCategory"
                    name="restaurantCategory"
                    onChange={(event) => onCategoryChange(event.target.value)}
                    value={activeCategoryId}
                  >
                    <NativeSelectOption value="all">Todas</NativeSelectOption>
                    {bootstrap?.categories.map((category) => (
                      <NativeSelectOption key={category.id} value={category.id}>
                        {category.name}
                      </NativeSelectOption>
                    ))}
                  </NativeSelect>
                </div>
              </div>

              <div className="rounded-lg border border-zinc-800">
                <div className="grid grid-cols-[minmax(0,1fr)_140px_88px] border-zinc-800 border-b px-3 py-2 text-sm text-zinc-400">
                  <div>Producto</div>
                  <div>Precio</div>
                  <div />
                </div>
                {products.length > 0 ? (
                  products.map((product) => (
                    <div
                      className="grid grid-cols-[minmax(0,1fr)_140px_88px] items-center border-zinc-800 border-b px-3 py-2 last:border-b-0"
                      key={product.id}
                    >
                      <div className="min-w-0">
                        <div className="truncate">{product.name}</div>
                        <div className="mt-1 text-xs text-zinc-400">
                          {product.categoryName}
                        </div>
                      </div>
                      <div className="text-sm text-zinc-200">
                        {formatCurrency(product.price)}
                      </div>
                      <div className="flex justify-end">
                        <Button
                          className="border-zinc-700 bg-transparent text-zinc-100 hover:bg-white/5"
                          disabled={addItemPending}
                          onClick={() => onAddProduct(product.id)}
                          type="button"
                          variant="outline"
                        >
                          Agregar
                        </Button>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="px-3 py-6 text-sm text-zinc-400">
                    No hay productos para ese filtro.
                  </div>
                )}
              </div>
            </section>
          </>
        ) : (
          <div className="text-sm text-zinc-400">
            Selecciona una mesa para comenzar.
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function OrderItemCard({
  item,
  updateDraftPending,
  deleteDraftPending,
  updateStatusPending,
  onUpdateQuantity,
  onDelete,
  onMarkServed,
}: {
  item: OrderItem;
  updateDraftPending: boolean;
  deleteDraftPending: boolean;
  updateStatusPending: boolean;
  onUpdateQuantity: (orderItemId: string, nextQuantity: number) => void;
  onDelete: (orderItemId: string) => void;
  onMarkServed: (orderItemId: string) => void;
}) {
  let actions: React.ReactNode = null;
  if (item.status === "draft") {
    actions = (
      <>
        <Button
          className="border-zinc-700 bg-transparent text-zinc-100 hover:bg-white/5"
          disabled={item.quantity <= 1 || updateDraftPending}
          onClick={() => onUpdateQuantity(item.id, item.quantity - 1)}
          type="button"
          variant="outline"
        >
          -
        </Button>
        <Button
          className="border-zinc-700 bg-transparent text-zinc-100 hover:bg-white/5"
          disabled={updateDraftPending}
          onClick={() => onUpdateQuantity(item.id, item.quantity + 1)}
          type="button"
          variant="outline"
        >
          +
        </Button>
        <Button
          className="border-zinc-700 bg-transparent text-zinc-100 hover:bg-white/5"
          disabled={deleteDraftPending}
          onClick={() => onDelete(item.id)}
          type="button"
          variant="outline"
        >
          Quitar
        </Button>
      </>
    );
  } else if (item.status !== "served") {
    actions = (
      <Button
        className="border-zinc-700 bg-transparent text-zinc-100 hover:bg-white/5"
        disabled={updateStatusPending}
        onClick={() => onMarkServed(item.id)}
        type="button"
        variant="outline"
      >
        Marcar Servido
      </Button>
    );
  }

  return (
    <div className="rounded-lg border border-zinc-800 bg-black/10 p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate font-medium">
            {item.quantity} × {item.productName}
          </div>
          <div className="mt-1 text-sm text-zinc-400">
            {formatCurrency(item.totalAmount)}
          </div>
          {item.modifiers.length > 0 ? (
            <div className="mt-2 text-xs text-zinc-400">
              {item.modifiers.map((modifier) => modifier.name).join(", ")}
            </div>
          ) : null}
        </div>
        <div className="text-xs text-zinc-400">
          {getOrderStatusLabel(item.status)}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">{actions}</div>
    </div>
  );
}

function OrderAccountPanel({
  openOrder,
  bootstrap,
  sendToKitchenPending,
  closeOrderPending,
  paymentMethod,
  paymentReference,
  requiresReference,
  onSendToKitchen,
  onCloseOrder,
  onPaymentMethodChange,
  onPaymentReferenceChange,
  updateDraftPending,
  deleteDraftPending,
  updateStatusPending,
  onUpdateDraftQuantity,
  onDeleteDraftItem,
  onMarkItemServed,
}: {
  openOrder: OpenOrder | null;
  bootstrap: BootstrapData | null;
  sendToKitchenPending: boolean;
  closeOrderPending: boolean;
  paymentMethod: string;
  paymentReference: string;
  requiresReference: boolean;
  onSendToKitchen: () => void;
  onCloseOrder: () => void;
  onPaymentMethodChange: (value: string) => void;
  onPaymentReferenceChange: (value: string) => void;
  updateDraftPending: boolean;
  deleteDraftPending: boolean;
  updateStatusPending: boolean;
  onUpdateDraftQuantity: (orderItemId: string, nextQuantity: number) => void;
  onDeleteDraftItem: (orderItemId: string) => void;
  onMarkItemServed: (orderItemId: string) => void;
}) {
  if (!openOrder) {
    return (
      <div className="text-sm text-zinc-400">
        La mesa está libre. Agrega productos para crear la cuenta.
      </div>
    );
  }

  return (
    <>
      <div className="text-sm text-zinc-400">
        Orden #{openOrder.orderNumber}
      </div>
      <div className="space-y-3">
        {openOrder.items.length > 0 ? (
          openOrder.items.map((item) => (
            <OrderItemCard
              deleteDraftPending={deleteDraftPending}
              item={item}
              key={item.id}
              onDelete={onDeleteDraftItem}
              onMarkServed={onMarkItemServed}
              onUpdateQuantity={onUpdateDraftQuantity}
              updateDraftPending={updateDraftPending}
              updateStatusPending={updateStatusPending}
            />
          ))
        ) : (
          <div className="text-sm text-zinc-400">
            Agrega productos para abrir la cuenta.
          </div>
        )}
      </div>

      <div className="rounded-lg border border-zinc-800 bg-black/10 p-3">
        <div className="flex items-center justify-between text-sm">
          <span className="text-zinc-400">Total</span>
          <span className="font-medium text-white">
            {formatCurrency(openOrder.totals.totalAmount)}
          </span>
        </div>
        <div className="mt-1 flex items-center justify-between text-sm">
          <span className="text-zinc-400">Items</span>
          <span className="text-zinc-200">{openOrder.totals.itemCount}</span>
        </div>
      </div>

      <div className="flex gap-2">
        <Button
          className="border-zinc-700 bg-transparent text-zinc-100 hover:bg-white/5"
          disabled={
            sendToKitchenPending || openOrder.totals.draftItemsCount === 0
          }
          onClick={onSendToKitchen}
          type="button"
          variant="outline"
        >
          {sendToKitchenPending ? "Enviando…" : "Enviar a Cocina"}
        </Button>
      </div>

      {bootstrap?.activeShift ? (
        <div className="space-y-3 rounded-lg border border-zinc-800 bg-black/10 p-3">
          <div className="grid gap-3">
            <div className="grid gap-2">
              <Label htmlFor="paymentMethod">Método de pago</Label>
              <NativeSelect
                id="paymentMethod"
                name="paymentMethod"
                onChange={(event) => onPaymentMethodChange(event.target.value)}
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
              <Label htmlFor="paymentReference">Referencia</Label>
              <Input
                autoComplete="off"
                className="border-zinc-700 bg-black/20"
                id="paymentReference"
                name="paymentReference"
                onChange={(event) =>
                  onPaymentReferenceChange(event.target.value)
                }
                placeholder="Voucher, transferencia…"
                value={paymentReference}
              />
            </div>
          </div>
          <Button
            className="w-full bg-[var(--color-voltage)] text-black hover:bg-[#d9f15c]"
            disabled={
              closeOrderPending ||
              (requiresReference && paymentReference.trim().length === 0)
            }
            onClick={onCloseOrder}
            type="button"
          >
            {closeOrderPending ? "Cobrando…" : "Cobrar Mesa"}
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
  );
}

export default function RestaurantsPage() {
  const { data: activeOrganization } = useActiveOrganization();
  const activeOrganizationId = activeOrganization?.id ?? null;
  const {
    data: bootstrap,
    isError: isBootstrapError,
    error: bootstrapError,
  } = useRestaurantBootstrap();
  const allTables = useMemo(
    () => bootstrap?.areas.flatMap((area) => area.tables) ?? [],
    [bootstrap?.areas]
  );
  const [selectedTableId, setSelectedTableId] = useState<string | null>(
    () => allTables[0]?.id ?? null
  );
  const resolvedSelectedTableId =
    selectedTableId && allTables.some((table) => table.id === selectedTableId)
      ? selectedTableId
      : (allTables[0]?.id ?? null);
  const selectedTableDetailQuery = useRestaurantTableDetail(
    resolvedSelectedTableId
  );
  const selectedTableDetail = selectedTableDetailQuery.data ?? null;
  const selectedTable = selectedTableDetail?.table ?? null;
  const openOrder = selectedTableDetail?.openOrder ?? null;
  const [searchQuery, setSearchQuery] = useState("");
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const [activeCategoryId, setActiveCategoryId] = useState("all");
  const {
    data: productSearchResult,
    fetchNextPage: _fetchNextPage,
    hasNextPage: _hasNextPage,
    isFetchingNextPage: _isFetchingNextPage,
  } = usePosProducts(activeCategoryId, deferredSearchQuery);
  const [guestCountInput, setGuestCountInput] = useState("0");
  const [orderNotes, setOrderNotes] = useState("");
  const openOrderDraftSignature = openOrder
    ? `${openOrder.id}:${openOrder.guestCount}:${openOrder.notes ?? ""}`
    : "empty";
  const previousOpenOrderDraftSignatureRef = useRef(openOrderDraftSignature);
  const [paymentMethod, setPaymentMethod] = useState(
    bootstrap?.settings.paymentMethods[0]?.id ?? "cash"
  );
  const [paymentReference, setPaymentReference] = useState("");
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!bootstrap) {
      return;
    }
    setPaymentMethod((prev) => {
      const stillValid = bootstrap.settings.paymentMethods.some(
        (m) => m.id === prev
      );
      return stillValid
        ? prev
        : (bootstrap.settings.paymentMethods[0]?.id ?? "cash");
    });
  }, [bootstrap]);

  const addItemMutation = useAddRestaurantOrderItemMutation();
  const updateOrderMetaMutation = useUpdateRestaurantOrderMetaMutation();
  const updateDraftItemMutation = useUpdateRestaurantDraftItemMutation();
  const deleteDraftItemMutation = useDeleteRestaurantDraftItemMutation();
  const sendToKitchenMutation = useSendRestaurantOrderToKitchenMutation();
  const updateItemStatusMutation = useUpdateRestaurantOrderItemStatusMutation();
  const closeOrderMutation = useCloseRestaurantOrderMutation();

  syncDraftInputs(
    openOrderDraftSignature,
    previousOpenOrderDraftSignatureRef,
    openOrder,
    setGuestCountInput,
    setOrderNotes
  );

  const products =
    productSearchResult?.pages.flatMap((page) => page.data) ?? [];
  const requiresReference =
    bootstrap?.settings.paymentMethods.find(
      (method) => method.id === paymentMethod
    )?.requiresReference ?? false;

  const handleSelectTable = (tableId: string) => {
    startTransition(() => {
      setSelectedTableId(tableId);
    });
  };

  const handleAddProduct = async (productId: string) => {
    if (!resolvedSelectedTableId) {
      return;
    }
    await runMutation(
      () =>
        addItemMutation.mutateAsync({
          tableId: resolvedSelectedTableId,
          productId,
          quantity: 1,
          notes: null,
        }),
      setFeedbackMessage,
      "No se pudo agregar el producto a la mesa."
    );
  };

  const handleSaveOrderMeta = async () => {
    if (!openOrder) {
      return;
    }
    await runMutation(
      () =>
        updateOrderMetaMutation.mutateAsync({
          orderId: openOrder.id,
          guestCount: Number(guestCountInput) || 0,
          notes: orderNotes,
        }),
      setFeedbackMessage,
      "No se pudo actualizar la cuenta.",
      { successMessage: "La cuenta fue actualizada." }
    );
  };

  const handleSendToKitchen = async () => {
    if (!openOrder) {
      return;
    }
    await runMutation(
      () =>
        performSendToKitchen(
          sendToKitchenMutation.mutateAsync({ orderId: openOrder.id }),
          activeOrganizationId
        ),
      setFeedbackMessage,
      "No se pudo enviar la comanda a cocina.",
      { successMessage: "La comanda fue enviada a cocina." }
    );
  };

  const handleUpdateDraftQuantity = async (
    orderItemId: string,
    nextQuantity: number
  ) => {
    if (nextQuantity <= 0) {
      return;
    }
    await runMutation(
      () =>
        updateDraftItemMutation.mutateAsync({
          orderItemId,
          quantity: nextQuantity,
          notes: null,
        }),
      setFeedbackMessage,
      "No se pudo actualizar el ítem."
    );
  };

  const handleDeleteDraftItem = async (orderItemId: string) => {
    // biome-ignore lint/suspicious/noAlert: Required user confirmation for destructive action
    const confirmed = window.confirm(
      "¿Quitar este ítem de la cuenta? Solo aplica para ítems que aún no se han enviado."
    );
    if (!confirmed) {
      return;
    }
    await runMutation(
      () =>
        deleteDraftItemMutation.mutateAsync({
          orderItemId,
        }),
      setFeedbackMessage,
      "No se pudo eliminar el ítem."
    );
  };

  const handleMarkItemServed = async (orderItemId: string) => {
    await runMutation(
      () =>
        updateItemStatusMutation.mutateAsync({
          orderItemId,
          status: "served",
        }),
      setFeedbackMessage,
      "No se pudo actualizar el estado."
    );
  };

  const handleCloseOrder = async () => {
    if (!openOrder) {
      return;
    }
    if (!bootstrap?.activeShift) {
      return;
    }
    const shiftId = bootstrap.activeShift.id;
    await runMutation(
      () =>
        closeOrderMutation.mutateAsync({
          orderId: openOrder.id,
          shiftId,
          customerId: null,
          payments: [
            {
              method: paymentMethod,
              amount: openOrder.totals.totalAmount,
              reference: paymentReference || null,
            },
          ],
        }),
      setFeedbackMessage,
      "No se pudo cerrar la mesa.",
      {
        successMessage: "La mesa fue cobrada y cerrada.",
        onSuccess: () => setPaymentReference(""),
      }
    );
  };

  return (
    <main className="min-h-full bg-[var(--color-void)] p-6 text-[var(--color-photon)] md:p-8">
      {isBootstrapError ? (
        <Alert
          className="border-red-500/20 bg-red-500/10 text-red-100"
          variant="destructive"
        >
          <AlertTitle>Acceso denegado</AlertTitle>
          <AlertDescription>
            {bootstrapError instanceof Error
              ? bootstrapError.message
              : "No tienes acceso al módulo de restaurantes."}
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="font-semibold text-2xl">Restaurantes</h1>
          <p className="mt-1 text-sm text-zinc-400">
            Mesas, comandas y cierre de cuenta sobre el POS actual.
          </p>
        </div>
        {bootstrap?.settings.restaurant.kitchen.displayEnabled ? (
          <Button
            asChild
            className="border-zinc-700 bg-transparent text-zinc-100 hover:bg-white/5"
            variant="outline"
          >
            <a href="/kitchen">Ver Cocina</a>
          </Button>
        ) : null}
      </div>

      <div aria-live="polite" className="mb-4">
        {feedbackMessage ? (
          <Alert className="border-zinc-700 bg-[var(--color-carbon)] text-[var(--color-photon)]">
            <AlertTitle>Estado</AlertTitle>
            <AlertDescription>{feedbackMessage}</AlertDescription>
          </Alert>
        ) : null}
      </div>

      <div className="grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
        <TableSidebar
          bootstrap={bootstrap ?? null}
          onSelectTable={handleSelectTable}
          resolvedSelectedTableId={resolvedSelectedTableId}
        />

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
          <ProductCatalog
            activeCategoryId={activeCategoryId}
            addItemPending={addItemMutation.isPending}
            bootstrap={bootstrap ?? null}
            guestCountInput={guestCountInput}
            onAddProduct={handleAddProduct}
            onCategoryChange={setActiveCategoryId}
            onGuestCountChange={setGuestCountInput}
            onNotesChange={setOrderNotes}
            onSaveMeta={handleSaveOrderMeta}
            onSearchChange={setSearchQuery}
            openOrder={openOrder}
            orderNotes={orderNotes}
            products={products}
            searchQuery={searchQuery}
            selectedTable={selectedTable}
            updateOrderMetaPending={updateOrderMetaMutation.isPending}
          />
          <Card className="border-zinc-800 bg-[var(--color-carbon)] shadow-none">
            <CardHeader className="border-zinc-800 border-b pb-4">
              <CardTitle className="text-base">Cuenta</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 pt-5">
              <OrderAccountPanel
                bootstrap={bootstrap ?? null}
                closeOrderPending={closeOrderMutation.isPending}
                deleteDraftPending={deleteDraftItemMutation.isPending}
                onCloseOrder={handleCloseOrder}
                onDeleteDraftItem={handleDeleteDraftItem}
                onMarkItemServed={handleMarkItemServed}
                onPaymentMethodChange={setPaymentMethod}
                onPaymentReferenceChange={setPaymentReference}
                onSendToKitchen={handleSendToKitchen}
                onUpdateDraftQuantity={handleUpdateDraftQuantity}
                openOrder={openOrder}
                paymentMethod={paymentMethod}
                paymentReference={paymentReference}
                requiresReference={requiresReference}
                sendToKitchenPending={sendToKitchenMutation.isPending}
                updateDraftPending={updateDraftItemMutation.isPending}
                updateStatusPending={updateItemStatusMutation.isPending}
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  );
}
