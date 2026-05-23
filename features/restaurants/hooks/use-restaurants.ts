import { useQuery as useZeroQuery } from "@rocicorp/zero/react";
import { useMutation } from "@tanstack/react-query";
import { useRef } from "react";
import { usePageContext } from "vike-react/usePageContext";
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
import { orpcQuery } from "@/server/orpc/client/query";
import { queries } from "@/src/zero/queries";

export type { RestaurantConfiguration } from "@/features/restaurants/restaurants.shared";

interface ZeroQueryStatus {
  error?: { message?: string };
  retry?: () => void;
  type: string;
}

function getQueryError(status: ZeroQueryStatus) {
  return status.type === "error"
    ? new Error(status.error?.message ?? "No se pudo cargar la consulta Zero")
    : null;
}

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
    queries.shifts.organization()
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
  const errors = statuses.map((status) => getQueryError(status));
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
    queries.shifts.organization()
  );

  const statuses = [tableStatus, openOrderStatus, organizationStatus];
  const errors = statuses.map((status) => getQueryError(status));
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
    queries.shifts.organization()
  );

  const statuses = [layoutStatus, organizationStatus];
  const errors = statuses.map((status) => getQueryError(status));
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
    queries.shifts.organization()
  );

  const statuses = [ticketStatus, organizationStatus];
  const errors = statuses.map((status) => getQueryError(status));
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
  return useMutation(orpcQuery.restaurants.addOrderItem.mutationOptions());
}

export function useUpdateRestaurantOrderMetaMutation() {
  return useMutation(orpcQuery.restaurants.updateOrderMeta.mutationOptions());
}

export function useUpdateRestaurantDraftItemMutation() {
  return useMutation(orpcQuery.restaurants.updateDraftItem.mutationOptions());
}

export function useDeleteRestaurantDraftItemMutation() {
  return useMutation(orpcQuery.restaurants.deleteDraftItem.mutationOptions());
}

export function useSendRestaurantOrderToKitchenMutation() {
  return useMutation(orpcQuery.restaurants.sendToKitchen.mutationOptions());
}

export function useUpdateRestaurantOrderItemStatusMutation() {
  return useMutation(orpcQuery.restaurants.updateItemStatus.mutationOptions());
}

export function useCloseRestaurantOrderMutation() {
  return useMutation(orpcQuery.restaurants.closeOrder.mutationOptions());
}

export function useCreateRestaurantAreaMutation() {
  return useMutation(orpcQuery.restaurants.createArea.mutationOptions());
}

export function useDeleteRestaurantAreaMutation() {
  return useMutation(orpcQuery.restaurants.deleteArea.mutationOptions());
}

export function useCreateRestaurantTableMutation() {
  return useMutation(orpcQuery.restaurants.createTable.mutationOptions());
}

export function useUpdateRestaurantTableMutation() {
  return useMutation(orpcQuery.restaurants.updateTable.mutationOptions());
}

export function useDeleteRestaurantTableMutation() {
  return useMutation(orpcQuery.restaurants.deleteTable.mutationOptions());
}
