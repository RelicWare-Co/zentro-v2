import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { implement, ORPCError } from "@orpc/server";
import {
	invitation,
	member,
	organization,
	user as userTable,
} from "../../../database/drizzle/schema/auth.schema";
import { customer } from "../../../database/drizzle/schema/customer.schema";
import { organizationModuleEntitlement } from "../../../database/drizzle/schema/feature.schema";
import { product } from "../../../database/drizzle/schema/inventory.schema";
import { dbSqlite } from "../../../database/drizzle/db";
import type { AppContext } from "../context";
import {
	isOrganizationManagerRole,
	isPlatformAdminRole,
} from "../../organization/access-control.shared";
import {
	isModuleEntitled,
	MODULE_KEYS,
	type ModuleAccessState,
	type ModuleEntitlementStatus,
	type ModuleKey,
} from "../../../features/modules/module-access.shared";
import { getModuleDefinition } from "../../../features/modules/module-registry";
import { getRestaurantModuleToggleSettings } from "../../../features/restaurants/restaurants.module";
import {
	normalizeOrganizationSettings,
	parseOrganizationSettingsMetadata,
	serializeOrganizationSettingsMetadata,
} from "../../../features/settings/settings.shared";
import { settingsContract } from "../contracts/settings";
import { authMiddleware } from "../middlewares/auth";
import { dbMiddleware } from "../middlewares/db";
import { requireOrgMiddleware } from "../middlewares/require-org";

const settingsImplementer = implement(settingsContract).$context<AppContext>();

const orgRequiredProcedure = settingsImplementer
	.use(dbMiddleware)
	.use(authMiddleware)
	.use(requireOrgMiddleware);

function toTimestamp(value: Date | number | string | null | undefined) {
	if (!value) return Date.now();
	if (value instanceof Date) return value.getTime();
	const dateValue = new Date(value);
	return Number.isNaN(dateValue.getTime()) ? Date.now() : dateValue.getTime();
}

function normalizeCount(value: unknown) {
	if (typeof value === "number") {
		return value;
	}
	if (typeof value === "string") {
		const parsedValue = Number(value);
		return Number.isFinite(parsedValue) ? parsedValue : 0;
	}
	return 0;
}

async function getSettingsEnvironment(context: {
	db: ReturnType<typeof dbSqlite>;
	organizationId: string;
	user: { id: string; role?: string | null };
}) {
	const [
		organizationRow,
		memberRow,
		userRow,
		entitlementRows,
		memberCountRows,
		invitationCountRows,
		productCountRows,
		customerCountRows,
	] = await Promise.all([
		context.db
			.select({
				id: organization.id,
				name: organization.name,
				slug: organization.slug,
				logo: organization.logo,
				metadata: organization.metadata,
				createdAt: organization.createdAt,
			})
			.from(organization)
			.where(eq(organization.id, context.organizationId))
			.limit(1)
			.then((rows) => rows[0] ?? null),
		context.db
			.select({ role: member.role })
			.from(member)
			.where(
				and(
					eq(member.organizationId, context.organizationId),
					eq(member.userId, context.user.id),
				),
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
			.select({
				moduleKey: organizationModuleEntitlement.moduleKey,
				status: organizationModuleEntitlement.status,
			})
			.from(organizationModuleEntitlement)
			.where(
				and(
					eq(
						organizationModuleEntitlement.organizationId,
						context.organizationId,
					),
					inArray(organizationModuleEntitlement.moduleKey, MODULE_KEYS),
				),
			),
		context.db
			.select({ count: sql<number>`count(*)` })
			.from(member)
			.where(eq(member.organizationId, context.organizationId)),
		context.db
			.select({ count: sql<number>`count(*)` })
			.from(invitation)
			.where(eq(invitation.organizationId, context.organizationId)),
		context.db
			.select({ count: sql<number>`count(*)` })
			.from(product)
			.where(
				and(
					eq(product.organizationId, context.organizationId),
					isNull(product.deletedAt),
				),
			),
		context.db
			.select({ count: sql<number>`count(*)` })
			.from(customer)
			.where(
				and(
					eq(customer.organizationId, context.organizationId),
					isNull(customer.deletedAt),
				),
			),
	]);

	if (!organizationRow) {
		throw new ORPCError("NOT_FOUND", {
			message: "No se encontró la organización activa.",
		});
	}

	if (!memberRow) {
		throw new ORPCError("FORBIDDEN", {
			message: "No perteneces a la organización activa.",
		});
	}

	const settings = parseOrganizationSettingsMetadata(organizationRow.metadata);
	const platformRole = userRow?.role ?? context.user.role ?? null;
	const access = {
		organizationRole: memberRow.role,
		isOrganizationManager: isOrganizationManagerRole(memberRow.role),
		isPlatformAdmin: isPlatformAdminRole(platformRole),
	};
	const entitlementStatusByKey = new Map<ModuleKey, ModuleEntitlementStatus>(
		entitlementRows.map((row) => [
			row.moduleKey as ModuleKey,
			row.status as ModuleEntitlementStatus,
		]),
	);

	const modules = Object.fromEntries(
		MODULE_KEYS.map((moduleKey) => {
			const definition = getModuleDefinition(moduleKey);
			const entitlementStatus =
				entitlementStatusByKey.get(moduleKey) ??
				definition.defaultEntitlementStatus;
			const entitlementGranted = isModuleEntitled(entitlementStatus);
			const enabled = definition.getEnabled(settings);
			const flags = definition.getFlags(settings);
			const requiresPlatformAdmin =
				definition.activationPolicy === "platform_admin_only";
			const canManageToggle =
				access.isOrganizationManager &&
				definition.activationPolicy !== "platform_admin_only" &&
				entitlementGranted;
			const accessible = entitlementGranted && enabled;

			return [
				moduleKey,
				{
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
						settings,
						accessible,
						flags,
					}),
				} satisfies ModuleAccessState,
			];
		}),
	) as unknown as Record<ModuleKey, ModuleAccessState>;

	return {
		organization: organizationRow,
		settings,
		modules,
		access,
		stats: {
			membersCount: normalizeCount(memberCountRows[0]?.count),
			invitationsCount: normalizeCount(invitationCountRows[0]?.count),
			productsCount: normalizeCount(productCountRows[0]?.count),
			customersCount: normalizeCount(customerCountRows[0]?.count),
		},
	};
}

export const get = orgRequiredProcedure.get.handler(async ({ context }) => {
	const environment = await getSettingsEnvironment({
		db: context.db,
		organizationId: context.organizationId,
		user: context.user,
	});

	return {
		organization: {
			id: environment.organization.id,
			name: environment.organization.name,
			slug: environment.organization.slug,
			logo: environment.organization.logo,
			createdAt: toTimestamp(environment.organization.createdAt),
		},
		stats: environment.stats,
		viewer: {
			canManageSettings: environment.access.isOrganizationManager,
			isPlatformAdmin: environment.access.isPlatformAdmin,
		},
		modules: environment.modules,
		settings: environment.settings,
	};
});

export const update = orgRequiredProcedure.update.handler(
	async ({ input, context }) => {
		const environment = await getSettingsEnvironment({
			db: context.db,
			organizationId: context.organizationId,
			user: context.user,
		});

		if (!environment.access.isOrganizationManager) {
			throw new ORPCError("FORBIDDEN", {
				message:
					"Necesitas rol admin u owner para cambiar la configuración.",
			});
		}

		const normalizedSettings = normalizeOrganizationSettings(input.settings);
		const isRestaurantToggleChanging =
			getRestaurantModuleToggleSettings(normalizedSettings).enabled !==
			getRestaurantModuleToggleSettings(environment.settings).enabled;

		if (
			isRestaurantToggleChanging &&
			!environment.modules.restaurants.canManageToggle
		) {
			throw new ORPCError("FORBIDDEN", {
				message:
					"No puedes cambiar la activación del módulo de restaurantes.",
			});
		}

		await context.db
			.update(organization)
			.set({
				metadata: serializeOrganizationSettingsMetadata(normalizedSettings),
			})
			.where(eq(organization.id, context.organizationId));

		return {
			success: true,
			settings: normalizedSettings,
		};
	},
);
