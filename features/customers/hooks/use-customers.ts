import { useZero, useQuery as useZeroQuery } from "@rocicorp/zero/react";
import { useMutation } from "@tanstack/react-query";
import { useDeferredValue } from "react";
import type { z } from "zod";
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

type ZeroMutationDetails =
  | { readonly type: "success" }
  | {
      readonly error: { readonly message: string };
      readonly type: "error";
    };

interface ZeroMutationResult {
  readonly client: Promise<ZeroMutationDetails>;
  readonly server: Promise<ZeroMutationDetails>;
}

function toError(details: Extract<ZeroMutationDetails, { type: "error" }>) {
  return new Error(details.error.message || "La mutación de Zero falló");
}

async function waitForZeroMutation(result: ZeroMutationResult) {
  const clientResult = await result.client;
  if (clientResult.type === "error") {
    throw toError(clientResult);
  }

  const serverResult = await result.server;
  if (serverResult.type === "error") {
    throw toError(serverResult);
  }
}

function getQueryError(status: { type: string; error?: { message?: string } }) {
  return status.type === "error"
    ? new Error(status.error?.message ?? "No se pudo cargar la consulta Zero")
    : null;
}

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
  const error = getQueryError(status);
  const normalizedCustomers = customers.map(normalizeCustomer);

  return {
    data: {
      data: normalizedCustomers,
      hasMore: false,
      nextCursor: null,
      total: normalizedCustomers.length,
    },
    error,
    isError: Boolean(error),
    isPending: status.type === "unknown" && normalizedCustomers.length === 0,
    refetch: () => {
      if (status.type === "error") {
        status.retry();
      }
      return Promise.resolve();
    },
  };
}

export function useCreateCustomerMutation() {
  const zero = useZero();

  return useMutation({
    mutationFn: async (input: CreateCustomerInput) => {
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
    },
  });
}

export function useUpdateCustomerMutation() {
  const zero = useZero();

  return useMutation({
    mutationFn: async (input: UpdateCustomerInput) => {
      await waitForZeroMutation(zero.mutate(mutators.customers.update(input)));
      return { success: true };
    },
  });
}

export function useDeleteCustomerMutation() {
  const zero = useZero();

  return useMutation({
    mutationFn: async (input: DeleteCustomerInput) => {
      await waitForZeroMutation(zero.mutate(mutators.customers.delete(input)));
      return { success: true };
    },
  });
}
