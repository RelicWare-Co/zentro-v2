import { useZero, useQuery as useZeroQuery } from "@rocicorp/zero/react";
import { useMutation } from "@tanstack/react-query";
import { useDeferredValue, useMemo, useRef } from "react";
import type { z } from "zod";
import type {
  SaleDetail,
  SaleListItem,
  SalesListParams,
  SaleWithRelations,
} from "@/features/sales/sales.shared";
import {
  buildSaleDetail,
  buildSaleFilterOptions,
  buildSaleListItem,
  filterSales,
  paginateSales,
} from "@/features/sales/sales.shared";
import type {
  CreateSaleInputSchema,
  CreateSaleResultSchema,
} from "@/schemas/sales";
import { mutators } from "@/src/zero/mutators";
import { queries } from "@/src/zero/queries";

export type { SalesListParams } from "@/features/sales/sales.shared";
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

function getQueryError(status: { type: string; error?: { message?: string } }) {
  return status.type === "error"
    ? new Error(status.error?.message ?? "No se pudo cargar la consulta Zero")
    : null;
}

export function useSalesList(params: SalesListParams = {}) {
  const deferredParams = useDeferredValue(params);
  const [saleRows, saleStatus] = useZeroQuery(queries.sales.byOrg());
  const [organizationRows, organizationStatus] = useZeroQuery(
    queries.shifts.organization()
  );
  const error = getQueryError(saleStatus) ?? getQueryError(organizationStatus);
  const filteredRows = useMemo(
    () => filterSales(saleRows as SaleWithRelations[], deferredParams),
    [deferredParams, saleRows]
  );
  const filteredSales = useMemo(
    () => filteredRows.map((row) => buildSaleListItem(row)),
    [filteredRows]
  );
  const paginated = useMemo(
    () => paginateSales(filteredSales, deferredParams),
    [deferredParams, filteredSales]
  );
  const filterOptions = useMemo(
    () =>
      buildSaleFilterOptions(
        saleRows as SaleWithRelations[],
        typeof organizationRows[0]?.metadata === "string"
          ? organizationRows[0]?.metadata
          : null
      ),
    [organizationRows, saleRows]
  );

  const hasLoadedRef = useRef(false);
  const staleDataRef = useRef<{
    data: SaleListItem[];
    total: number;
    hasMore: boolean;
    nextCursor: number | null;
    filterOptions: ReturnType<typeof buildSaleFilterOptions>;
  }>({
    data: [],
    total: 0,
    hasMore: false,
    nextCursor: null,
    filterOptions: {
      cashiers: [],
      terminals: [],
      paymentMethods: [],
    },
  });

  const isQueryLoading =
    (saleStatus.type === "unknown" || organizationStatus.type === "unknown") &&
    saleRows.length === 0;

  const nextData = {
    ...paginated,
    filterOptions,
  };

  if (!isQueryLoading) {
    staleDataRef.current = nextData;
    hasLoadedRef.current = true;
  }

  const displayData = isQueryLoading ? staleDataRef.current : nextData;

  return {
    data: displayData,
    error,
    isError: Boolean(error),
    isLoading: isQueryLoading && !hasLoadedRef.current,
    isPlaceholderData:
      deferredParams !== params || (isQueryLoading && hasLoadedRef.current),
    isFetching:
      deferredParams !== params || (isQueryLoading && hasLoadedRef.current),
    refetch: () => {
      if (saleStatus.type === "error") {
        saleStatus.retry();
      }
      if (organizationStatus.type === "error") {
        organizationStatus.retry();
      }
      return Promise.resolve();
    },
  };
}

function asSaleWithRelations(row: unknown) {
  return row as SaleWithRelations;
}

export function useSaleDetail(saleId: string | null) {
  const [rows, status] = useZeroQuery(
    queries.sales.byId({ saleId: saleId ?? null })
  );
  const error = getQueryError(status);
  const saleRow = rows[0];
  const data = useMemo((): SaleDetail | null => {
    if (!saleRow) {
      return null;
    }
    return buildSaleDetail(asSaleWithRelations(saleRow));
  }, [saleRow]);

  return {
    data,
    error,
    isError: Boolean(error),
    isLoading:
      Boolean(saleId) && status.type === "unknown" && rows.length === 0,
    refetch: () => {
      if (status.type === "error") {
        status.retry();
      }
      return Promise.resolve();
    },
  };
}

export function useCancelSaleMutation() {
  const zero = useZero();

  return useMutation({
    mutationFn: async (input: { saleId: string; cancelledAt?: number }) => {
      await waitForZeroMutation(zero.mutate(mutators.sales.cancel(input)));
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
