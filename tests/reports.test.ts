import { describe, expect, test } from "bun:test";
import ExcelJS from "@protobi/exceljs";
import { cashMovement } from "@/database/drizzle/schema/pos.schema";
import { buildBusinessReport } from "@/features/reports/build-report.server";
import { buildReportWorkbook } from "@/features/reports/build-report-workbook.server";
import {
  formatReportMovementType,
  formatReportSaleStatus,
} from "@/features/reports/report-labels.shared";
import {
  type ReportData,
  ReportFiltersSchema,
} from "@/features/reports/reports.schema";
import { createCoreSale } from "@/features/sales/create-sale.server";
import {
  seedOrganizationWithMember,
  seedProduct,
  seedShift,
} from "./helpers/seed";
import { createTestDb } from "./helpers/test-db";

function makeWorkbookFixture(): ReportData {
  return {
    generatedAt: Date.parse("2026-07-17T12:00:00.000Z"),
    organizationName: "Café Central",
    timeZone: "America/Bogota",
    period: { startDate: "2026-07-01", endDate: "2026-07-17" },
    filters: { cashierId: null, cashierName: null, status: "active" },
    options: { cashiers: [{ id: "cashier-1", name: "Ana" }] },
    summary: {
      salesCount: 1,
      grossSales: 10_000,
      netRevenue: 10_000,
      taxCollected: 0,
      discounts: 0,
      averageTicket: 10_000,
      collectedTotal: 10_000,
      expensesTotal: 500,
      payoutsTotal: 0,
      inflowsTotal: 0,
    },
    trend: [
      {
        dateKey: "2026-07-17",
        salesCount: 1,
        grossSales: 10_000,
        netRevenue: 10_000,
      },
    ],
    sales: [
      {
        id: "sale-001",
        createdAt: Date.parse("2026-07-17T15:00:00.000Z"),
        status: "completed",
        cashierName: "Ana",
        terminalName: "Caja 1",
        customerName: null,
        subtotal: 10_000,
        discountAmount: 0,
        taxAmount: 0,
        totalAmount: 10_000,
        passThroughTotalAmount: 0,
        accountingBilled: 10_000,
        netRevenue: 10_000,
      },
    ],
    products: [
      {
        productId: "product-001",
        name: "Café",
        categoryName: "Bebidas",
        quantitySold: 1,
        billedTotal: 10_000,
        netRevenue: 10_000,
        taxAmount: 0,
        discountAmount: 0,
      },
    ],
    payments: [
      {
        method: "cash",
        label: "Efectivo",
        paymentCount: 1,
        tenderedAmount: 10_000,
        changeAmount: 0,
        appliedAmount: 10_000,
        netCollected: 10_000,
      },
    ],
    movements: [
      {
        id: "movement-001",
        createdAt: Date.parse("2026-07-17T16:00:00.000Z"),
        type: "expense",
        paymentMethod: "cash",
        paymentMethodLabel: "Efectivo",
        amount: 500,
        description: '=HYPERLINK("https://example.com")',
        cashierName: "Ana",
        terminalName: "Caja 1",
        sourceType: null,
      },
    ],
    truncated: { sales: false, movements: false },
  };
}

describe("report filters", () => {
  test("accepts a custom one-year range", () => {
    expect(
      ReportFiltersSchema.parse({
        startDate: "2026-01-01",
        endDate: "2026-12-31",
      })
    ).toEqual({
      startDate: "2026-01-01",
      endDate: "2026-12-31",
      status: "active",
    });
  });

  test("rejects invalid calendar dates and ranges over 366 days", () => {
    expect(
      ReportFiltersSchema.safeParse({
        startDate: "2026-02-30",
        endDate: "2026-03-01",
      }).success
    ).toBe(false);
    expect(
      ReportFiltersSchema.safeParse({
        startDate: "2025-01-01",
        endDate: "2026-12-31",
      }).success
    ).toBe(false);
  });
});

describe("report labels", () => {
  test("translates sale statuses and movement types for users", () => {
    expect(formatReportSaleStatus("completed")).toBe("Pagada");
    expect(formatReportSaleStatus("credit")).toBe("Crédito pendiente");
    expect(formatReportSaleStatus("cancelled")).toBe("Cancelada");
    expect(formatReportMovementType("expense")).toBe("Gasto operativo");
    expect(formatReportMovementType("payout")).toBe("Pago a proveedor");
    expect(formatReportMovementType("inflow")).toBe("Ingreso manual");
  });
});

describe("business report accounting", () => {
  test("separates accounting sales, passthrough value, cash change, and expenses", async () => {
    const { db, cleanup } = await createTestDb();
    try {
      const { organizationId, userId } = await seedOrganizationWithMember(db, {
        orgName: "Report Test",
        userName: "Cashier One",
      });
      const createdAt = new Date("2026-07-10T15:00:00.000Z");
      const [revenueProductId, passThroughProductId, shiftId] =
        await Promise.all([
          seedProduct(db, {
            organizationId,
            name: "Meal",
            price: 10_000,
            accountingTreatment: "revenue",
          }),
          seedProduct(db, {
            organizationId,
            name: "Delivery fee",
            price: 3000,
            accountingTreatment: "passthrough",
          }),
          seedShift(db, {
            organizationId,
            userId,
            openedAt: createdAt,
            terminalName: "Caja Principal",
          }),
        ]);

      await createCoreSale(
        {
          shiftId,
          createdAt: createdAt.getTime(),
          items: [
            { productId: revenueProductId, quantity: 1, unitPrice: 10_000 },
            { productId: passThroughProductId, quantity: 1, unitPrice: 3000 },
          ],
          payments: [{ method: "cash", amount: 15_000 }],
        },
        { db, organizationId, userId }
      );
      await db.insert(cashMovement).values({
        id: crypto.randomUUID(),
        organizationId,
        shiftId,
        type: "expense",
        paymentMethod: "cash",
        amount: 500,
        description: "Cleaning supplies",
        createdAt,
      });

      const report = await buildBusinessReport(
        db,
        organizationId,
        {
          startDate: "2026-07-01",
          endDate: "2026-07-31",
          status: "active",
        },
        "America/Bogota"
      );

      expect(report.summary).toMatchObject({
        salesCount: 1,
        grossSales: 10_000,
        netRevenue: 10_000,
        collectedTotal: 13_000,
        expensesTotal: 500,
      });
      expect(report.products).toHaveLength(1);
      expect(report.products[0]).toMatchObject({
        productId: revenueProductId,
        billedTotal: 10_000,
      });
      expect(report.sales[0]).toMatchObject({
        totalAmount: 13_000,
        passThroughTotalAmount: 3000,
        accountingBilled: 10_000,
      });
      expect(report.payments[0]).toMatchObject({
        tenderedAmount: 15_000,
        changeAmount: 2000,
        netCollected: 13_000,
      });
    } finally {
      await cleanup();
    }
  });
});

describe("report workbook", () => {
  test("serializes and reopens the expected workbook structure", async () => {
    const bytes = await buildReportWorkbook(makeWorkbookFixture());
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(bytes);

    expect(workbook.worksheets.map((sheet) => sheet.name)).toEqual([
      "Resumen",
      "Ventas",
      "Productos",
      "Pagos",
      "Movimientos",
    ]);
    expect(workbook.getWorksheet("Ventas")?.getTable("SalesData")).toBeTruthy();
    expect(
      workbook.getWorksheet("Productos")?.getTable("ProductsData")
    ).toBeTruthy();
    expect(
      workbook.getWorksheet("Pagos")?.getTable("PaymentsData")
    ).toBeTruthy();
    expect(
      workbook.getWorksheet("Movimientos")?.getTable("MovementsData")
    ).toBeTruthy();
    expect(workbook.getWorksheet("Resumen")?.getCell("D3").value).toBe(
      "Ventas válidas"
    );
    expect(workbook.getWorksheet("Ventas")?.getCell("A4").value).toBe("Fecha");
    expect(workbook.getWorksheet("Ventas")?.getCell("B5").value).toBe("Pagada");
    expect(workbook.getWorksheet("Ventas")?.getCell("F5").value).toBe(10_000);
    expect(workbook.getWorksheet("Ventas")?.getCell("A5").value).toBeInstanceOf(
      Date
    );
    expect(
      (
        workbook.getWorksheet("Ventas")?.getCell("A5").value as Date
      ).toISOString()
    ).toBe("2026-07-17T10:00:00.000Z");
    expect(workbook.getWorksheet("Productos")?.getCell("A4").value).toBe(
      "Producto"
    );
    expect(workbook.getWorksheet("Movimientos")?.getCell("A4").value).toBe(
      "Fecha"
    );
    expect(workbook.getWorksheet("Movimientos")?.getCell("B5").value).toBe(
      "Gasto operativo"
    );
    expect(workbook.getWorksheet("Movimientos")?.getCell("E5").value).toBe(
      '=HYPERLINK("https://example.com")'
    );
    expect(workbook.getWorksheet("Movimientos")?.getCell("E5").type).toBe(
      ExcelJS.ValueType.String
    );
  });
});
