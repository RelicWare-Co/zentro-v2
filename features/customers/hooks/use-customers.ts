import { useQuery as useZeroQuery } from "@rocicorp/zero/react";
import { useDeferredValue, useRef } from "react";
import type { z } from "zod";
import {
  getZeroQueryError,
  useZeroMutation,
  waitForZeroMutation,
} from "@/lib/use-zero-mutation";
import type {
  CreateCustomerSchema,
  CustomerSchema,
  DeleteCustomerSchema,
  UpdateCustomerSchema,
} from "@/schemas/customers";
import { mutators } from "@/src/zero/mutators";
import { queries } from "@/src/zero/queries";
import type { Customer as ZeroCustomer } from "@/src/zero/schema";

export type Customer = z.infer<typeof CustomerSchema>;
export type CreateCustomerInput = z.infer<typeof CreateCustomerSchema>;
export type UpdateCustomerInput = z.infer<typeof UpdateCustomerSchema>;
export type DeleteCustomerInput = z.infer<typeof DeleteCustomerSchema>;

function normalizeCustomer(customer: ZeroCustomer): Customer {
  return {
    ...customer,
    type: customer.type ?? "natural",
    updatedAt: customer.updatedAt ?? customer.createdAt,
  };
}

export function useCustomersSearch(searchQuery: string, limit = 50) {
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const [customers, status] = useZeroQuery(
    queries.customers.search({
      limit,
      searchQuery: deferredSearchQuery.trim() || null,
    })
  );
  const error = getZeroQueryError(status);
  const normalizedCustomers = customers.map(normalizeCustomer);

  const hasLoadedRef = useRef(false);
  const staleDataRef = useRef<Customer[]>([]);

  const isQueryLoading =
    status.type === "unknown" && normalizedCustomers.length === 0;

  if (!isQueryLoading) {
    staleDataRef.current = normalizedCustomers;
    hasLoadedRef.current = true;
  }

  const displayCustomers = isQueryLoading
    ? staleDataRef.current
    : normalizedCustomers;

  return {
    data: {
      data: displayCustomers,
      hasMore: false,
      nextCursor: null,
      total: displayCustomers.length,
    },
    error,
    isError: Boolean(error),
    isPending: isQueryLoading && !hasLoadedRef.current,
    isSearching: isQueryLoading && hasLoadedRef.current,
    refetch: () => {
      if (status.type === "error") {
        status.retry();
      }
      return Promise.resolve();
    },
  };
}

export function useCreateCustomerMutation() {
  return useZeroMutation(async (input: CreateCustomerInput, zero) => {
    const id = crypto.randomUUID();
    await waitForZeroMutation(
      zero.mutate(
        mutators.customers.create({
          ...input,
          id,
        })
      )
    );
    return { id };
  });
}

export function useUpdateCustomerMutation() {
  return useZeroMutation(async (input: UpdateCustomerInput, zero) => {
    await waitForZeroMutation(zero.mutate(mutators.customers.update(input)));
    return { success: true };
  });
}

export function useDeleteCustomerMutation() {
  return useZeroMutation(async (input: DeleteCustomerInput, zero) => {
    await waitForZeroMutation(zero.mutate(mutators.customers.delete(input)));
    return { success: true };
  });
}
