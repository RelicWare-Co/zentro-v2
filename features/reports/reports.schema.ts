import { z } from "zod";

export const REPORT_STATUS_VALUES = [
  "active",
  "completed",
  "credit",
  "cancelled",
] as const;

const DATE_KEY_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const MAX_REPORT_DAYS = 366;

function parseDateKey(value: string): Date | null {
  if (!DATE_KEY_REGEX.test(value)) {
    return null;
  }

  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year ?? 0, (month ?? 1) - 1, day ?? 1));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() + 1 !== month ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  return date;
}

export const ReportFiltersSchema = z
  .object({
    startDate: z.string(),
    endDate: z.string(),
    cashierId: z.string().max(255).optional(),
    status: z.enum(REPORT_STATUS_VALUES).default("active"),
  })
  .superRefine((filters, context) => {
    const start = parseDateKey(filters.startDate);
    const end = parseDateKey(filters.endDate);
    if (!(start && end)) {
      context.addIssue({
        code: "custom",
        message: "Las fechas deben tener el formato AAAA-MM-DD",
      });
      return;
    }
    if (start > end) {
      context.addIssue({
        code: "custom",
        message: "La fecha inicial no puede ser posterior a la fecha final",
      });
      return;
    }

    const days = Math.floor((end.getTime() - start.getTime()) / 86_400_000) + 1;
    if (days > MAX_REPORT_DAYS) {
      context.addIssue({
        code: "custom",
        message: `El rango máximo es de ${MAX_REPORT_DAYS} días`,
      });
    }
  });

const ReportSummarySchema = z.object({
  salesCount: z.number(),
  grossSales: z.number(),
  netRevenue: z.number(),
  taxCollected: z.number(),
  discounts: z.number(),
  averageTicket: z.number(),
  collectedTotal: z.number(),
  expensesTotal: z.number(),
  payoutsTotal: z.number(),
  inflowsTotal: z.number(),
});

const ReportSaleSchema = z.object({
  id: z.string(),
  createdAt: z.number(),
  status: z.string(),
  cashierName: z.string(),
  terminalName: z.string().nullable(),
  customerName: z.string().nullable(),
  subtotal: z.number(),
  discountAmount: z.number(),
  taxAmount: z.number(),
  totalAmount: z.number(),
  passThroughTotalAmount: z.number(),
  accountingBilled: z.number(),
  netRevenue: z.number(),
});

const ReportProductSchema = z.object({
  productId: z.string(),
  name: z.string(),
  categoryName: z.string().nullable(),
  quantitySold: z.number(),
  billedTotal: z.number(),
  netRevenue: z.number(),
  taxAmount: z.number(),
  discountAmount: z.number(),
});

const ReportPaymentSchema = z.object({
  method: z.string(),
  label: z.string(),
  paymentCount: z.number(),
  tenderedAmount: z.number(),
  changeAmount: z.number(),
  appliedAmount: z.number(),
  netCollected: z.number(),
});

const ReportMovementSchema = z.object({
  id: z.string(),
  createdAt: z.number(),
  type: z.string(),
  paymentMethod: z.string(),
  paymentMethodLabel: z.string(),
  amount: z.number(),
  description: z.string(),
  cashierName: z.string(),
  terminalName: z.string().nullable(),
  sourceType: z.string().nullable(),
});

export const ReportDataSchema = z.object({
  generatedAt: z.number(),
  organizationName: z.string(),
  timeZone: z.string(),
  period: z.object({
    startDate: z.string(),
    endDate: z.string(),
  }),
  filters: z.object({
    cashierId: z.string().nullable(),
    cashierName: z.string().nullable(),
    status: z.enum(REPORT_STATUS_VALUES),
  }),
  options: z.object({
    cashiers: z.array(z.object({ id: z.string(), name: z.string() })),
  }),
  summary: ReportSummarySchema,
  trend: z.array(
    z.object({
      dateKey: z.string(),
      salesCount: z.number(),
      grossSales: z.number(),
      netRevenue: z.number(),
    })
  ),
  sales: z.array(ReportSaleSchema),
  products: z.array(ReportProductSchema),
  payments: z.array(ReportPaymentSchema),
  movements: z.array(ReportMovementSchema),
  truncated: z.object({
    sales: z.boolean(),
    movements: z.boolean(),
  }),
});

export type ReportFilters = z.infer<typeof ReportFiltersSchema>;
export type ReportData = z.infer<typeof ReportDataSchema>;
