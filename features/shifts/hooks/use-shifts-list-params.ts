import { useMemo } from "react";
import type { ShiftListCursor } from "@/features/shifts/shifts.shared";
import {
  resolveDifferenceStatus,
  resolveHasMovements,
  resolveShiftStatus,
} from "@/features/shifts/shifts-formatters.shared";

export function useShiftsListParams({
  cashierId,
  cursor,
  deferredSearchQuery,
  differenceStatus,
  endDate,
  hasMovements,
  pageSize,
  paymentMethod,
  startDate,
  status,
  terminalName,
}: {
  cashierId: string;
  cursor: ShiftListCursor | null;
  deferredSearchQuery: string;
  differenceStatus: string;
  endDate: string;
  hasMovements: string;
  pageSize: number;
  paymentMethod: string;
  startDate: string;
  status: string;
  terminalName: string;
}) {
  return useMemo(
    () => ({
      limit: pageSize,
      cursor,
      searchQuery: deferredSearchQuery.trim() || null,
      status: resolveShiftStatus(status),
      cashierId: cashierId || null,
      terminalName: terminalName || null,
      paymentMethod: paymentMethod || null,
      differenceStatus: resolveDifferenceStatus(differenceStatus),
      hasMovements: resolveHasMovements(hasMovements),
      startDate: startDate || null,
      endDate: endDate || null,
    }),
    [
      pageSize,
      cursor,
      deferredSearchQuery,
      status,
      cashierId,
      terminalName,
      paymentMethod,
      differenceStatus,
      hasMovements,
      startDate,
      endDate,
    ]
  );
}
