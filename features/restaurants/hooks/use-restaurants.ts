import { useQuery as useZeroQuery } from "@rocicorp/zero/react";
import { useMemo, useRef } from "react";
import { usePageContext } from "vike-react/usePageContext";
import type { z } from "zod";
import type {
  AcknowledgeKitchenTicketPrintInputSchema,
  AddRestaurantOrderItemInputSchema,
  CancelRestaurantOrderInputSchema,
  ClaimKitchenTicketPrintInputSchema,
  CloseRestaurantOrderInputSchema,
  CreateRestaurantAreaInputSchema,
  CreateRestaurantTableInputSchema,
  DeleteRestaurantAreaInputSchema,
  DeleteRestaurantOrderItemInputSchema,
  DeleteRestaurantTableInputSchema,
  DiscardPendingKitchenChangesInputSchema,
  FailKitchenTicketPrintInputSchema,
  MarkKitchenTicketPrintedInputSchema,
  RequeueKitchenTicketPrintInputSchema,
  SendRestaurantOrderToKitchenInputSchema,
  UpdateRestaurantOrderItemInputSchema,
  UpdateRestaurantOrderItemStatusInputSchema,
  UpdateRestaurantOrderMetaInputSchema,
  UpdateRestaurantTableInputSchema,
} from "@/features/restaurants/restaurants.schema";
import type { RestaurantConfiguration } from "@/features/restaurants/restaurants.shared";
import {
  buildKitchenBoard,
  buildRestaurantBootstrap,
  buildRestaurantConfiguration,
  buildRestaurantTableDetail,
  type KitchenBoard,
  type RestaurantAreaRow,
  type RestaurantBootstrap,
  type RestaurantCategoryRow,
  type RestaurantKitchenTicketRow,
  type RestaurantOpenOrderRow,
  type RestaurantTableDetail,
  type RestaurantTableRow,
} from "@/features/restaurants/restaurants.shared";
import {
  getZeroQueryError,
  useZeroMutation,
  waitForZeroMutation,
} from "@/lib/use-zero-mutation";
import { mutators } from "@/zero/mutators";
import { queries } from "@/zero/queries";

export type { RestaurantConfiguration } from "@/features/restaurants/restaurants.shared";

function buildTableDetailData(params: {
  enabled: boolean;
  normalizedTableId: string;
  openOrderRows: RestaurantOpenOrderRow[];
  organizationMetadata: string | null | undefined;
  tableRows: RestaurantTableRow[];
  tableStatusType: string;
}) {
  if (!params.enabled) {
    return { data: null, error: null };
  }

  const table = params.tableRows[0];
  if (!table && params.tableStatusType !== "unknown") {
    return {
      data: null,
      error: new Error("La mesa no existe en la organización activa."),
    };
  }

  if (!table) {
    return { data: null, error: null };
  }

  try {
    const openOrder =
      params.openOrderRows.find(
        (orderRow) => orderRow.tableId === params.normalizedTableId
      ) ?? null;
    return {
      data: buildRestaurantTableDetail({
        organizationMetadata: params.organizationMetadata,
        table,
        openOrder,
      }),
      error: null,
    };
  } catch (error) {
    return {
      data: null,
      error: error instanceof Error ? error : new Error(String(error)),
    };
  }
}

export function useRestaurantBootstrap() {
  const pageContext = usePageContext();
  const zeroContext = pageContext.zeroContext;
  const [activeShiftRows, activeShiftStatus] = useZeroQuery(
    queries.shifts.active()
  );
  const [categoryRows, categoryStatus] = useZeroQuery(
    queries.products.categories()
  );
  const [organizationRows, organizationStatus] = useZeroQuery(
    queries.organization.current()
  );
  const [layoutRows, layoutStatus] = useZeroQuery(queries.restaurants.layout());
  const [openOrderRows, openOrderStatus] = useZeroQuery(
    queries.restaurants.openOrders()
  );

  const statuses = [
    activeShiftStatus,
    categoryStatus,
    organizationStatus,
    layoutStatus,
    openOrderStatus,
  ];
  const errors = statuses.map((status) => getZeroQueryError(status));
  const isQueryLoading =
    Boolean(zeroContext) &&
    statuses.some((status) => status.type === "unknown") &&
    layoutRows.length === 0 &&
    !errors.some(Boolean);

  let buildError: Error | null = errors.find(Boolean) ?? null;
  let data: RestaurantBootstrap | null = null;
  if (zeroContext && !buildError) {
    try {
      data = buildRestaurantBootstrap({
        activeShift: (activeShiftRows[0] ?? null) as Parameters<
          typeof buildRestaurantBootstrap
        >[0]["activeShift"],
        categories: categoryRows as RestaurantCategoryRow[],
        organizationMetadata: organizationRows[0]?.metadata,
        areas: layoutRows as RestaurantAreaRow[],
        openOrders: openOrderRows as RestaurantOpenOrderRow[],
      });
    } catch (error) {
      buildError = error instanceof Error ? error : new Error(String(error));
    }
  }

  const hasLoadedRef = useRef(false);
  const staleDataRef = useRef<RestaurantBootstrap | null>(null);
  const isLoading = Boolean(zeroContext) && !buildError && isQueryLoading;

  if (!isLoading && data) {
    staleDataRef.current = data;
    hasLoadedRef.current = true;
  }

  return {
    data: (isLoading ? staleDataRef.current : data) ?? undefined,
    error: buildError,
    isError: Boolean(buildError),
    isPending: isLoading && !hasLoadedRef.current,
    isLoading: isLoading && !hasLoadedRef.current,
    refetch: () => {
      for (const status of statuses) {
        if (status.type === "error") {
          status.retry?.();
        }
      }
      return Promise.resolve();
    },
  };
}

export function useRestaurantTableDetail(tableId: string | null) {
  const pageContext = usePageContext();
  const zeroContext = pageContext.zeroContext;
  const normalizedTableId = tableId?.trim() ?? "";
  const enabled = Boolean(normalizedTableId && zeroContext);
  const [tableRows, tableStatus] = useZeroQuery(
    queries.restaurants.tableById({ tableId: normalizedTableId || null })
  );
  const [openOrderRows, openOrderStatus] = useZeroQuery(
    queries.restaurants.openOrders()
  );
  const [organizationRows, organizationStatus] = useZeroQuery(
    queries.organization.current()
  );

  const statuses = [tableStatus, openOrderStatus, organizationStatus];
  const errors = statuses.map((status) => getZeroQueryError(status));
  const queryError = errors.find(Boolean) ?? null;
  const isQueryLoading =
    enabled &&
    statuses.some((status) => status.type === "unknown") &&
    tableRows.length === 0 &&
    !queryError;

  const tableDetailResult = useMemo(
    () =>
      queryError
        ? { data: null, error: null }
        : buildTableDetailData({
            enabled,
            normalizedTableId,
            openOrderRows: openOrderRows as RestaurantOpenOrderRow[],
            organizationMetadata: organizationRows[0]?.metadata,
            tableRows: tableRows as RestaurantTableRow[],
            tableStatusType: tableStatus.type,
          }),
    [
      enabled,
      normalizedTableId,
      openOrderRows,
      organizationRows,
      queryError,
      tableRows,
      tableStatus.type,
    ]
  );
  const buildError = queryError ?? tableDetailResult.error;
  const data = tableDetailResult.data;

  const hasLoadedRef = useRef(false);
  const staleDataRef = useRef<RestaurantTableDetail | null>(null);
  const isLoading = enabled && !buildError && isQueryLoading;

  if (!isLoading && data) {
    staleDataRef.current = data;
    hasLoadedRef.current = true;
  }

  return {
    data: enabled
      ? ((isLoading ? staleDataRef.current : data) ?? undefined)
      : undefined,
    error: buildError,
    isError: Boolean(buildError),
    isPending: enabled && isLoading && !hasLoadedRef.current,
    isLoading: enabled && isLoading && !hasLoadedRef.current,
    refetch: () => Promise.resolve(),
  };
}

export function useRestaurantConfiguration() {
  const pageContext = usePageContext();
  const zeroContext = pageContext.zeroContext;
  const [layoutRows, layoutStatus] = useZeroQuery(queries.restaurants.layout());
  const [organizationRows, organizationStatus] = useZeroQuery(
    queries.organization.current()
  );

  const statuses = [layoutStatus, organizationStatus];
  const errors = statuses.map((status) => getZeroQueryError(status));
  const isQueryLoading =
    Boolean(zeroContext) &&
    statuses.some((status) => status.type === "unknown") &&
    layoutRows.length === 0 &&
    !errors.some(Boolean);

  let buildError: Error | null = errors.find(Boolean) ?? null;
  let data: RestaurantConfiguration | null = null;

  if (zeroContext && !buildError) {
    try {
      data = buildRestaurantConfiguration(
        layoutRows as RestaurantAreaRow[],
        organizationRows[0]?.metadata
      );
    } catch (error) {
      buildError = error instanceof Error ? error : new Error(String(error));
    }
  }

  const hasLoadedRef = useRef(false);
  const staleDataRef = useRef<RestaurantConfiguration | null>(null);
  const isLoading = Boolean(zeroContext) && !buildError && isQueryLoading;

  if (!isLoading && data) {
    staleDataRef.current = data;
    hasLoadedRef.current = true;
  }

  return {
    data: (isLoading ? staleDataRef.current : data) ?? undefined,
    error: buildError,
    isError: Boolean(buildError),
    isPending: isLoading && !hasLoadedRef.current,
    isLoading: isLoading && !hasLoadedRef.current,
    refetch: () => Promise.resolve(),
  };
}

export function useKitchenBoard() {
  const pageContext = usePageContext();
  const zeroContext = pageContext.zeroContext;
  const [ticketRows, ticketStatus] = useZeroQuery(
    queries.restaurants.kitchenBoard()
  );
  const [organizationRows, organizationStatus] = useZeroQuery(
    queries.organization.current()
  );

  const statuses = [ticketStatus, organizationStatus];
  const errors = statuses.map((status) => getZeroQueryError(status));
  const isQueryLoading =
    Boolean(zeroContext) &&
    statuses.some((status) => status.type === "unknown") &&
    ticketRows.length === 0 &&
    !errors.some(Boolean);

  let buildError: Error | null = errors.find(Boolean) ?? null;
  let data: KitchenBoard | null = null;

  if (zeroContext && !buildError) {
    try {
      data = buildKitchenBoard({
        organizationMetadata: organizationRows[0]?.metadata,
        tickets: ticketRows as RestaurantKitchenTicketRow[],
      });
    } catch (error) {
      buildError = error instanceof Error ? error : new Error(String(error));
    }
  }

  const hasLoadedRef = useRef(false);
  const staleDataRef = useRef<KitchenBoard | null>(null);
  const isLoading = Boolean(zeroContext) && !buildError && isQueryLoading;

  if (!isLoading && data) {
    staleDataRef.current = data;
    hasLoadedRef.current = true;
  }

  return {
    data: (isLoading ? staleDataRef.current : data) ?? undefined,
    error: buildError,
    isError: Boolean(buildError),
    isPending: isLoading && !hasLoadedRef.current,
    isLoading: isLoading && !hasLoadedRef.current,
    refetch: () => Promise.resolve(),
  };
}

export function useAddRestaurantOrderItemMutation() {
  return useZeroMutation(
    async (input: z.infer<typeof AddRestaurantOrderItemInputSchema>, zero) => {
      const itemId = crypto.randomUUID();
      await waitForZeroMutation(
        zero.mutate(mutators.restaurants.addOrderItem({ ...input, itemId })),
        { awaitServer: true }
      );
      return { ...input, itemId };
    }
  );
}

export function useUpdateRestaurantOrderMetaMutation() {
  return useZeroMutation(
    async (
      input: z.infer<typeof UpdateRestaurantOrderMetaInputSchema>,
      zero
    ) => {
      await waitForZeroMutation(
        zero.mutate(mutators.restaurants.updateOrderMeta(input)),
        { awaitServer: true }
      );
      return { success: true as const };
    }
  );
}

export function useUpdateRestaurantOrderItemMutation() {
  return useZeroMutation(
    async (
      input: z.infer<typeof UpdateRestaurantOrderItemInputSchema>,
      zero
    ) => {
      await waitForZeroMutation(
        zero.mutate(mutators.restaurants.updateOrderItem(input)),
        { awaitServer: true }
      );
      return { success: true as const };
    }
  );
}

export function useDeleteRestaurantOrderItemMutation() {
  return useZeroMutation(
    async (
      input: z.infer<typeof DeleteRestaurantOrderItemInputSchema>,
      zero
    ) => {
      await waitForZeroMutation(
        zero.mutate(mutators.restaurants.deleteOrderItem(input)),
        { awaitServer: true }
      );
      return { success: true as const };
    }
  );
}

export function useDiscardPendingKitchenChangesMutation() {
  return useZeroMutation(
    async (
      input: z.infer<typeof DiscardPendingKitchenChangesInputSchema>,
      zero
    ) => {
      await waitForZeroMutation(
        zero.mutate(mutators.restaurants.discardPendingKitchenChanges(input)),
        { awaitServer: true }
      );
      return { success: true as const };
    }
  );
}

export function useSendRestaurantOrderToKitchenMutation() {
  return useZeroMutation(
    async (
      input: z.infer<typeof SendRestaurantOrderToKitchenInputSchema> & {
        ticketId?: string;
      },
      zero
    ) => {
      const ticketId = input.ticketId ?? crypto.randomUUID();
      await waitForZeroMutation(
        zero.mutate(
          mutators.restaurants.sendToKitchen({
            orderId: input.orderId,
            ticketId,
            printTarget: input.printTarget,
          })
        ),
        { awaitServer: true }
      );
      return { ticketId };
    }
  );
}

/**
 * `serverAccepted` **no** significa "gané el claim": el runner del servidor no
 * lanza por contención (otra caja ganó, la orden ya no está abierta, el TTL lo
 * recuperó), así que `true` solo indica que el servidor no rechazó el
 * mutador. La prueba real de propiedad es la fila replicada con nuestro token
 * (`waitForClaimConfirmation`).
 */
export function useClaimKitchenTicketPrintMutation() {
  return useZeroMutation(
    async (input: z.infer<typeof ClaimKitchenTicketPrintInputSchema>, zero) => {
      const result = await zero.mutate(
        mutators.restaurants.claimKitchenTicketPrint(input)
      );
      const clientResult = await result.client;
      if (clientResult.type === "error") {
        throw new Error(clientResult.error.message);
      }

      const serverResult = await result.server;
      if (serverResult.type === "error") {
        // Expected contention/no-op paths (another caja won, printing disabled,
        // no open shift) must not surface a rejection toast.
        return {
          serverAccepted: false as const,
          message: serverResult.error.message,
        };
      }
      return { serverAccepted: true as const };
    }
  );
}

export function useMarkKitchenTicketPrintedMutation() {
  return useZeroMutation(
    async (
      input: z.infer<typeof MarkKitchenTicketPrintedInputSchema>,
      zero
    ) => {
      await waitForZeroMutation(
        zero.mutate(mutators.restaurants.markKitchenTicketPrinted(input)),
        { awaitServer: true }
      );
      return { success: true as const };
    }
  );
}

export function useFailKitchenTicketPrintMutation() {
  return useZeroMutation(
    async (input: z.infer<typeof FailKitchenTicketPrintInputSchema>, zero) => {
      await waitForZeroMutation(
        zero.mutate(mutators.restaurants.failKitchenTicketPrint(input)),
        { awaitServer: true }
      );
      return { success: true as const };
    }
  );
}

export function useRequeueKitchenTicketPrintMutation() {
  return useZeroMutation(
    async (
      input: z.infer<typeof RequeueKitchenTicketPrintInputSchema>,
      zero
    ) => {
      await waitForZeroMutation(
        zero.mutate(mutators.restaurants.requeueKitchenTicketPrint(input)),
        { awaitServer: true }
      );
      return { success: true as const };
    }
  );
}

export function useAcknowledgeKitchenTicketPrintMutation() {
  return useZeroMutation(
    async (
      input: z.infer<typeof AcknowledgeKitchenTicketPrintInputSchema>,
      zero
    ) => {
      await waitForZeroMutation(
        zero.mutate(mutators.restaurants.acknowledgeKitchenTicketPrint(input)),
        { awaitServer: true }
      );
      return { success: true as const };
    }
  );
}

export function useCancelRestaurantOrderMutation() {
  return useZeroMutation(
    async (input: z.infer<typeof CancelRestaurantOrderInputSchema>, zero) => {
      await waitForZeroMutation(
        zero.mutate(mutators.restaurants.cancelOrder(input))
      );
      return { success: true as const };
    }
  );
}

export function useUpdateRestaurantOrderItemStatusMutation() {
  return useZeroMutation(
    async (
      input: z.infer<typeof UpdateRestaurantOrderItemStatusInputSchema>,
      zero
    ) => {
      await waitForZeroMutation(
        zero.mutate(mutators.restaurants.updateItemStatus(input)),
        { awaitServer: true }
      );
      return { success: true as const };
    }
  );
}

export function useCloseRestaurantOrderMutation() {
  return useZeroMutation(
    async (input: z.infer<typeof CloseRestaurantOrderInputSchema>, zero) => {
      const saleId = input.saleId ?? crypto.randomUUID();
      await waitForZeroMutation(
        zero.mutate(mutators.restaurants.closeOrder({ ...input, saleId }))
      );
      return { success: true as const, saleId };
    }
  );
}

export function useCreateRestaurantAreaMutation() {
  return useZeroMutation(
    async (input: z.infer<typeof CreateRestaurantAreaInputSchema>, zero) => {
      await waitForZeroMutation(
        zero.mutate(mutators.restaurants.createArea(input))
      );
    }
  );
}

export function useDeleteRestaurantAreaMutation() {
  return useZeroMutation(
    async (input: z.infer<typeof DeleteRestaurantAreaInputSchema>, zero) => {
      await waitForZeroMutation(
        zero.mutate(mutators.restaurants.deleteArea(input))
      );
    }
  );
}

export function useEnsureDefaultRestaurantAreasMutation() {
  return useZeroMutation(async (_input: undefined, zero) => {
    await waitForZeroMutation(
      zero.mutate(mutators.restaurants.ensureDefaultAreas({}))
    );
  });
}

export function useCreateRestaurantTableMutation() {
  return useZeroMutation(
    async (input: z.infer<typeof CreateRestaurantTableInputSchema>, zero) => {
      await waitForZeroMutation(
        zero.mutate(mutators.restaurants.createTable(input))
      );
    }
  );
}

export function useUpdateRestaurantTableMutation() {
  return useZeroMutation(
    async (input: z.infer<typeof UpdateRestaurantTableInputSchema>, zero) => {
      await waitForZeroMutation(
        zero.mutate(mutators.restaurants.updateTable(input))
      );
    }
  );
}

export function useDeleteRestaurantTableMutation() {
  return useZeroMutation(
    async (input: z.infer<typeof DeleteRestaurantTableInputSchema>, zero) => {
      await waitForZeroMutation(
        zero.mutate(mutators.restaurants.deleteTable(input))
      );
    }
  );
}

export function usePendingKitchenPrints() {
  const pageContext = usePageContext();
  const zeroContext = pageContext.zeroContext;
  const [ticketRows, ticketStatus] = useZeroQuery(
    queries.restaurants.pendingPrints()
  );
  const error = getZeroQueryError(ticketStatus);

  return {
    data: ticketRows as RestaurantKitchenTicketRow[],
    error,
    isError: Boolean(error),
    isLoading:
      Boolean(zeroContext) &&
      ticketStatus.type === "unknown" &&
      ticketRows.length === 0,
    refetch: () => {
      if (ticketStatus.type === "error") {
        ticketStatus.retry?.();
      }
      return Promise.resolve();
    },
  };
}

export function useSalonKitchenTickets(from: number) {
  const pageContext = usePageContext();
  const zeroContext = pageContext.zeroContext;
  const [ticketRows, ticketStatus] = useZeroQuery(
    queries.restaurants.salonTickets({ from })
  );
  const error = getZeroQueryError(ticketStatus);

  return {
    data: ticketRows as RestaurantKitchenTicketRow[],
    error,
    isError: Boolean(error),
    isLoading:
      Boolean(zeroContext) &&
      ticketStatus.type === "unknown" &&
      ticketRows.length === 0,
    refetch: () => {
      if (ticketStatus.type === "error") {
        ticketStatus.retry?.();
      }
      return Promise.resolve();
    },
  };
}
