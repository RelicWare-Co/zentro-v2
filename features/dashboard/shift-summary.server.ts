import { and, asc, desc, eq } from "drizzle-orm";
import { organization } from "@/database/drizzle/schema/auth.schema";
import { shift } from "@/database/drizzle/schema/pos.schema";
import type {
  DashboardAuth,
  DashboardDbExecutor,
} from "@/features/dashboard/dashboard-helpers.server";

export function fetchOrganizationMetadata(
  db: DashboardDbExecutor,
  organizationId: string
) {
  return db
    .select({
      metadata: organization.metadata,
    })
    .from(organization)
    .where(eq(organization.id, organizationId))
    .limit(1);
}

export function fetchOpenShiftWindow(
  db: DashboardDbExecutor,
  auth: DashboardAuth
) {
  return db
    .select({
      id: shift.id,
      openedAt: shift.openedAt,
    })
    .from(shift)
    .where(
      and(
        eq(shift.organizationId, auth.organizationId),
        eq(shift.status, "open")
      )
    )
    .orderBy(asc(shift.openedAt));
}

export function fetchClosedShiftWindow(
  db: DashboardDbExecutor,
  auth: DashboardAuth
) {
  return db
    .select({
      id: shift.id,
      openedAt: shift.openedAt,
      closedAt: shift.closedAt,
    })
    .from(shift)
    .where(
      and(
        eq(shift.organizationId, auth.organizationId),
        eq(shift.status, "closed")
      )
    )
    .orderBy(desc(shift.closedAt))
    .limit(2);
}

export function fetchActiveShift(db: DashboardDbExecutor, auth: DashboardAuth) {
  return db
    .select({
      id: shift.id,
      terminalName: shift.terminalName,
      startingCash: shift.startingCash,
      openedAt: shift.openedAt,
    })
    .from(shift)
    .where(
      and(
        eq(shift.organizationId, auth.organizationId),
        eq(shift.userId, auth.userId),
        eq(shift.status, "open")
      )
    )
    .orderBy(desc(shift.openedAt))
    .limit(1);
}
