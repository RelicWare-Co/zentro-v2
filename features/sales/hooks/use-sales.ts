import { useQuery as useZeroQuery } from "@rocicorp/zero/react";
import { useDeferredValue, useMemo, useRef } from "react";
import type { z } from "zod";
import type {
  CreateSaleInputSchema,
  CreateSaleResultSchema,
} from "@/features/sales/sales.schema";
import type {
  SaleDetail,
  SaleListItem,
  SalesListParams,
  SaleWithRelations,
} from "@/features/sales/sales.shared";
import {
  buildSaleDetail,
  buildSaleFilterOptions,
  buildSalesListPage,
  filterSalesByBalanceStatus,
  normalizeSalesListLimit,
} from "@/features/sales/sales.shared";
import {
  getZeroQueryError,
  useZeroMutation,
  waitForZeroMutation,
  waitForZeroServerMutation,
} from "@/lib/use-zero-mutation";
import { mutators } from "@/zero/mutators";
import { queries } from "@/zero/queries";

export type { SalesListParams } from "@/features/sales/sales.shared";
export type CreateSaleInput = z.infer<typeof CreateSaleInputSchema>;
export type CreateSaleResult = z.infer<typeof CreateSaleResultSchema>;

export type CreateSaleMutationInput = CreateSaleInput & {
  receiptTotals: Pick<
    CreateSaleResult,
    "subtotal" | "taxAmount" | "discountAmount" | "totalAmount"
  >;
};

function buildSalesListQueryArgs(params: SalesListParams) {
  return {
    limit: normalizeSalesListLimit(params.limit),
    cursor: params.cursor ?? null,
    status: params.status ?? null,
    searchQuery: params.searchQuery ?? null,
    paymentMethod: params.paymentMethod ?? null,
    cashierId: params.cashierId ?? null,
    terminalName: params.terminalName ?? null,
    amountMin: params.amountMin ?? null,
    amountMax: params.amountMax ?? null,
    startDate: params.startDate ?? null,
    endDate: params.endDate ?? null,
  };
}

export function useSalesList(params: SalesListParams = {}) {
  const deferredParams = useDeferredValue(params);
  const listQueryArgs = useMemo(
    () => buildSalesListQueryArgs(deferredParams),
    [deferredParams]
  );
  const [saleRows, saleStatus] = useZeroQuery(
    queries.sales.list(listQueryArgs)
  );
  const [organizationRows, organizationStatus] = useZeroQuery(
    queries.organization.current()
  );
  const [memberRows, memberStatus] = useZeroQuery(
    queries.sales.filterOptions()
  );
  const [shiftRows, shiftStatus] = useZeroQuery(
    queries.sales.terminalOptions()
  );
  const error =
    getZeroQueryError(saleStatus) ??
    getZeroQueryError(organizationStatus) ??
    getZeroQueryError(memberStatus) ??
    getZeroQueryError(shiftStatus);

  const filteredRows = useMemo(
    () =>
      filterSalesByBalanceStatus(
        saleRows as SaleWithRelations[],
        deferredParams.balanceStatus
      ),
    [deferredParams.balanceStatus, saleRows]
  );

  const paginated = useMemo(
    () => buildSalesListPage(filteredRows, listQueryArgs.limit),
    [filteredRows, listQueryArgs.limit]
  );

  const filterOptions = useMemo(
    () =>
      buildSaleFilterOptions({
        members: memberRows.map((memberRow) => ({
          userId: memberRow.userId,
          user: (
            memberRow as {
              user?: { name?: string | null } | null;
            }
          ).user,
        })),
        organizationMetadata:
          typeof organizationRows[0]?.metadata === "string"
            ? organizationRows[0]?.metadata
            : null,
        terminalNames: shiftRows
          .map((shiftRow) => shiftRow.terminalName)
          .filter((terminalName): terminalName is string =>
            Boolean(terminalName)
          ),
      }),
    [memberRows, organizationRows, shiftRows]
  );

  const hasLoadedRef = useRef(false);
  const staleDataRef = useRef<{
    data: SaleListItem[];
    total: number | null;
    hasMore: boolean;
    nextCursor: (typeof paginated)["nextCursor"];
    filterOptions: ReturnType<typeof buildSaleFilterOptions>;
  }>({
    data: [],
    total: null,
    hasMore: false,
    nextCursor: null,
    filterOptions: {
      cashiers: [],
      terminals: [],
      paymentMethods: [],
    },
  });

  const isQueryLoading =
    (saleStatus.type === "unknown" ||
      organizationStatus.type === "unknown" ||
      memberStatus.type === "unknown" ||
      shiftStatus.type === "unknown") &&
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
      if (memberStatus.type === "error") {
        memberStatus.retry();
      }
      if (shiftStatus.type === "error") {
        shiftStatus.retry();
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
  const error = getZeroQueryError(status);
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
  return useZeroMutation(
    async (input: { saleId: string; cancelledAt?: number }, zero) => {
      await waitForZeroMutation(zero.mutate(mutators.sales.cancel(input)), {
        awaitServer: true,
      });
    }
  );
}

export function useCreateSaleMutation() {
  return useZeroMutation(async (input: CreateSaleMutationInput, zero) => {
    const { receiptTotals, ...saleInput } = input;
    const saleId = crypto.randomUUID();

    await waitForZeroServerMutation(
      zero.mutate(
        mutators.sales.create({
          ...saleInput,
          saleId,
        })
      ),
      { awaitServer: true }
    );

    const tenderedAmount = (saleInput.payments ?? []).reduce(
      (sum, payment) => sum + payment.amount,
      0
    );
    const paidAmount = Math.min(receiptTotals.totalAmount, tenderedAmount);
    const isCreditSale = saleInput.isCreditSale ?? false;
    const status = isCreditSale ? "credit" : "completed";

    return {
      saleId,
      status,
      ...receiptTotals,
      paidAmount,
      balanceDue: Math.max(receiptTotals.totalAmount - paidAmount, 0),
    };
  });
}
