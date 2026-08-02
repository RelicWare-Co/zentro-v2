import { describe, expect, test } from "bun:test";
import { eq } from "drizzle-orm";
import { organization } from "@/database/drizzle/schema/auth.schema";
import { organizationModuleEntitlement } from "@/database/drizzle/schema/feature.schema";
import { sale } from "@/database/drizzle/schema/sales.schema";
import {
  AdminOptionsQuerySchema,
  AdminOrganizationsQuerySchema,
  AdminOverviewQuerySchema,
  AdminSalesQuerySchema,
  AdminUsersQuerySchema,
} from "@/features/admin/admin.schema";
import { resolveAdminDateRange } from "@/features/admin/admin-filters.shared";
import {
  parseAdminOptionsQuery,
  parseAdminProductImportsQuery,
  parseAdminSalesQuery,
} from "@/features/admin/admin-query-params.server";
import { runBuildAdminOptions } from "@/features/admin/build-admin-options.server";
import {
  runBuildAdminOrganizationDetail,
  runBuildAdminOrganizations,
} from "@/features/admin/build-admin-organizations.server";
import { runBuildAdminOrganizationsList } from "@/features/admin/build-admin-organizations-list.server";
import {
  resolveAdminOverviewGranularity,
  runBuildAdminOverviewFiltered,
} from "@/features/admin/build-admin-overview-filtered.server";
import {
  runBuildAdminSaleDetail,
  runBuildAdminSales,
} from "@/features/admin/build-admin-sales.server";
import { runBuildAdminUsers } from "@/features/admin/build-admin-users.server";
import { createCoreSale } from "@/features/sales/create-sale.server";
import {
  seedCustomer,
  seedOrganizationWithMember,
  seedProduct,
  seedShift,
  seedUser,
} from "./helpers/seed";
import { createTestDb } from "./helpers/test-db";

describe("admin filters and sales aggregates", () => {
  test("rejects incomplete or reversed custom periods at the query boundary", () => {
    expect(() =>
      parseAdminSalesQuery(new URLSearchParams("period=custom"))
    ).toThrow();
    expect(() =>
      parseAdminProductImportsQuery(
        new URLSearchParams("startDate=2026-03-01&endDate=2026-02-01")
      )
    ).toThrow();
  });

  test("uses timezone-safe 30-day windows", () => {
    const range = resolveAdminDateRange(
      "30d",
      null,
      null,
      "America/Bogota",
      new Date("2026-02-15T12:00:00.000Z")
    );
    expect(range.start?.toISOString()).toBe("2026-01-17T05:00:00.000Z");
    expect(range.endExclusive?.toISOString()).toBe("2026-02-16T05:00:00.000Z");
  });

  test("keeps partial credit, paid sales and cancellations out of paid totals", async () => {
    const { db, cleanup } = await createTestDb();
    const { organizationId, userId } = await seedOrganizationWithMember(db, {
      orgName: "Admin Metrics",
    });
    const [productId, customerId, shiftId] = await Promise.all([
      seedProduct(db, { organizationId, price: 10_000, stock: 20 }),
      seedCustomer(db, { organizationId, name: "Credit Customer" }),
      seedShift(db, { organizationId, userId, status: "open" }),
    ]);

    const paid = await createCoreSale(
      {
        shiftId,
        items: [{ productId, quantity: 1, unitPrice: 10_000 }],
        payments: [{ method: "cash", amount: 10_000 }],
      },
      { db, organizationId, userId }
    );
    await createCoreSale(
      {
        shiftId,
        customerId,
        items: [{ productId, quantity: 1, unitPrice: 10_000 }],
        payments: [{ method: "cash", amount: 4000 }],
        isCreditSale: true,
      },
      { db, organizationId, userId }
    );
    await createCoreSale(
      {
        shiftId,
        customerId,
        items: [{ productId, quantity: 1, unitPrice: 10_000 }],
        payments: [],
        isCreditSale: true,
      },
      { db, organizationId, userId }
    );
    await db
      .update(sale)
      .set({ status: "cancelled" })
      .where(eq(sale.id, paid.saleId));

    const sales = await runBuildAdminSales(
      db,
      AdminSalesQuerySchema.parse({ period: "all", page: 1, pageSize: 100 }),
      "America/Bogota"
    );
    expect(sales.summary.salesCount).toBe(3);
    expect(sales.summary.paidAmount).toBe(4000);
    expect(sales.sales.every((row) => row.paidAmount >= 0)).toBe(true);

    const users = await runBuildAdminUsers(
      db,
      AdminUsersQuerySchema.parse({ period: "all", page: 1, pageSize: 100 }),
      "America/Bogota"
    );
    const adminUser = users.users.find((row) => row.id === userId);
    expect(adminUser?.metrics.paidAmount).toBe(4000);
    expect(adminUser?.metrics.historicalPaidAmount).toBe(4000);

    const organizations = await runBuildAdminOrganizationsList(
      db,
      AdminOrganizationsQuerySchema.parse({
        period: "all",
        page: 1,
        pageSize: 100,
      }),
      "America/Bogota"
    );
    expect(organizations.summary.paidAmount).toBe(4000);
    expect(organizations.organizations[0]?.paidAmount).toBe(4000);

    const organizationDetail = await runBuildAdminOrganizations(
      db,
      "America/Bogota"
    );
    expect(organizationDetail.organizations[0]?.revenueToday).toBe(4000);
    expect(organizationDetail.organizations[0]?.revenue30d).toBe(4000);

    const organizationSheet = await runBuildAdminOrganizationDetail(
      db,
      organizationId,
      "America/Bogota"
    );
    expect(organizationSheet?.metrics.revenueToday).toBe(4000);
    expect(organizationSheet?.metrics.totalRevenue).toBe(4000);

    const overview = await runBuildAdminOverviewFiltered(
      db,
      AdminOverviewQuerySchema.parse({ period: "all" }),
      "America/Bogota"
    );
    expect(overview.periodSummary?.paidAmount).toBe(4000);

    const detail = await runBuildAdminSaleDetail(db, paid.saleId);
    expect(detail?.paidAmount).toBe(0);

    const filteredPage = await runBuildAdminSales(
      db,
      AdminSalesQuerySchema.parse({
        period: "all",
        status: "credit",
        balanceStatus: "with_balance",
        paymentMethod: "cash",
        totalMin: 10_000,
        totalMax: 10_000,
        sortBy: "totalAmount",
        sortDirection: "desc",
        page: 1,
        pageSize: 1,
      }),
      "America/Bogota"
    );
    expect(filteredPage.total).toBe(1);
    expect(filteredPage.sales).toHaveLength(1);
    expect(filteredPage.hasNext).toBe(false);
    expect(filteredPage.summary.paidAmount).toBe(4000);
    expect(filteredPage.summary.pendingAmount).toBe(6000);

    await cleanup();
  });

  test("uses effective module entitlement defaults and explicit overrides", async () => {
    const { db, cleanup } = await createTestDb();
    try {
      const defaultOrganization = await seedOrganizationWithMember(db, {
        orgName: "Default Restaurants",
      });
      const blockedOrganization = await seedOrganizationWithMember(db, {
        orgName: "Blocked Restaurants",
      });
      const now = new Date();
      await db.insert(organizationModuleEntitlement).values({
        id: crypto.randomUUID(),
        organizationId: blockedOrganization.organizationId,
        moduleKey: "restaurants",
        status: "blocked",
        createdAt: now,
        updatedAt: now,
      });

      const granted = await runBuildAdminOrganizationsList(
        db,
        AdminOrganizationsQuerySchema.parse({
          period: "all",
          moduleKey: "restaurants",
          moduleStatus: "granted",
          page: 1,
          pageSize: 100,
        }),
        "America/Bogota"
      );
      expect(granted.organizations.map((item) => item.id)).toEqual([
        defaultOrganization.organizationId,
      ]);

      const blocked = await runBuildAdminOrganizationsList(
        db,
        AdminOrganizationsQuerySchema.parse({
          period: "all",
          moduleKey: "restaurants",
          moduleStatus: "blocked",
          page: 1,
          pageSize: 100,
        }),
        "America/Bogota"
      );
      expect(blocked.organizations.map((item) => item.id)).toEqual([
        blockedOrganization.organizationId,
      ]);
    } finally {
      await cleanup();
    }
  });

  test("filters users by email verification together with search", async () => {
    const { db, cleanup } = await createTestDb();
    try {
      const verified = await seedUser(db, {
        name: "Alpha Verified",
        emailVerified: true,
      });
      await seedUser(db, { name: "Beta Pending", emailVerified: false });

      const result = await runBuildAdminUsers(
        db,
        AdminUsersQuerySchema.parse({
          period: "all",
          emailVerified: true,
          search: "Alpha",
          searchField: "name",
          page: 1,
          pageSize: 20,
        }),
        "America/Bogota"
      );
      expect(result.users.map((item) => item.id)).toEqual([verified.id]);
      expect(result.summary.total).toBe(1);
    } finally {
      await cleanup();
    }
  });

  test("paginates searchable options beyond 100 organizations and resolves selections", async () => {
    const { db, cleanup } = await createTestDb();
    try {
      const now = new Date();
      const organizations = Array.from({ length: 105 }, (_, index) => ({
        id: `option-org-${String(index).padStart(3, "0")}`,
        name: `Option Organization ${String(index).padStart(3, "0")}`,
        slug: `option-organization-${String(index).padStart(3, "0")}`,
        createdAt: now,
      }));
      await db.insert(organization).values(organizations);

      const sixthPage = await runBuildAdminOptions(
        db,
        AdminOptionsQuerySchema.parse({
          resource: "organizations",
          page: 6,
          pageSize: 20,
        })
      );
      expect(sixthPage.total).toBe(105);
      expect(sixthPage.items).toHaveLength(5);
      expect(sixthPage.hasNext).toBe(false);

      const selected = await runBuildAdminOptions(
        db,
        parseAdminOptionsQuery(
          new URLSearchParams(
            "resource=organizations&search=no-match&selectedId=option-org-104"
          )
        )
      );
      expect(selected.total).toBe(0);
      expect(selected.items.map((item) => item.id)).toEqual(["option-org-104"]);
    } finally {
      await cleanup();
    }
  });

  test("keeps organization sorting deterministic and summaries independent of pages", async () => {
    const { db, cleanup } = await createTestDb();
    try {
      const now = new Date("2026-01-01T00:00:00.000Z");
      await db.insert(organization).values(
        ["org-a", "org-b", "org-c"].map((id) => ({
          id,
          name: "Same Organization",
          slug: `same-${id}`,
          createdAt: now,
        }))
      );
      const sortFields = [
        "createdAt",
        "name",
        "lastSaleAt",
        "paidAmount",
        "paidAmount30d",
        "historicalPaidAmount",
        "membersCount",
      ] as const;
      for (const sortBy of sortFields) {
        const result = await runBuildAdminOrganizationsList(
          db,
          AdminOrganizationsQuerySchema.parse({
            period: "all",
            sortBy,
            sortDirection: "asc",
            page: 1,
            pageSize: 100,
          }),
          "America/Bogota"
        );
        expect(result.organizations.map((item) => item.id)).toEqual([
          "org-a",
          "org-b",
          "org-c",
        ]);
      }

      const secondPage = await runBuildAdminOrganizationsList(
        db,
        AdminOrganizationsQuerySchema.parse({
          period: "all",
          sortBy: "name",
          sortDirection: "asc",
          page: 2,
          pageSize: 2,
        }),
        "America/Bogota"
      );
      expect(secondPage.organizations.map((item) => item.id)).toEqual([
        "org-c",
      ]);
      expect(secondPage.summary.totalOrganizations).toBe(3);
      expect(secondPage.total).toBe(3);
      expect(secondPage.hasNext).toBe(false);
    } finally {
      await cleanup();
    }
  });

  test("accepts open custom ranges and selects bounded trend granularity", () => {
    const openRange = parseAdminSalesQuery(
      new URLSearchParams("period=custom&startDate=2026-01-01")
    );
    expect(openRange.startDate).toBe("2026-01-01");
    expect(openRange.endDate).toBeUndefined();

    expect(
      resolveAdminOverviewGranularity({
        start: new Date("2026-01-01T00:00:00.000Z"),
        endExclusive: new Date("2026-01-31T00:00:00.000Z"),
      }).granularity
    ).toBe("day");
    expect(
      resolveAdminOverviewGranularity({
        start: new Date("2026-01-01T00:00:00.000Z"),
        endExclusive: new Date("2026-05-01T00:00:00.000Z"),
      }).granularity
    ).toBe("week");
    expect(
      resolveAdminOverviewGranularity({ start: null, endExclusive: null })
        .granularity
    ).toBe("month");
  });
});
