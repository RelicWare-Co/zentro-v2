import { z } from "zod";

export const DashboardOverviewSchema = z.object({
  generatedAt: z.number(),
  lowStockThreshold: z.number(),
  activeShift: z
    .object({
      id: z.string(),
      terminalName: z.string().nullable(),
      startingCash: z.number(),
      openedAt: z.number(),
    })
    .nullable(),
  /**
   * Sales window for the "current operation" stats: every open shift in the
   * organization, or the last closed shift when none is open. Shifts often
   * cross midnight (e.g. bars), so these metrics are shift-scoped, not
   * calendar-day-scoped.
   */
  salesWindow: z.object({
    kind: z.enum(["open", "closed", "none"]),
    shiftCount: z.number(),
    openedAt: z.number().nullable(),
    closedAt: z.number().nullable(),
  }),
  stats: z.object({
    shiftRevenue: z.number(),
    shiftSalesCount: z.number(),
    shiftAvgTicket: z.number(),
    shiftCustomersServed: z.number(),
    previousShiftRevenue: z.number(),
    monthRevenue: z.number(),
    monthSalesCount: z.number(),
    previousMonthRevenue: z.number(),
    activeProductsCount: z.number(),
    activeCustomersCount: z.number(),
    lowStockCount: z.number(),
    pendingCreditBalance: z.number(),
    creditAccountsCount: z.number(),
  }),
  salesTrend: z
    .object({
      dateKey: z.string(),
      revenue: z.number(),
      salesCount: z.number(),
    })
    .array(),
  paymentMix: z
    .object({
      method: z.string(),
      amount: z.number(),
    })
    .array(),
  paymentMethodLabels: z.record(z.string(), z.string()),
  topProducts: z
    .object({
      productId: z.string(),
      name: z.string(),
      quantitySold: z.number(),
      revenue: z.number(),
      stock: z.number(),
    })
    .array(),
  lowStockProducts: z
    .object({
      id: z.string(),
      name: z.string(),
      categoryName: z.string().nullable(),
      stock: z.number(),
      minStock: z.number().nullable(),
    })
    .array(),
  recentSales: z
    .object({
      id: z.string(),
      totalAmount: z.number(),
      status: z.string(),
      customerName: z.string().nullable(),
      createdAt: z.number(),
    })
    .array(),
});
