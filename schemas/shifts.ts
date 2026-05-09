import { z } from "zod";

const NullableStringSchema = z.string().trim().optional().nullable();

export const ShiftStatusSchema = z.enum(["open", "closed"]);

export const DifferenceStatusSchema = z.enum(["short", "over", "balanced"]);

export const HasMovementsSchema = z.enum(["yes", "no"]);

export const ListShiftsInputSchema = z.object({
	limit: z.coerce.number().int().min(1).max(100).optional(),
	cursor: z.coerce.number().int().min(0).optional(),
	searchQuery: z.string().optional().nullable(),
	status: ShiftStatusSchema.optional().nullable(),
	cashierId: z.string().optional().nullable(),
	terminalName: z.string().optional().nullable(),
	paymentMethod: z.string().optional().nullable(),
	differenceStatus: DifferenceStatusSchema.optional().nullable(),
	hasMovements: HasMovementsSchema.optional().nullable(),
	startDate: z.string().optional().nullable(),
	endDate: z.string().optional().nullable(),
});

export const ShiftOperationsSchema = z.object({
	paidSalesCount: z.number(),
	paidSalesAmount: z.number(),
	cancelledSalesCount: z.number(),
	cancelledSalesAmount: z.number(),
	creditSalesCount: z.number(),
	creditSalesAmount: z.number(),
});

export const ShiftPaymentBreakdownSchema = z.object({
	method: z.string(),
	amount: z.number(),
});

export const ShiftPaymentSchema = z.object({
	method: z.string(),
	amount: z.number(),
	saleId: z.string().nullable(),
	saleTotalAmount: z.number().nullable(),
	createdAt: z.number(),
});

export const ShiftMovementSchema = z.object({
	id: z.string(),
	type: z.string(),
	paymentMethod: z.string(),
	amount: z.number(),
	description: z.string(),
	createdAt: z.number(),
});

export const ShiftClosureSchema = z.object({
	paymentMethod: z.string(),
	expectedAmount: z.number(),
	actualAmount: z.number(),
	difference: z.number(),
});

export const ShiftTotalsSchema = z.object({
	totalPayments: z.number(),
	expectedCash: z.number(),
	totalExpected: z.number(),
	totalActual: z.number(),
	totalDifference: z.number(),
});

export const ShiftListItemSchema = z.object({
	id: z.string(),
	userId: z.string(),
	cashierName: z.string(),
	terminalName: z.string().nullable(),
	status: z.string(),
	startingCash: z.number(),
	openedAt: z.number(),
	closedAt: z.number().nullable(),
	notes: z.string().nullable(),
	operations: ShiftOperationsSchema,
	paymentBreakdown: ShiftPaymentBreakdownSchema.array(),
	payments: ShiftPaymentSchema.array(),
	movements: ShiftMovementSchema.array(),
	closures: ShiftClosureSchema.array(),
	totals: ShiftTotalsSchema,
});

export const ShiftFilterOptionsSchema = z.object({
	cashiers: z.array(
		z.object({
			id: z.string(),
			name: z.string(),
		}),
	),
	terminals: z.string().array(),
	paymentMethods: z.array(
		z.object({
			id: z.string(),
			label: z.string(),
		}),
	),
});

export const ListShiftsResultSchema = z.object({
	data: ShiftListItemSchema.array(),
	total: z.number(),
	hasMore: z.boolean(),
	nextCursor: z.number().nullable(),
	filterOptions: ShiftFilterOptionsSchema,
});

export const GetShiftByIdInputSchema = z.object({
	shiftId: z.string().trim().min(1),
});

export const ShiftDetailSchema = ShiftListItemSchema;

export const ActiveShiftSchema = z.object({
	id: z.string(),
	terminalName: z.string().nullable(),
	status: z.string(),
	openedAt: z.date(),
});

export const ActiveShiftResultSchema = z.object({
	shift: ActiveShiftSchema.nullable(),
});
