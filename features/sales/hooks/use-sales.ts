import { useZero } from "@rocicorp/zero/react";
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import type { z } from "zod";
import type {
  CreateSaleInputSchema,
  CreateSaleResultSchema,
  ListSalesInputSchema,
} from "@/schemas/sales";
import { orpcQuery } from "@/server/orpc/client/query";
import { mutators } from "@/src/zero/mutators";

export type SalesListParams = z.infer<typeof ListSalesInputSchema>;
export type CreateSaleInput = z.infer<typeof CreateSaleInputSchema>;
export type CreateSaleResult = z.infer<typeof CreateSaleResultSchema>;

export type CreateSaleMutationInput = CreateSaleInput & {
  receiptTotals: Pick<
    CreateSaleResult,
    "subtotal" | "taxAmount" | "discountAmount" | "totalAmount"
  >;
};

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

export function useSalesList(params: SalesListParams = {}) {
  return useQuery({
    ...orpcQuery.sales.list.queryOptions({ input: params }),
    staleTime: 30_000,
    gcTime: 5 * 60_000,
    refetchOnWindowFocus: false,
    placeholderData: keepPreviousData,
  });
}

export function useSaleDetail(saleId: string | null) {
  return useQuery({
    ...orpcQuery.sales.detail.queryOptions(
      saleId ? { input: { saleId } } : { input: { saleId: "" } }
    ),
    enabled: Boolean(saleId),
  });
}

export function useCancelSaleMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    ...orpcQuery.sales.cancel.mutationOptions(),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: orpcQuery.sales.list.queryOptions({ input: {} }).queryKey,
      });
      await queryClient.invalidateQueries({
        queryKey: orpcQuery.sales.detail.queryOptions({
          input: { saleId: "" },
        }).queryKey,
      });
    },
  });
}

export function useCreateSaleMutation() {
  const zero = useZero();

  return useMutation({
    mutationFn: async (input: CreateSaleMutationInput) => {
      const { receiptTotals, ...saleInput } = input;
      const saleId = crypto.randomUUID();

      await waitForZeroMutation(
        zero.mutate(
          mutators.sales.create({
            ...saleInput,
            saleId,
          })
        )
      );

      const paidAmount = (saleInput.payments ?? []).reduce(
        (sum, payment) => sum + payment.amount,
        0
      );
      const isCreditSale = saleInput.isCreditSale ?? false;
      const status = isCreditSale ? "credit" : "completed";

      return {
        saleId,
        status,
        ...receiptTotals,
        paidAmount,
        balanceDue: Math.max(receiptTotals.totalAmount - paidAmount, 0),
      };
    },
  });
}
