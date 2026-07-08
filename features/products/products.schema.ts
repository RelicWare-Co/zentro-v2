import { z } from "zod";

const NullableStringSchema = z.string().trim().optional().nullable();

const OptionalNonNegativeIntSchema = z
  .number()
  .int()
  .min(0)
  .nullable()
  .optional();

const BARCODE_PATTERN = /^[\dA-Za-z-]+$/;

function validateBarcodeValue(
  barcode: string | null | undefined,
  ctx: z.RefinementCtx
) {
  const trimmed = barcode?.trim() ?? "";
  if (trimmed && (trimmed.length > 64 || !BARCODE_PATTERN.test(trimmed))) {
    ctx.addIssue({
      code: "custom",
      message: "El código de barras solo puede tener letras, números o guiones",
      path: ["barcode"],
    });
  }
}

export const AccountingTreatmentSchema = z.enum(["revenue", "passthrough"]);

function validatePassthroughProductRules(
  input: {
    accountingTreatment?: string;
    isModifier?: boolean;
    trackInventory?: boolean;
    autoPayoutEnabled?: boolean;
    autoPayoutPaymentMethod?: string;
  },
  ctx: z.RefinementCtx
) {
  const isPassthrough = input.accountingTreatment === "passthrough";
  if (!isPassthrough) {
    return;
  }

  if (input.isModifier) {
    ctx.addIssue({
      code: "custom",
      message: "Un producto no contable no puede ser modificador",
      path: ["isModifier"],
    });
  }

  if (input.trackInventory) {
    ctx.addIssue({
      code: "custom",
      message: "Un producto no contable no puede controlar inventario",
      path: ["trackInventory"],
    });
  }

  if (input.autoPayoutEnabled && !input.autoPayoutPaymentMethod?.trim()) {
    ctx.addIssue({
      code: "custom",
      message: "Debes seleccionar un método de pago para la autosalida de caja",
      path: ["autoPayoutPaymentMethod"],
    });
  }
}

export const ProductSchema = z.object({
  id: z.string(),
  name: z.string(),
  categoryId: z.string().nullable().optional(),
  categoryName: z.string().nullable().optional(),
  sku: z.string().nullable().optional(),
  barcode: z.string().nullable().optional(),
  price: z.number(),
  cost: z.number(),
  taxRate: z.number(),
  stock: z.number(),
  minStock: z.number().nullable().optional(),
  reorderQuantity: z.number().nullable().optional(),
  trackInventory: z.boolean(),
  isModifier: z.boolean(),
  isFavorite: z.boolean(),
  accountingTreatment: AccountingTreatmentSchema,
  autoPayoutEnabled: z.boolean(),
  autoPayoutPaymentMethod: z.string(),
  createdAt: z.number(),
});

export const CategorySchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable().optional(),
});

export const CreateProductSchema = z
  .object({
    name: z.string().trim().min(1, "El nombre es obligatorio"),
    categoryId: NullableStringSchema,
    sku: NullableStringSchema,
    barcode: NullableStringSchema,
    price: z.number().min(0),
    cost: z.number().min(0).optional(),
    taxRate: z.number().min(0).max(100).optional(),
    stock: z.number().int().min(0).optional(),
    minStock: OptionalNonNegativeIntSchema,
    reorderQuantity: OptionalNonNegativeIntSchema,
    trackInventory: z.boolean().optional(),
    isModifier: z.boolean().optional(),
    accountingTreatment: AccountingTreatmentSchema.optional(),
    autoPayoutEnabled: z.boolean().optional(),
    autoPayoutPaymentMethod: z.string().trim().min(1).optional(),
  })
  .superRefine((input, ctx) => {
    validateBarcodeValue(input.barcode, ctx);
    validatePassthroughProductRules(input, ctx);
  });

export const UpdateProductSchema = z
  .object({
    id: z.string().trim().min(1),
    name: z.string().trim().min(1).optional(),
    categoryId: NullableStringSchema,
    sku: NullableStringSchema,
    barcode: NullableStringSchema,
    price: z.number().min(0).optional(),
    cost: z.number().min(0).optional(),
    taxRate: z.number().min(0).max(100).optional(),
    stock: z.number().int().min(0).optional(),
    minStock: OptionalNonNegativeIntSchema,
    reorderQuantity: OptionalNonNegativeIntSchema,
    trackInventory: z.boolean().optional(),
    isModifier: z.boolean().optional(),
    accountingTreatment: AccountingTreatmentSchema.optional(),
    autoPayoutEnabled: z.boolean().optional(),
    autoPayoutPaymentMethod: z.string().trim().min(1).optional(),
  })
  .refine(
    (input) =>
      input.name !== undefined ||
      input.categoryId !== undefined ||
      input.sku !== undefined ||
      input.barcode !== undefined ||
      input.price !== undefined ||
      input.cost !== undefined ||
      input.taxRate !== undefined ||
      input.stock !== undefined ||
      input.minStock !== undefined ||
      input.reorderQuantity !== undefined ||
      input.trackInventory !== undefined ||
      input.isModifier !== undefined ||
      input.accountingTreatment !== undefined ||
      input.autoPayoutEnabled !== undefined ||
      input.autoPayoutPaymentMethod !== undefined,
    {
      message: "Debes enviar al menos un campo para actualizar",
    }
  )
  .superRefine((input, ctx) => {
    if (input.barcode === undefined) {
      return;
    }
    validateBarcodeValue(input.barcode, ctx);
  })
  .superRefine((input, ctx) => {
    validatePassthroughProductRules(input, ctx);
  });

export const RegisterInventoryMovementSchema = z.object({
  productId: z.string().trim().min(1),
  type: z.enum(["restock", "waste", "adjustment"]),
  quantity: z.number().int(),
  restockMode: z.enum(["add_to_stock", "set_as_total"]).optional(),
  notes: NullableStringSchema,
  createdAt: z.number().int().min(0).optional(),
});

export const DeleteProductSchema = z.object({
  id: z.string().trim().min(1),
});

export const CreateCategorySchema = z.object({
  name: z.string().trim().min(1, "El nombre es obligatorio"),
  description: NullableStringSchema,
});

export const UpdateCategorySchema = z
  .object({
    id: z.string().trim().min(1),
    name: z.string().trim().min(1).optional(),
    description: NullableStringSchema,
  })
  .refine(
    (input) => input.name !== undefined || input.description !== undefined,
    {
      message: "Debes enviar al menos un campo para actualizar",
    }
  );

export const DeleteCategorySchema = z.object({
  id: z.string().trim().min(1),
});

export const IdResultSchema = z.object({
  id: z.string(),
});

export const SuccessResultSchema = z.object({
  success: z.boolean(),
});

export const InventoryMovementResultSchema = z.object({
  id: z.string(),
  productId: z.string(),
  quantity: z.number(),
});

export const ListProductsInputSchema = z.object({
  page: z.coerce.number().int().min(0).optional(),
  pageSize: z.coerce.number().int().min(1).max(100).optional(),
  query: NullableStringSchema,
  categoryId: NullableStringSchema,
});

export const ListProductsResultSchema = z.object({
  items: ProductSchema.array(),
  total: z.number().int(),
  page: z.number().int(),
  pageSize: z.number().int(),
});
