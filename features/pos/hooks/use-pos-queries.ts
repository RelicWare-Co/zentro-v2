import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  useCustomersSearch,
  useCreateCustomerMutation as useZeroCreateCustomerMutation,
} from "@/features/customers/hooks/use-customers";
import { orpcQuery } from "@/server/orpc/client/query";

export function usePosCustomers() {
  return useCustomersSearch("", 100);
}

export function useCreatePosSaleMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    ...orpcQuery.sales.create.mutationOptions(),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: orpcQuery.sales.list.queryOptions({ input: {} }).queryKey,
        }),
        queryClient.invalidateQueries({
          queryKey: orpcQuery.sales.detail.queryOptions({
            input: { saleId: "" },
          }).queryKey,
        }),
      ]);
    },
  });
}

export function useCreateCustomerMutation() {
  return useZeroCreateCustomerMutation();
}
