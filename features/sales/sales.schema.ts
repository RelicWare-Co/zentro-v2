import { z } from "zod";

const NullableStringSchema = z.string().trim().optional().nullable();

const SaleStatusSchema = z.enum(["completed", "credit", "cancelled"]);

const SaleBalanceStatusSchema = z.enum(["with_balance", "settled"]);

export const SaleListCursorSchema = z.object({
  createdAt: z.number().int(),
  id: z.string().trim().min(1),
});

export type SaleListCursor = z.infer<typeof SaleListCursorSchema>;

export const SalesListQueryArgsSchema = z.object({
  limit: z.number().int().min(1).max(100).optional(),
  cursor: SaleListCursorSchema.optional().nullable(),
  status: SaleStatusSchema.optional().nullable(),
  searchQuery: z.string().optional().nullable(),
  paymentMethod: z.string().optional().nullable(),
  cashierId: z.string().optional().nullable(),
  terminalName: z.string().optional().nullable(),
  balanceStatus: SaleBalanceStatusSchema.optional().nullable(),
  amountMin: z.number().int().min(0).optional().nullable(),
  amountMax: z.number().int().min(0).optional().nullable(),
  startDate: z.string().optional().nullable(),
  endDate: z.string().optional().nullable(),
});

export const ListSalesInputSchema = z.object({
  limit: z.number().int().min(1).max(100).optional(),
  cursor: SaleListCursorSchema.optional().nullable(),
  status: SaleStatusSchema.optional().nullable(),
  searchQuery: z.string().optional().nullable(),
  paymentMethod: z.string().optional().nullable(),
  cashierId: z.string().optional().nullable(),
  terminalName: z.string().optional().nullable(),
  balanceStatus: SaleBalanceStatusSchema.optional().nullable(),
  amountMin: z.number().int().min(0).optional().nullable(),
  amountMax: z.number().int().min(0).optional().nullable(),
  startDate: z.string().optional().nullable(),
  endDate: z.string().optional().nullable(),
});

const SaleListItemSchema = z.object({
  id: z.string(),
  totalAmount: z.number(),
  status: z.string(),
  customerName: z.string().nullable(),
  cashierName: z.string().nullable(),
  terminalName: z.string().nullable(),
  createdAt: z.number(),
  itemCount: z.number(),
  paidAmount: z.number(),
  balanceDue: z.number(),
  paymentMethods: z.string().array(),
});

const FilterOptionsSchema = z.object({
  cashiers: z.array(
    z.object({
      id: z.string(),
      name: z.string().nullable(),
    })
  ),
  terminals: z.string().array(),
  paymentMethods: z.array(
    z.object({
      id: z.string(),
      label: z.string(),
    })
  ),
});

export const SaleListResultSchema = z.object({
  data: SaleListItemSchema.array(),
  total: z.number().nullable(),
  hasMore: z.boolean(),
  nextCursor: SaleListCursorSchema.nullable(),
  filterOptions: FilterOptionsSchema,
});

export const GetSaleByIdInputSchema = z.object({
  saleId: z.string().trim().min(1),
});

const SaleDetailPaymentSchema = z.object({
  id: z.string(),
  method: z.string(),
  reference: z.string().nullable(),
  amount: z.number(),
  createdAt: z.number(),
  kind: z.enum(["sale_payment", "debt_payment"]),
  notes: z.string().nullable(),
});

const SaleDetailItemModifierSchema = z.object({
  id: z.string(),
  modifierProductId: z.string(),
  name: z.string(),
  quantity: z.number(),
  unitPrice: z.number(),
  subtotal: z.number(),
});

const SaleDetailItemSchema = z.object({
  id: z.string(),
  productId: z.string(),
  name: z.string(),
  quantity: z.number(),
  unitPrice: z.number(),
  subtotal: z.number(),
  taxRate: z.number(),
  taxAmount: z.number(),
  discountAmount: z.number(),
  totalAmount: z.number(),
  modifiers: SaleDetailItemModifierSchema.array(),
});

const SaleDetailCustomerSchema = z.object({
  id: z.string(),
  name: z.string(),
  phone: z.string().nullable(),
  documentType: z.string().nullable(),
  documentNumber: z.string().nullable(),
});

const SaleDetailCashierSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string().nullable(),
});

const SaleDetailShiftSchema = z.object({
  id: z.string(),
  terminalName: z.string().nullable(),
});

export const SaleDetailSchema = z.object({
  id: z.string(),
  status: z.string(),
  createdAt: z.number(),
  subtotal: z.number(),
  taxAmount: z.number(),
  discountAmount: z.number(),
  totalAmount: z.number(),
  paidAmount: z.number(),
  balanceDue: z.number(),
  customer: SaleDetailCustomerSchema.nullable(),
  cashier: SaleDetailCashierSchema.nullable(),
  shift: SaleDetailShiftSchema.nullable(),
  payments: SaleDetailPaymentSchema.array(),
  items: SaleDetailItemSchema.array(),
});

const CreateSaleItemModifierSchema = z.object({
  modifierProductId: z.string().trim().min(1),
  quantity: z.number().int().min(1),
  unitPrice: z.number().min(0).optional(),
});

const CreateSaleItemSchema = z.object({
  productId: z.string().trim().min(1),
  quantity: z.number().int().min(1),
  unitPrice: z.number().min(0).optional(),
  taxRate: z.number().min(0).max(100).optional(),
  discountAmount: z.number().min(0).optional(),
  modifiers: z.array(CreateSaleItemModifierSchema).optional(),
});

const CreateSalePaymentSchema = z.object({
  method: z.string().trim().min(1),
  amount: z.number().int().min(1),
  reference: NullableStringSchema,
});

export const CreateSaleInputSchema = z.object({
  shiftId: z.string().trim().min(1),
  customerId: NullableStringSchema,
  items: z
    .array(CreateSaleItemSchema)
    .min(1, "La venta debe incluir al menos un ítem"),
  discountAmount: z.number().min(0).optional(),
  payments: z.array(CreateSalePaymentSchema).optional(),
  isCreditSale: z.boolean().optional(),
  createdAt: z.number().int().min(0).optional(),
});

export const CreateSaleResultSchema = z.object({
  saleId: z.string(),
  status: z.string(),
  subtotal: z.number(),
  taxAmount: z.number(),
  discountAmount: z.number(),
  totalAmount: z.number(),
  paidAmount: z.number(),
  balanceDue: z.number(),
});

export const CancelSaleInputSchema = z.object({
  saleId: z.string().trim().min(1),
  cancelledAt: z.number().int().min(0).optional(),
});

export const CancelSaleResultSchema = z.object({
  saleId: z.string(),
  status: z.literal("cancelled"),
  cancelledAt: z.number(),
});
