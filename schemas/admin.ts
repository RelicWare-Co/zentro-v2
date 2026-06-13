import { z } from "zod";
import { ModuleKeySchema } from "@/schemas/modules";

export const AdminModuleStateSchema = z.object({
  key: ModuleKeySchema,
  label: z.string(),
  entitlementStatus: z.enum(["granted", "blocked"]),
  activationPolicy: z.enum([
    "self_service",
    "entitled_self_service",
    "platform_admin_only",
  ]),
  enabled: z.boolean(),
  accessible: z.boolean(),
});

export const AdminPlatformOverviewSchema = z.object({
  generatedAt: z.number(),
  totals: z.object({
    organizations: z.number(),
    users: z.number(),
    newOrganizationsThisMonth: z.number(),
    newUsersThisMonth: z.number(),
  }),
  today: z.object({
    revenue: z.number(),
    salesCount: z.number(),
    avgTicket: z.number(),
    activeOrganizations: z.number(),
  }),
  month: z.object({
    revenue: z.number(),
    salesCount: z.number(),
    previousRevenue: z.number(),
    previousSalesCount: z.number(),
  }),
  salesTrend: z
    .object({
      dateKey: z.string(),
      revenue: z.number(),
      salesCount: z.number(),
      activeOrganizations: z.number(),
    })
    .array(),
  /** Ventas de hoy desglosadas por organización, incluyendo las que no han vendido. */
  organizationsDaily: z
    .object({
      id: z.string(),
      name: z.string(),
      slug: z.string(),
      revenueToday: z.number(),
      salesCountToday: z.number(),
      lastSaleAt: z.number().nullable(),
    })
    .array(),
});

export const AdminOrganizationSummarySchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  logo: z.string().nullable(),
  createdAt: z.number(),
  membersCount: z.number(),
  revenueToday: z.number(),
  salesCountToday: z.number(),
  revenue30d: z.number(),
  salesCount30d: z.number(),
  lastSaleAt: z.number().nullable(),
  modules: AdminModuleStateSchema.array(),
});

export const AdminOrganizationsResponseSchema = z.object({
  generatedAt: z.number(),
  organizations: AdminOrganizationSummarySchema.array(),
});

export const AdminOrganizationDetailSchema = z.object({
  generatedAt: z.number(),
  organization: z.object({
    id: z.string(),
    name: z.string(),
    slug: z.string(),
    logo: z.string().nullable(),
    createdAt: z.number(),
  }),
  metrics: z.object({
    revenueToday: z.number(),
    salesCountToday: z.number(),
    revenue30d: z.number(),
    salesCount30d: z.number(),
    totalRevenue: z.number(),
    totalSalesCount: z.number(),
    membersCount: z.number(),
    customersCount: z.number(),
    productsCount: z.number(),
    lastSaleAt: z.number().nullable(),
  }),
  members: z
    .object({
      id: z.string(),
      userId: z.string(),
      name: z.string(),
      email: z.string(),
      role: z.string(),
      banned: z.boolean(),
      createdAt: z.number(),
    })
    .array(),
  modules: AdminModuleStateSchema.array(),
  salesTrend: z
    .object({
      dateKey: z.string(),
      revenue: z.number(),
      salesCount: z.number(),
    })
    .array(),
  recentSales: z
    .object({
      id: z.string(),
      totalAmount: z.number(),
      status: z.string(),
      sellerName: z.string().nullable(),
      createdAt: z.number(),
    })
    .array(),
});

export const AdminSetOrganizationModuleSchema = z.object({
  moduleKey: ModuleKeySchema,
  status: z.enum(["granted", "blocked"]),
});
