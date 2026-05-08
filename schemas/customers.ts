import { z } from "zod";

const NullableStringSchema = z.string().trim().optional().nullable();

export const CustomerSchema = z.object({
	id: z.string(),
	type: z.string(),
	documentType: z.string().nullable().optional(),
	documentNumber: z.string().nullable().optional(),
	name: z.string(),
	email: z.string().nullable().optional(),
	phone: z.string().nullable().optional(),
	address: z.string().nullable().optional(),
	city: z.string().nullable().optional(),
	taxRegime: z.string().nullable().optional(),
	createdAt: z.number(),
	updatedAt: z.number(),
});

export const SearchCustomersSchema = z.object({
	searchQuery: NullableStringSchema,
	limit: z.coerce.number().int().min(1).max(100).optional(),
	cursor: z.coerce.number().int().min(0).optional(),
});

export const SearchCustomersResultSchema = z.object({
	data: CustomerSchema.array(),
	hasMore: z.boolean(),
	total: z.number(),
	nextCursor: z.number().nullable(),
});

export const CreateCustomerSchema = z.object({
	type: NullableStringSchema,
	documentType: NullableStringSchema,
	documentNumber: NullableStringSchema,
	name: z.string().trim().min(1, "El nombre es obligatorio"),
	email: NullableStringSchema,
	phone: NullableStringSchema,
	address: NullableStringSchema,
	city: NullableStringSchema,
	taxRegime: NullableStringSchema,
});

export const UpdateCustomerSchema = z
	.object({
		id: z.string().trim().min(1),
		type: NullableStringSchema,
		documentType: NullableStringSchema,
		documentNumber: NullableStringSchema,
		name: z.string().trim().min(1).optional(),
		email: NullableStringSchema,
		phone: NullableStringSchema,
		address: NullableStringSchema,
		city: NullableStringSchema,
		taxRegime: NullableStringSchema,
	})
	.refine(
		(input) =>
			input.type !== undefined ||
			input.documentType !== undefined ||
			input.documentNumber !== undefined ||
			input.name !== undefined ||
			input.email !== undefined ||
			input.phone !== undefined ||
			input.address !== undefined ||
			input.city !== undefined ||
			input.taxRegime !== undefined,
		{
			message: "Debes enviar al menos un campo para actualizar",
		},
	);

export const DeleteCustomerSchema = z.object({
	id: z.string().trim().min(1),
});

export const CustomerIdResultSchema = z.object({
	id: z.string(),
});

export const CustomerSuccessResultSchema = z.object({
	success: z.boolean(),
});
