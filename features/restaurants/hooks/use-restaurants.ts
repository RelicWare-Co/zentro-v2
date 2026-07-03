import { useQuery as useZeroQuery } from "@rocicorp/zero/react";
import { useRef } from "react";
import { usePageContext } from "vike-react/usePageContext";
import type { z } from "zod";
import type {
  AddRestaurantOrderItemInputSchema,
  CancelRestaurantOrderInputSchema,
  CloseRestaurantOrderInputSchema,
  CreateRestaurantAreaInputSchema,
  CreateRestaurantTableInputSchema,
  DeleteRestaurantAreaInputSchema,
  DeleteRestaurantDraftItemInputSchema,
  DeleteRestaurantTableInputSchema,
  SendRestaurantOrderToKitchenInputSchema,
  UpdateRestaurantDraftItemInputSchema,
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
  const isQueryLoading =
    enabled &&
    statuses.some((status) => status.type === "unknown") &&
    tableRows.length === 0 &&
    !errors.some(Boolean);

  let buildError: Error | null = errors.find(Boolean) ?? null;
  let data: RestaurantTableDetail | null = null;

  if (!buildError) {
    const result = buildTableDetailData({
      enabled,
      normalizedTableId,
      openOrderRows: openOrderRows as RestaurantOpenOrderRow[],
      organizationMetadata: organizationRows[0]?.metadata,
      tableRows: tableRows as RestaurantTableRow[],
      tableStatusType: tableStatus.type,
    });
    buildError = result.error;
    data = result.data;
  }

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
        zero.mutate(mutators.restaurants.addOrderItem({ ...input, itemId }))
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
        zero.mutate(mutators.restaurants.updateOrderMeta(input))
      );
      return { success: true as const };
    }
  );
}

export function useUpdateRestaurantDraftItemMutation() {
  return useZeroMutation(
    async (
      input: z.infer<typeof UpdateRestaurantDraftItemInputSchema>,
      zero
    ) => {
      await waitForZeroMutation(
        zero.mutate(mutators.restaurants.updateDraftItem(input))
      );
      return { success: true as const };
    }
  );
}

export function useDeleteRestaurantDraftItemMutation() {
  return useZeroMutation(
    async (
      input: z.infer<typeof DeleteRestaurantDraftItemInputSchema>,
      zero
    ) => {
      await waitForZeroMutation(
        zero.mutate(mutators.restaurants.deleteDraftItem(input))
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
          })
        )
      );
      return { ticketId };
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
        zero.mutate(mutators.restaurants.updateItemStatus(input))
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
