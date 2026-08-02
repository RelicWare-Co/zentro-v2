import { z } from "zod";
import { ModuleKeySchema } from "@/features/modules/modules.schema";

const ADMIN_DATE_KEY_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const ADMIN_DATE_PARTS_REGEX = /^(\d{4})-(\d{2})-(\d{2})$/;

const AdminDateKeySchema = z
  .string()
  .regex(ADMIN_DATE_KEY_REGEX, "Fecha inválida (AAAA-MM-DD)");

const AdminNullableStringSchema = z
  .string()
  .trim()
  .max(255)
  .optional()
  .nullable();

function isValidDateKey(value: string) {
  const match = ADMIN_DATE_PARTS_REGEX.exec(value);
  if (!match) {
    return false;
  }
  const date = new Date(
    Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
  );
  return (
    date.getUTCFullYear() === Number(match[1]) &&
    date.getUTCMonth() === Number(match[2]) - 1 &&
    date.getUTCDate() === Number(match[3])
  );
}

function validateAdminQueryRange(
  value: {
    period: "30d" | "custom" | "all";
    startDate?: string | null;
    endDate?: string | null;
    [key: string]: unknown;
  },
  context: z.RefinementCtx
) {
  if (value.period === "custom" && !value.startDate && !value.endDate) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "El periodo personalizado requiere al menos una fecha.",
      path: ["period"],
    });
  }

  for (const [field, date] of [
    ["startDate", value.startDate],
    ["endDate", value.endDate],
  ] as const) {
    if (date && !isValidDateKey(date)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "La fecha no es válida.",
        path: [field],
      });
    }
  }

  if (value.startDate && value.endDate && value.startDate > value.endDate) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "La fecha inicial no puede ser posterior a la final.",
      path: ["startDate"],
    });
  }

  for (const [minKey, maxKey] of [
    ["paidMin", "paidMax"],
    ["totalMin", "totalMax"],
    ["totalRowsMin", "totalRowsMax"],
    ["invalidRowsMin", "invalidRowsMax"],
  ]) {
    const min = value[minKey];
    const max = value[maxKey];
    if (typeof min === "number" && typeof max === "number" && min > max) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "El mínimo no puede ser mayor que el máximo.",
        path: [minKey],
      });
    }
  }
}

export const AdminSortDirectionSchema = z.enum(["asc", "desc"]);
export const AdminPageSchema = z.number().int().min(1).default(1);
export const AdminPageSizeSchema = z.number().int().min(1).max(100).default(25);

export const AdminOptionsResourceSchema = z.enum([
  "organizations",
  "users",
  "sellers",
]);
export const AdminOptionsQuerySchema = z.object({
  resource: AdminOptionsResourceSchema,
  search: z.string().trim().max(255).default(""),
  page: AdminPageSchema,
  pageSize: z.number().int().min(1).max(50).default(20),
  selectedIds: z.array(z.string().trim().min(1).max(255)).max(100).default([]),
});
export const AdminOptionsResponseSchema = z.object({
  items: z
    .object({
      id: z.string(),
      name: z.string(),
      secondaryLabel: z.string().nullable(),
    })
    .array(),
  total: z.number().int().nonnegative(),
  hasNext: z.boolean(),
});

export const AdminPeriodModeSchema = z.enum(["30d", "custom", "all"]);

export const AdminPeriodSchema = z.object({
  mode: AdminPeriodModeSchema,
  startDate: AdminDateKeySchema.nullable(),
  endDate: AdminDateKeySchema.nullable(),
  timeZone: z.string().min(1),
});

export const AdminUsersSortBySchema = z.enum([
  "createdAt",
  "name",
  "lastSaleAt",
  "paidAmount",
  "paidAmount30d",
  "historicalPaidAmount",
]);
export const AdminOrganizationsSortBySchema = z.enum([
  "createdAt",
  "name",
  "lastSaleAt",
  "paidAmount",
  "paidAmount30d",
  "historicalPaidAmount",
  "membersCount",
]);
export const AdminSalesSortBySchema = z.enum([
  "createdAt",
  "totalAmount",
  "paidAmount",
  "organizationName",
  "sellerName",
]);
export const AdminProductImportsSortBySchema = z.enum([
  "createdAt",
  "completedAt",
  "status",
  "totalRows",
  "invalidRows",
  "createdProducts",
]);

export const AdminUsersQuerySchema = z
  .object({
    period: AdminPeriodModeSchema.default("30d"),
    search: z.string().trim().max(255).default(""),
    searchField: z.enum(["email", "name"]).default("email"),
    organizationId: AdminNullableStringSchema,
    role: z.enum(["admin", "user"]).optional().nullable(),
    banned: z.boolean().optional().nullable(),
    emailVerified: z.boolean().optional().nullable(),
    hasSales: z.boolean().optional().nullable(),
    startDate: AdminDateKeySchema.optional().nullable(),
    endDate: AdminDateKeySchema.optional().nullable(),
    paidMin: z.number().int().min(0).optional().nullable(),
    paidMax: z.number().int().min(0).optional().nullable(),
    sortBy: AdminUsersSortBySchema.default("createdAt"),
    sortDirection: AdminSortDirectionSchema.default("desc"),
    page: AdminPageSchema,
    pageSize: AdminPageSizeSchema,
  })
  .superRefine(validateAdminQueryRange);

export const AdminOrganizationsQuerySchema = z
  .object({
    period: AdminPeriodModeSchema.default("30d"),
    search: z.string().trim().max(255).default(""),
    moduleKey: ModuleKeySchema.optional().nullable(),
    moduleStatus: z.enum(["granted", "blocked"]).optional().nullable(),
    hasSales: z.boolean().optional().nullable(),
    startDate: AdminDateKeySchema.optional().nullable(),
    endDate: AdminDateKeySchema.optional().nullable(),
    paidMin: z.number().int().min(0).optional().nullable(),
    paidMax: z.number().int().min(0).optional().nullable(),
    sortBy: AdminOrganizationsSortBySchema.default("createdAt"),
    sortDirection: AdminSortDirectionSchema.default("desc"),
    page: AdminPageSchema,
    pageSize: AdminPageSizeSchema,
  })
  .superRefine(validateAdminQueryRange);

export const AdminSalesQuerySchema = z
  .object({
    period: AdminPeriodModeSchema.default("30d"),
    search: z.string().trim().max(255).default(""),
    organizationId: AdminNullableStringSchema,
    sellerId: AdminNullableStringSchema,
    terminalName: AdminNullableStringSchema,
    status: z.enum(["completed", "credit", "cancelled"]).optional().nullable(),
    paymentMethod: AdminNullableStringSchema,
    balanceStatus: z.enum(["with_balance", "settled"]).optional().nullable(),
    startDate: AdminDateKeySchema.optional().nullable(),
    endDate: AdminDateKeySchema.optional().nullable(),
    totalMin: z.number().int().min(0).optional().nullable(),
    totalMax: z.number().int().min(0).optional().nullable(),
    paidMin: z.number().int().min(0).optional().nullable(),
    paidMax: z.number().int().min(0).optional().nullable(),
    sortBy: AdminSalesSortBySchema.default("createdAt"),
    sortDirection: AdminSortDirectionSchema.default("desc"),
    page: AdminPageSchema,
    pageSize: AdminPageSizeSchema,
  })
  .superRefine(validateAdminQueryRange);

export const AdminOverviewQuerySchema = z
  .object({
    period: AdminPeriodModeSchema.default("30d"),
    organizationId: AdminNullableStringSchema,
    startDate: AdminDateKeySchema.optional().nullable(),
    endDate: AdminDateKeySchema.optional().nullable(),
  })
  .superRefine(validateAdminQueryRange);

export const AdminListMetaSchema = z.object({
  total: z.number().int().nonnegative(),
  page: z.number().int().positive(),
  pageSize: z.number().int().positive(),
  hasNext: z.boolean(),
});

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
  trendMeta: z
    .object({
      granularity: z.enum(["day", "week", "month"]),
      maxPoints: z.number().int().positive(),
      truncated: z.boolean(),
      startDateKey: z.string().nullable(),
      endDateKey: z.string().nullable(),
    })
    .optional(),
  rankingMeta: z
    .object({
      limit: z.number().int().positive(),
      total: z.number().int().nonnegative(),
      truncated: z.boolean(),
    })
    .optional(),
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
  filters: z
    .object({
      mode: AdminPeriodModeSchema,
      startDate: z.string().nullable(),
      endDate: z.string().nullable(),
      organizationId: z.string().nullable(),
      timeZone: z.string(),
    })
    .optional(),
  periodSummary: z
    .object({
      saleAmount: z.number(),
      paidAmount: z.number().nonnegative(),
      pendingAmount: z.number().nonnegative(),
      salesCount: z.number().int().nonnegative(),
      activeOrganizations: z.number().int().nonnegative(),
    })
    .optional(),
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
  paidAmount: z.number().nonnegative().optional(),
  historicalPaidAmount: z.number().nonnegative().optional(),
  historicalSalesCount: z.number().int().nonnegative().optional(),
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

export const AdminUserSalesMetricsSchema = z.object({
  paidAmount: z.number().nonnegative(),
  paidAmount30d: z.number().nonnegative(),
  historicalPaidAmount: z.number().nonnegative(),
  salesCount: z.number().int().nonnegative(),
  lastSaleAt: z.number().nullable(),
});

export const AdminUserListItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
  emailVerified: z.boolean(),
  image: z.string().nullable(),
  createdAt: z.number(),
  updatedAt: z.number(),
  role: z.string().nullable(),
  banned: z.boolean(),
  banReason: z.string().nullable(),
  banExpires: z.number().nullable(),
  metrics: AdminUserSalesMetricsSchema,
  organizations: z
    .object({ id: z.string(), name: z.string(), role: z.string() })
    .array(),
});

export const AdminUsersResponseSchema = AdminListMetaSchema.extend({
  users: AdminUserListItemSchema.array(),
  summary: z.object({
    total: z.number().int().nonnegative(),
    admins: z.number().int().nonnegative(),
    banned: z.number().int().nonnegative(),
  }),
});

export const AdminOrganizationsResponseV2Schema = AdminListMetaSchema.extend({
  generatedAt: z.number(),
  organizations: AdminOrganizationSummarySchema.array(),
  summary: z.object({
    totalOrganizations: z.number().int().nonnegative(),
    activeOrganizations: z.number().int().nonnegative(),
    paidAmount: z.number().nonnegative(),
    membersCount: z.number().int().nonnegative(),
  }),
  filterOptions: z.object({
    modules: z.object({ key: ModuleKeySchema, label: z.string() }).array(),
  }),
});

export const AdminSalesListItemSchema = z.object({
  id: z.string(),
  organizationId: z.string(),
  organizationName: z.string(),
  sellerId: z.string(),
  sellerName: z.string().nullable(),
  terminalName: z.string().nullable(),
  status: z.string(),
  totalAmount: z.number(),
  paidAmount: z.number().nonnegative(),
  balanceDue: z.number().nonnegative(),
  paymentMethods: z.string().array(),
  createdAt: z.number(),
});

export const AdminSalesResponseSchema = AdminListMetaSchema.extend({
  sales: AdminSalesListItemSchema.array(),
  summary: z.object({
    salesCount: z.number().int().nonnegative(),
    saleAmount: z.number(),
    paidAmount: z.number().nonnegative(),
    pendingAmount: z.number().nonnegative(),
  }),
  filterOptions: z.object({
    terminals: z.string().array(),
    paymentMethods: z.object({ id: z.string(), label: z.string() }).array(),
  }),
});

export const AdminSaleDetailSchema = z.object({
  id: z.string(),
  organizationId: z.string(),
  organizationName: z.string(),
  sellerId: z.string(),
  sellerName: z.string().nullable(),
  terminalName: z.string().nullable(),
  status: z.string(),
  createdAt: z.number(),
  subtotal: z.number(),
  taxAmount: z.number(),
  discountAmount: z.number(),
  totalAmount: z.number(),
  passThroughTotalAmount: z.number(),
  paidAmount: z.number().nonnegative(),
  balanceDue: z.number().nonnegative(),
  payments: z
    .object({
      id: z.string(),
      method: z.string(),
      amount: z.number(),
      appliedAmount: z.number(),
      changeAmount: z.number(),
      reference: z.string().nullable(),
      createdAt: z.number(),
    })
    .array(),
});

export type AdminOptionsQuery = z.infer<typeof AdminOptionsQuerySchema>;
export type AdminUsersQuery = z.infer<typeof AdminUsersQuerySchema>;
export type AdminOrganizationsQuery = z.infer<
  typeof AdminOrganizationsQuerySchema
>;
export type AdminSalesQuery = z.infer<typeof AdminSalesQuerySchema>;
export type AdminOverviewQuery = z.infer<typeof AdminOverviewQuerySchema>;
export type AdminUserListItem = z.infer<typeof AdminUserListItemSchema>;
export type AdminSalesListItem = z.infer<typeof AdminSalesListItemSchema>;
export type AdminSaleDetail = z.infer<typeof AdminSaleDetailSchema>;
