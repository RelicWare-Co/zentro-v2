import { z } from "zod";

export const ActiveShiftSchema = z.object({
	id: z.string(),
	terminalName: z.string().nullable(),
	status: z.string(),
	openedAt: z.date(),
});

export const ActiveShiftResultSchema = z.object({
	shift: ActiveShiftSchema.nullable(),
});
