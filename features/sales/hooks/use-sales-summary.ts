import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import type { z } from "zod";
import {
  type SalesSummaryQueryArgsSchema,
  SalesSummaryResultSchema,
} from "@/features/sales/sales.schema";
import type { SalesListParams } from "@/features/sales/sales.shared";

type SalesSummaryInput = z.infer<typeof SalesSummaryQueryArgsSchema>;

function buildSalesSummaryInput(params: SalesListParams): SalesSummaryInput {
  return {
    amountMax: params.amountMax ?? null,
    amountMin: params.amountMin ?? null,
    balanceStatus: params.balanceStatus ?? null,
    cashierId: params.cashierId ?? null,
    endDate: params.endDate ?? null,
    paymentMethod: params.paymentMethod ?? null,
    searchQuery: params.searchQuery ?? null,
    shiftIds: params.shiftIds ?? null,
    startDate: params.startDate ?? null,
    status: params.status ?? null,
    terminalName: params.terminalName ?? null,
  };
}

async function fetchSalesSummary(input: SalesSummaryInput) {
  const response = await fetch("/api/sales/summary", {
    body: JSON.stringify(input),
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    method: "POST",
  });

  if (!response.ok) {
    let message = "No se pudo cargar el resumen de ventas";
    try {
      const body = (await response.json()) as { message?: string };
      if (body.message) {
        message = body.message;
      }
    } catch {
      // Ignore malformed error responses and use the default message.
    }
    throw new Error(message);
  }

  return SalesSummaryResultSchema.parse(await response.json());
}

export function useSalesSummary(params: SalesListParams) {
  const input = useMemo(() => buildSalesSummaryInput(params), [params]);

  return useQuery({
    queryKey: ["sales", "summary", input],
    queryFn: () => fetchSalesSummary(input),
    placeholderData: keepPreviousData,
    refetchInterval: input.shiftIds === null ? false : 30_000,
  });
}
