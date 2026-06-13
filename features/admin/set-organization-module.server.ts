import { and, eq } from "drizzle-orm";
import type { z } from "zod";
import type { Database } from "@/database/drizzle/db";
import { organization } from "@/database/drizzle/schema/auth.schema";
import { organizationModuleEntitlement } from "@/database/drizzle/schema/feature.schema";
import type { AdminSetOrganizationModuleSchema } from "@/features/admin/admin.schema";
import {
  type AdminModuleState,
  buildAdminModuleStates,
} from "./admin-modules.server";

export type AdminSetModuleDbExecutor = Pick<
  Database,
  "select" | "insert" | "update"
>;

type AdminSetOrganizationModuleInput = z.infer<
  typeof AdminSetOrganizationModuleSchema
>;

/**
 * Unlike `runSetModuleEntitlement` (scoped to the caller's active org), this
 * targets an arbitrary organization so platform admins can manage any client
 * from the admin panel. Returns `null` when the organization does not exist.
 */
export async function runAdminSetOrganizationModule(
  db: AdminSetModuleDbExecutor,
  args: AdminSetOrganizationModuleInput & {
    organizationId: string;
    updatedByUserId: string;
  }
): Promise<AdminModuleState[] | null> {
  const [organizationRow] = await db
    .select({ metadata: organization.metadata })
    .from(organization)
    .where(eq(organization.id, args.organizationId))
    .limit(1);

  if (!organizationRow) {
    return null;
  }

  const now = new Date();
  const [existingRow] = await db
    .select({ id: organizationModuleEntitlement.id })
    .from(organizationModuleEntitlement)
    .where(
      and(
        eq(organizationModuleEntitlement.organizationId, args.organizationId),
        eq(organizationModuleEntitlement.moduleKey, args.moduleKey)
      )
    )
    .limit(1);

  if (existingRow) {
    await db
      .update(organizationModuleEntitlement)
      .set({
        status: args.status,
        updatedByUserId: args.updatedByUserId,
        updatedAt: now,
      })
      .where(eq(organizationModuleEntitlement.id, existingRow.id));
  } else {
    await db.insert(organizationModuleEntitlement).values({
      id: crypto.randomUUID(),
      organizationId: args.organizationId,
      moduleKey: args.moduleKey,
      status: args.status,
      updatedByUserId: args.updatedByUserId,
      createdAt: now,
      updatedAt: now,
    });
  }

  const entitlementRows = await db
    .select({
      moduleKey: organizationModuleEntitlement.moduleKey,
      status: organizationModuleEntitlement.status,
    })
    .from(organizationModuleEntitlement)
    .where(
      eq(organizationModuleEntitlement.organizationId, args.organizationId)
    );

  return buildAdminModuleStates(organizationRow.metadata, entitlementRows);
}
