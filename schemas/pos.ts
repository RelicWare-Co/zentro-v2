import { z } from "zod";

const NullableStringSchema = z.string().trim().optional().nullable();

export const PosProductSchema = z.object({
  id: z.string(),
  name: z.string(),
  categoryId: z.string().nullable().optional(),
  categoryName: z.string(),
  sku: z.string().nullable().optional(),
  barcode: z.string().nullable().optional(),
  price: z.number(),
  taxRate: z.number(),
  trackInventory: z.boolean(),
  stock: z.number(),
  isModifier: z.boolean(),
  isFavorite: z.boolean(),
});

export const SearchPosProductsInputSchema = z.object({
  searchQuery: NullableStringSchema,
  categoryId: NullableStringSchema,
  limit: z.coerce.number().int().min(1).max(100).optional(),
  cursor: z.coerce.number().int().min(0).optional(),
});

export const SearchPosProductsResultSchema = z.object({
  data: PosProductSchema.array(),
  hasMore: z.boolean(),
  total: z.number(),
  nextCursor: z.number().nullable(),
});

const PosCategorySchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable().optional(),
});

const PosPaymentMethodSchema = z.object({
  id: z.string(),
  label: z.string(),
  requiresReference: z.boolean(),
});

const PosSettingsSchema = z.object({
  defaultTerminalName: z.string(),
  defaultStartingCash: z.number(),
  paymentMethods: PosPaymentMethodSchema.array(),
  allowCreditSales: z.boolean(),
});

const PosActiveShiftSchema = z.object({
  id: z.string(),
  terminalId: z.string().nullable().optional(),
  terminalName: z.string().nullable().optional(),
  status: z.string(),
  startingCash: z.number(),
  openedAt: z.number().nullable().optional(),
  closedAt: z.number().nullable().optional(),
  notes: z.string().nullable().optional(),
});

export { PosActiveShiftSchema };

export const PosBootstrapResultSchema = z.object({
  activeShift: PosActiveShiftSchema.nullable(),
  categories: PosCategorySchema.array(),
  modifierProducts: PosProductSchema.array(),
  settings: PosSettingsSchema,
});

export const ToggleProductFavoriteInputSchema = z.object({
  productId: z.string().trim().min(1),
});

export const ToggleProductFavoriteResultSchema = z.object({
  success: z.boolean(),
  isFavorite: z.boolean(),
});

export const OpenShiftInputSchema = z.object({
  startingCash: z.coerce.number().min(0),
  terminalId: NullableStringSchema,
  terminalName: NullableStringSchema,
  notes: NullableStringSchema,
  openedAt: z.coerce.number().int().min(0).optional(),
});

export const OpenShiftResultSchema = z.object({
  id: z.string(),
  status: z.literal("open"),
  startingCash: z.number(),
  openedAt: z.number(),
});

const CashMovementTypeSchema = z.enum(["expense", "payout", "inflow"]);

export const RegisterCashMovementInputSchema = z.object({
  shiftId: z.string().trim().min(1),
  type: CashMovementTypeSchema,
  paymentMethod: z.string().trim().min(1),
  amount: z.coerce.number().int().positive(),
  description: z.string().trim().min(1),
  createdAt: z.coerce.number().int().min(0).optional(),
});

export const RegisterCashMovementResultSchema = z.object({
  id: z.string(),
  shiftId: z.string(),
  type: CashMovementTypeSchema,
  paymentMethod: z.string(),
  amount: z.number(),
  description: z.string(),
  createdAt: z.number(),
});

export const ShiftCloseSummaryInputSchema = z.object({
  shiftId: z.string().trim().min(1),
});

const ShiftSummaryByMethodSchema = z.object({
  paymentMethod: z.string(),
  expectedAmount: z.number(),
  actualAmount: z.number().nullable().optional(),
  difference: z.number().nullable().optional(),
});

const ShiftCloseMovementItemSchema = z.object({
  type: z.string(),
  paymentMethod: z.string(),
  amount: z.number(),
  description: z.string(),
  createdAt: z.number(),
});

const ShiftCloseMovementTotalsSchema = z.object({
  inflow: z.number(),
  expense: z.number(),
  payout: z.number(),
  net: z.number(),
});

export const ShiftCloseSummaryResultSchema = z.object({
  shift: z.object({
    id: z.string(),
    status: z.string(),
    startingCash: z.number(),
    openedAt: z.number().nullable().optional(),
    closedAt: z.number().nullable().optional(),
  }),
  summaryByMethod: ShiftSummaryByMethodSchema.array(),
  totalExpected: z.number(),
  paymentMethods: z.array(z.object({ id: z.string(), label: z.string() })),
  movements: z.object({
    items: ShiftCloseMovementItemSchema.array(),
    totals: ShiftCloseMovementTotalsSchema,
  }),
  registeredClosures: z.array(
    z.object({
      paymentMethod: z.string(),
      expectedAmount: z.number(),
      actualAmount: z.number(),
      difference: z.number(),
    })
  ),
});

export const CloseShiftInputSchema = z.object({
  shiftId: z.string().trim().min(1),
  closures: z
    .array(
      z.object({
        paymentMethod: z.string().trim().min(1),
        actualAmount: z.coerce.number().int().min(0),
      })
    )
    .min(1),
  notes: NullableStringSchema,
  closedAt: z.coerce.number().int().min(0).optional(),
});

export const CloseShiftResultSchema = z.object({
  shiftId: z.string(),
  closedAt: z.number(),
  closures: z.array(
    z.object({
      id: z.string(),
      shiftId: z.string(),
      paymentMethod: z.string(),
      expectedAmount: z.number(),
      actualAmount: z.number(),
      difference: z.number(),
    })
  ),
});
