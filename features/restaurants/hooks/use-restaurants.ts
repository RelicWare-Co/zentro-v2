import {
  type QueryClient,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import type { z } from "zod";
import type { RestaurantConfigurationSchema } from "@/schemas/restaurants";
import { orpcQuery } from "@/server/orpc/client/query";

export type RestaurantConfiguration = z.infer<
  typeof RestaurantConfigurationSchema
>;

async function invalidateRestaurantQueries(queryClient: QueryClient) {
  await Promise.all([
    queryClient.invalidateQueries({
      queryKey: orpcQuery.restaurants.bootstrap.queryOptions().queryKey,
    }),
    queryClient.invalidateQueries({
      queryKey: orpcQuery.restaurants.configuration.queryOptions().queryKey,
    }),
    queryClient.invalidateQueries({
      predicate: (query) => {
        const scope = query.queryKey[0];
        return (
          Array.isArray(scope) &&
          scope[0] === "orpc" &&
          scope[1] === "restaurants" &&
          scope[2] === "tableDetail"
        );
      },
    }),
    queryClient.invalidateQueries({
      queryKey: orpcQuery.restaurants.kitchenBoard.queryOptions().queryKey,
    }),
    queryClient.invalidateQueries({
      queryKey: orpcQuery.settings.get.queryOptions().queryKey,
    }),
  ]);
}

export function useRestaurantBootstrap() {
  return useQuery({
    ...orpcQuery.restaurants.bootstrap.queryOptions(),
  });
}

export function useRestaurantTableDetail(tableId: string | null) {
  return useQuery({
    ...orpcQuery.restaurants.tableDetail.queryOptions({
      input: { tableId: tableId ?? "" },
    }),
    enabled: Boolean(tableId),
  });
}

export function useRestaurantConfiguration() {
  return useQuery({
    ...orpcQuery.restaurants.configuration.queryOptions(),
  });
}

export function useKitchenBoard() {
  return useQuery({
    ...orpcQuery.restaurants.kitchenBoard.queryOptions(),
  });
}

export function useAddRestaurantOrderItemMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    ...orpcQuery.restaurants.addOrderItem.mutationOptions(),
    onSuccess: async () => {
      await invalidateRestaurantQueries(queryClient);
    },
  });
}

export function useUpdateRestaurantOrderMetaMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    ...orpcQuery.restaurants.updateOrderMeta.mutationOptions(),
    onSuccess: async () => {
      await invalidateRestaurantQueries(queryClient);
    },
  });
}

export function useUpdateRestaurantDraftItemMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    ...orpcQuery.restaurants.updateDraftItem.mutationOptions(),
    onSuccess: async () => {
      await invalidateRestaurantQueries(queryClient);
    },
  });
}

export function useDeleteRestaurantDraftItemMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    ...orpcQuery.restaurants.deleteDraftItem.mutationOptions(),
    onSuccess: async () => {
      await invalidateRestaurantQueries(queryClient);
    },
  });
}

export function useSendRestaurantOrderToKitchenMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    ...orpcQuery.restaurants.sendToKitchen.mutationOptions(),
    onSuccess: async () => {
      await invalidateRestaurantQueries(queryClient);
    },
  });
}

export function useUpdateRestaurantOrderItemStatusMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    ...orpcQuery.restaurants.updateItemStatus.mutationOptions(),
    onSuccess: async () => {
      await invalidateRestaurantQueries(queryClient);
    },
  });
}

export function useCloseRestaurantOrderMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    ...orpcQuery.restaurants.closeOrder.mutationOptions(),
    onSuccess: async () => {
      await Promise.all([
        invalidateRestaurantQueries(queryClient),
        queryClient.invalidateQueries({
          queryKey: orpcQuery.sales.list.queryOptions({ input: {} }).queryKey,
        }),
        queryClient.invalidateQueries({
          queryKey: orpcQuery.pos.bootstrap.queryOptions().queryKey,
        }),
        queryClient.invalidateQueries({
          queryKey: orpcQuery.shifts.closeSummary.queryOptions({
            input: { shiftId: "" },
          }).queryKey,
        }),
      ]);
    },
  });
}

export function useCreateRestaurantAreaMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    ...orpcQuery.restaurants.createArea.mutationOptions(),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: orpcQuery.restaurants.configuration.queryOptions().queryKey,
      });
    },
  });
}

export function useDeleteRestaurantAreaMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    ...orpcQuery.restaurants.deleteArea.mutationOptions(),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: orpcQuery.restaurants.configuration.queryOptions().queryKey,
      });
    },
  });
}

export function useCreateRestaurantTableMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    ...orpcQuery.restaurants.createTable.mutationOptions(),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: orpcQuery.restaurants.configuration.queryOptions().queryKey,
      });
    },
  });
}

export function useUpdateRestaurantTableMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    ...orpcQuery.restaurants.updateTable.mutationOptions(),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: orpcQuery.restaurants.configuration.queryOptions().queryKey,
      });
    },
  });
}

export function useDeleteRestaurantTableMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    ...orpcQuery.restaurants.deleteTable.mutationOptions(),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: orpcQuery.restaurants.configuration.queryOptions().queryKey,
      });
    },
  });
}
