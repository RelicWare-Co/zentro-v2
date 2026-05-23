import { zeroDrizzle } from "@rocicorp/zero/server/adapters/drizzle";
import type { z } from "zod";
import { buildOrganizationAccessPolicy } from "@/features/organization/organization-policy.shared";
import {
  buildShiftCloseSummary,
  buildShiftListItem,
  filterShifts,
  paginateShifts,
  type ShiftsListParams,
  type ShiftWithRelations,
} from "@/features/shifts/shifts.shared";
import type {
  CloseShiftInputSchema,
  OpenShiftInputSchema,
  RegisterCashMovementInputSchema,
} from "@/schemas/pos";
import { serverMutators } from "@/src/zero/mutators.server";
import { queries } from "@/src/zero/queries";
import { type ZeroContext, schema as zeroSchema } from "@/src/zero/schema";
import type { TestDb } from "./test-db";

type OpenShiftInput = z.infer<typeof OpenShiftInputSchema>;
type CloseShiftInput = z.infer<typeof CloseShiftInputSchema>;
type RegisterCashMovementInput = z.infer<
  typeof RegisterCashMovementInputSchema
>;

export function createZeroContext(
  userId: string,
  organizationId: string,
  options?: Partial<Pick<ZeroContext, "role" | "systemRole" | "email">>
) {
  return {
    id: userId,
    orgID: organizationId,
    email: options?.email ?? "test@example.com",
    role: options?.role ?? "owner",
    systemRole: options?.systemRole ?? null,
    organizationPolicy: buildOrganizationAccessPolicy({
      role: options?.systemRole ?? null,
    }),
  } satisfies ZeroContext;
}

export function createZeroTestDb(db: TestDb) {
  return zeroDrizzle(zeroSchema, db);
}

export async function openShiftViaZero({
  zeroDb,
  ctx,
  input,
}: {
  zeroDb: ReturnType<typeof createZeroTestDb>;
  ctx: ZeroContext;
  input: OpenShiftInput;
}) {
  const id = crypto.randomUUID();
  await zeroDb.transaction((tx) =>
    serverMutators.shifts.open.fn({
      args: {
        ...input,
        id,
      },
      ctx,
      tx,
    })
  );

  const openedAt = input.openedAt ?? Date.now();
  return {
    id,
    status: "open" as const,
    startingCash: input.startingCash,
    openedAt,
  };
}

export async function registerCashMovementViaZero({
  zeroDb,
  ctx,
  input,
}: {
  zeroDb: ReturnType<typeof createZeroTestDb>;
  ctx: ZeroContext;
  input: RegisterCashMovementInput;
}) {
  const id = crypto.randomUUID();
  await zeroDb.transaction((tx) =>
    serverMutators.shifts.cashMovement.fn({
      args: {
        ...input,
        id,
      },
      ctx,
      tx,
    })
  );

  return {
    id,
    shiftId: input.shiftId,
    type: input.type,
    paymentMethod: input.paymentMethod,
    amount: input.amount,
    description: input.description,
    createdAt: input.createdAt ?? Date.now(),
  };
}

export async function closeShiftViaZero({
  zeroDb,
  ctx,
  input,
}: {
  zeroDb: ReturnType<typeof createZeroTestDb>;
  ctx: ZeroContext;
  input: CloseShiftInput;
}) {
  await zeroDb.transaction((tx) =>
    serverMutators.shifts.close.fn({
      args: input,
      ctx,
      tx,
    })
  );

  const shiftRows = await zeroDb.run(
    queries.shifts.byId.fn({
      args: { shiftId: input.shiftId },
      ctx,
    })
  );
  const shiftRow = shiftRows[0] as
    | (Omit<ShiftWithRelations, "closures"> & {
        closures?: Array<{
          id: string;
          paymentMethod: string;
          expectedAmount: number;
          actualAmount: number;
          difference: number;
        }>;
      })
    | undefined;
  const closures = (shiftRow?.closures ?? []).map((closureRow) => ({
    id: closureRow.id,
    shiftId: input.shiftId,
    paymentMethod: closureRow.paymentMethod,
    expectedAmount: closureRow.expectedAmount,
    actualAmount: closureRow.actualAmount,
    difference: closureRow.difference,
  }));

  return {
    shiftId: input.shiftId,
    closedAt: input.closedAt ?? Date.now(),
    closures,
  };
}

export async function getShiftCloseSummaryViaZero({
  zeroDb,
  ctx,
  shiftId,
}: {
  zeroDb: ReturnType<typeof createZeroTestDb>;
  ctx: ZeroContext;
  shiftId: string;
}) {
  const [shiftRows, organizationRows] = await Promise.all([
    zeroDb.run(
      queries.shifts.byId.fn({
        args: { shiftId },
        ctx,
      })
    ),
    zeroDb.run(queries.shifts.organization.fn({ args: undefined, ctx })),
  ]);
  const shiftRow = shiftRows[0];

  if (!shiftRow) {
    throw new Error("Turno no encontrado para la organización activa");
  }

  return buildShiftCloseSummary(
    shiftRow,
    typeof organizationRows[0]?.metadata === "string"
      ? organizationRows[0]?.metadata
      : null
  );
}

export async function listShiftsViaZero({
  zeroDb,
  ctx,
  input = {},
}: {
  zeroDb: ReturnType<typeof createZeroTestDb>;
  ctx: ZeroContext;
  input?: ShiftsListParams;
}) {
  const [shiftRows] = await Promise.all([
    zeroDb.run(queries.shifts.byOrg.fn({ args: undefined, ctx })),
  ]);
  const normalizedShifts = shiftRows.map((shiftRow) =>
    buildShiftListItem(shiftRow)
  );
  const filteredShifts = filterShifts(normalizedShifts, input);
  const paginated = paginateShifts(filteredShifts, input);

  return paginated;
}

export async function getShiftDetailViaZero({
  zeroDb,
  ctx,
  shiftId,
}: {
  zeroDb: ReturnType<typeof createZeroTestDb>;
  ctx: ZeroContext;
  shiftId: string;
}) {
  const shiftRow = (
    await zeroDb.run(
      queries.shifts.byId.fn({
        args: { shiftId },
        ctx,
      })
    )
  )[0];
  if (!shiftRow) {
    throw new Error("Turno no encontrado para la organización activa");
  }
  return buildShiftListItem(shiftRow);
}
