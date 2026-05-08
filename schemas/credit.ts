import { z } from "zod";

const NullableStringSchema = z.string().trim().optional().nullable();

export const CreditAccountSchema = z.object({
	id: z.string(),
	customerId: z.string(),
	balance: z.number(),
	interestRate: z.number().nullable().optional(),
	createdAt: z.number(),
	updatedAt: z.number(),
	customerName: z.string(),
	customerDocument: z.string().nullable().optional(),
	customerPhone: z.string().nullable().optional(),
});

export const CreditTransactionSchema = z.object({
	id: z.string(),
	type: z.string(),
	amount: z.number(),
	notes: z.string().nullable().optional(),
	saleId: z.string().nullable().optional(),
	paymentId: z.string().nullable().optional(),
	createdAt: z.number(),
});

export const SearchCreditAccountsSchema = z.object({
	searchQuery: NullableStringSchema,
	limit: z.coerce.number().int().min(1).max(100).optional(),
	cursor: z.coerce.number().int().min(0).optional(),
});

export const SearchCreditAccountsResultSchema = z.object({
	data: CreditAccountSchema.array(),
	hasMore: z.boolean(),
	total: z.number(),
	nextCursor: z.number().nullable(),
});

export const ListCreditTransactionsSchema = z.object({
	creditAccountId: z.string().trim().min(1),
	limit: z.coerce.number().int().min(1).max(100).optional(),
	cursor: z.coerce.number().int().min(0).optional(),
});

export const ListCreditTransactionsResultSchema = z.object({
	data: CreditTransactionSchema.array(),
	hasMore: z.boolean(),
	total: z.number(),
	nextCursor: z.number().nullable(),
});

export const RegisterCreditPaymentSchema = z.object({
	shiftId: z.string().trim().min(1),
	creditAccountId: z.string().trim().min(1),
	saleId: NullableStringSchema,
	amount: z.coerce.number().int().positive(),
	method: z.string().trim().min(1),
	reference: NullableStringSchema,
	notes: NullableStringSchema,
	createdAt: z.coerce.number().int().min(0).optional(),
});

export const RegisterCreditPaymentResultSchema = z.object({
	creditAccountId: z.string(),
	saleId: z.string().nullable(),
	paymentId: z.string(),
	transactionId: z.string(),
	amount: z.number(),
	newBalance: z.number(),
});
