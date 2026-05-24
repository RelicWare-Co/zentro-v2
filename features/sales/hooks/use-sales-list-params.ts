import { useMemo } from "react";
import type { SaleListCursor } from "@/features/sales/sales.shared";
import {
  resolveAmountRange,
  resolveBalanceStatus,
  resolveSaleStatus,
  resolveSalesDateFilters,
} from "@/features/sales/sales-formatters.shared";
import type { SalesView } from "@/features/sales/sales-page.constants.shared";

export function useSalesListParams({
  activeView,
  amountMax,
  amountMin,
  balanceStatus,
  cashierId,
  cursor,
  deferredSearchQuery,
  endDate,
  pageSize,
  paymentMethod,
  startDate,
  status,
  terminalName,
  todayDate,
}: {
  activeView: SalesView;
  amountMax: string;
  amountMin: string;
  balanceStatus: string;
  cashierId: string;
  cursor: SaleListCursor | null;
  deferredSearchQuery: string;
  endDate: string;
  pageSize: number;
  paymentMethod: string;
  startDate: string;
  status: string;
  terminalName: string;
  todayDate: string;
}) {
  return useMemo(() => {
    const resolvedDateFilters = resolveSalesDateFilters(
      activeView,
      todayDate,
      startDate,
      endDate
    );
    const { min: finalMin, max: finalMax } = resolveAmountRange(
      amountMin,
      amountMax
    );

    return {
      limit: pageSize,
      cursor,
      searchQuery: deferredSearchQuery.trim() || null,
      status: resolveSaleStatus(status),
      paymentMethod: paymentMethod || null,
      cashierId: cashierId || null,
      terminalName: terminalName || null,
      balanceStatus: resolveBalanceStatus(balanceStatus),
      amountMin: finalMin,
      amountMax: finalMax,
      startDate: resolvedDateFilters.startDate,
      endDate: resolvedDateFilters.endDate,
    };
  }, [
    activeView,
    amountMax,
    amountMin,
    balanceStatus,
    cashierId,
    cursor,
    deferredSearchQuery,
    endDate,
    pageSize,
    paymentMethod,
    startDate,
    status,
    terminalName,
    todayDate,
  ]);
}
