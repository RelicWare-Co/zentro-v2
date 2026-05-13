import { implement, ORPCError } from "@orpc/server";
import { and, eq, inArray } from "drizzle-orm";
import type { dbSqlite } from "../../../database/drizzle/db";
import {
  member,
  organization,
  user as userTable,
} from "../../../database/drizzle/schema/auth.schema";
import { organizationModuleEntitlement } from "../../../database/drizzle/schema/feature.schema";
import {
  isModuleEntitled,
  MODULE_KEYS,
  type ModuleAccessState,
  type ModuleEntitlementStatus,
  type ModuleKey,
} from "../../../features/modules/module-access.shared";
import { getModuleDefinition } from "../../../features/modules/module-registry";
import { parseOrganizationSettingsMetadata } from "../../../features/settings/settings.shared";
import {
  isOrganizationManagerRole,
  isPlatformAdminRole,
} from "../../organization/access-control.shared";
import type { AppContext } from "../context";
import { modulesContract } from "../contracts/modules";
import { authMiddleware } from "../middlewares/auth";
import { dbMiddleware } from "../middlewares/db";
import { requireOrgMiddleware } from "../middlewares/require-org";

const modulesImplementer = implement(modulesContract).$context<AppContext>();

const orgRequiredProcedure = modulesImplementer
  .use(dbMiddleware)
  .use(authMiddleware)
  .use(requireOrgMiddleware);

async function getModuleAccessEnvironment(context: {
  db: ReturnType<typeof dbSqlite>;
  organizationId: string;
  user: { id: string; role?: string | null };
}) {
  const [memberRow, userRow, organizationRow, entitlementRows] =
    await Promise.all([
      context.db
        .select({ role: member.role })
        .from(member)
        .where(
          and(
            eq(member.organizationId, context.organizationId),
            eq(member.userId, context.user.id)
          )
        )
        .limit(1)
        .then((rows) => rows[0] ?? null),
      context.db
        .select({ role: userTable.role })
        .from(userTable)
        .where(eq(userTable.id, context.user.id))
        .limit(1)
        .then((rows) => rows[0] ?? null),
      context.db
        .select({ metadata: organization.metadata })
        .from(organization)
        .where(eq(organization.id, context.organizationId))
        .limit(1)
        .then((rows) => rows[0] ?? null),
      context.db
        .select({
          moduleKey: organizationModuleEntitlement.moduleKey,
          status: organizationModuleEntitlement.status,
        })
        .from(organizationModuleEntitlement)
        .where(
          and(
            eq(
              organizationModuleEntitlement.organizationId,
              context.organizationId
            ),
            inArray(organizationModuleEntitlement.moduleKey, MODULE_KEYS)
          )
        ),
    ]);

  if (!memberRow) {
    throw new ORPCError("FORBIDDEN", {
      message: "No perteneces a la organización activa.",
    });
  }

  const platformRole = userRow?.role ?? context.user.role ?? null;

  return {
    settings: parseOrganizationSettingsMetadata(organizationRow?.metadata),
    access: {
      organizationRole: memberRow.role,
      isOrganizationManager: isOrganizationManagerRole(memberRow.role),
      isPlatformAdmin: isPlatformAdminRole(platformRole),
    },
    entitlementStatusByKey: new Map<ModuleKey, ModuleEntitlementStatus>(
      entitlementRows.map((row) => [
        row.moduleKey as ModuleKey,
        row.status as ModuleEntitlementStatus,
      ])
    ),
  };
}

function resolveModuleAccessState(
  environment: Awaited<ReturnType<typeof getModuleAccessEnvironment>>,
  moduleKey: ModuleKey
): ModuleAccessState {
  const definition = getModuleDefinition(moduleKey);
  const entitlementStatus =
    environment.entitlementStatusByKey.get(moduleKey) ??
    definition.defaultEntitlementStatus;
  const entitlementGranted = isModuleEntitled(entitlementStatus);
  const enabled = definition.getEnabled(environment.settings);
  const flags = definition.getFlags(environment.settings);
  const requiresPlatformAdmin =
    definition.activationPolicy === "platform_admin_only";
  const canManageToggle =
    environment.access.isOrganizationManager &&
    definition.activationPolicy !== "platform_admin_only" &&
    entitlementGranted;
  const accessible = entitlementGranted && enabled;

  return {
    key: moduleKey,
    label: definition.label,
    entitlementStatus,
    activationPolicy: definition.activationPolicy,
    enabled,
    accessible,
    canManageToggle,
    requiresPlatformAdmin,
    flags,
    navigation: definition.getNavigation({
      settings: environment.settings,
      accessible,
      flags,
    }),
  };
}

export const capabilities = orgRequiredProcedure.capabilities.handler(
  async ({ context }) => {
    const environment = await getModuleAccessEnvironment({
      db: context.db,
      organizationId: context.organizationId,
      user: context.user,
    });

    const modules = Object.fromEntries(
      MODULE_KEYS.map((moduleKey) => [
        moduleKey,
        resolveModuleAccessState(environment, moduleKey),
      ])
    ) as Record<ModuleKey, ModuleAccessState>;

    return {
      viewer: environment.access,
      modules,
    };
  }
);

export const setEntitlement = orgRequiredProcedure.setEntitlement.handler(
  async ({ input, context }) => {
    const environment = await getModuleAccessEnvironment({
      db: context.db,
      organizationId: context.organizationId,
      user: context.user,
    });

    if (!environment.access.isPlatformAdmin) {
      throw new ORPCError("FORBIDDEN", {
        message: "Esta acción requiere permisos de administrador de la app.",
      });
    }

    const now = new Date();
    const [existingRow] = await context.db
      .select({ id: organizationModuleEntitlement.id })
      .from(organizationModuleEntitlement)
      .where(
        and(
          eq(
            organizationModuleEntitlement.organizationId,
            context.organizationId
          ),
          eq(organizationModuleEntitlement.moduleKey, input.moduleKey)
        )
      )
      .limit(1);

    if (existingRow) {
      await context.db
        .update(organizationModuleEntitlement)
        .set({
          status: input.status,
          updatedByUserId: context.user.id,
          updatedAt: now,
        })
        .where(eq(organizationModuleEntitlement.id, existingRow.id));
    } else {
      await context.db.insert(organizationModuleEntitlement).values({
        id: crypto.randomUUID(),
        organizationId: context.organizationId,
        moduleKey: input.moduleKey,
        status: input.status,
        updatedByUserId: context.user.id,
        createdAt: now,
        updatedAt: now,
      });
    }

    const nextEnvironment = await getModuleAccessEnvironment({
      db: context.db,
      organizationId: context.organizationId,
      user: context.user,
    });

    return resolveModuleAccessState(nextEnvironment, input.moduleKey);
  }
);
