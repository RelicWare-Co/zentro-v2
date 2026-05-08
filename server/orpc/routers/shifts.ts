import { and, eq } from "drizzle-orm";
import { implement } from "@orpc/server";
import type { dbSqlite } from "../../../database/drizzle/db";
import { shift } from "../../../database/drizzle/schema/pos.schema";
import { shiftsContract } from "../contracts/shifts";
import { authMiddleware } from "../middlewares/auth";
import { dbMiddleware } from "../middlewares/db";
import { requireOrgMiddleware } from "../middlewares/require-org";

const shiftsImplementer = implement(shiftsContract).$context<{
	headers: Headers;
	db: ReturnType<typeof dbSqlite>;
}>();

const orgRequiredProcedure = shiftsImplementer
	.use(dbMiddleware)
	.use(authMiddleware)
	.use(requireOrgMiddleware);

export const active = orgRequiredProcedure.active.handler(
	async ({ context }) => {
		const activeShift = await context.db
			.select({
				id: shift.id,
				terminalName: shift.terminalName,
				status: shift.status,
				openedAt: shift.openedAt,
			})
			.from(shift)
			.where(
				and(
					eq(shift.organizationId, context.organizationId),
					eq(shift.userId, context.user.id),
					eq(shift.status, "open"),
				),
			)
			.limit(1)
			.then((rows) => rows[0] ?? null);

		return { shift: activeShift };
	},
);
