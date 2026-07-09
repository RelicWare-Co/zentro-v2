import type { z } from "zod";
import type {
  CloseShiftInputSchema,
  ShiftCloseSummaryResultSchema,
} from "@/features/pos/pos.schema";
import type {
  ListShiftsInputSchema,
  ShiftDetailSchema,
  ShiftListCursorSchema,
} from "@/features/shifts/shifts.schema";

export type ShiftListItem = z.infer<typeof ShiftDetailSchema>;
export type ShiftCloseSummary = z.infer<typeof ShiftCloseSummaryResultSchema>;
export type ShiftsListParams = z.infer<typeof ListShiftsInputSchema>;
export type ShiftListCursor = z.infer<typeof ShiftListCursorSchema>;
export type CloseShiftInput = z.infer<typeof CloseShiftInputSchema>;

export interface ShiftWithRelations {
  cashMovements?: Array<{
    id: string;
    type: string;
    paymentMethod: string;
    amount: number;
    description: string;
    createdAt: number;
  }>;
  closedAt?: number | null;
  closures?: Array<{
    paymentMethod: string;
    expectedAmount: number;
    actualAmount: number;
    difference: number;
  }>;
  id: string;
  notes?: string | null;
  openedAt: number;
  organizationId: string;
  payments?: Array<{
    appliedAmount?: number | null;
    method: string;
    amount: number;
    changeAmount?: number | null;
    saleId?: string | null;
    createdAt: number;
    sale?: { totalAmount?: number | null; status?: string | null } | null;
    creditTransactions?: Array<{
      type?: string | null;
      saleId?: string | null;
    }>;
  }>;
  sales?: Array<{
    id: string;
    passThroughTotalAmount?: number | null;
    status?: string | null;
    totalAmount?: number | null;
    items?: Array<{
      accountingTreatment?: string | null;
      id: string;
      productId: string;
      quantity: number;
      unitPrice: number;
      subtotal: number;
      taxAmount: number;
      discountAmount: number;
      totalAmount: number;
      product?: {
        id: string;
        name: string;
        categoryId: string;
        category?: { id: string; name: string } | null;
      } | null;
    }>;
  }>;
  startingCash?: number | null;
  status?: string | null;
  terminalId?: string | null;
  terminalName?: string | null;
  user?: { id: string; name: string } | null;
  userId: string;
}

export function toTimestamp(value: Date | number | string | null | undefined) {
  if (value == null) {
    return null;
  }
  if (value instanceof Date) {
    return value.getTime();
  }
  if (typeof value === "number") {
    return value;
  }
  const dateValue = new Date(value);
  return Number.isNaN(dateValue.getTime()) ? null : dateValue.getTime();
}
