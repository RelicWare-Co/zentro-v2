import {
	index,
	integer,
	sqliteTable,
	text,
	uniqueIndex,
} from "drizzle-orm/sqlite-core";
import { organization, user } from "./auth.schema";

export const organizationModuleEntitlement = sqliteTable(
	"organization_module_entitlement",
	{
		id: text("id").primaryKey(),
		organizationId: text("organization_id")
			.notNull()
			.references(() => organization.id, { onDelete: "cascade" }),
		moduleKey: text("module_key").notNull(),
		status: text("status").notNull().default("granted"),
		updatedByUserId: text("updated_by_user_id").references(() => user.id, {
			onDelete: "set null",
		}),
		createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
		updatedAt: integer("updated_at", { mode: "timestamp_ms" })
			.$onUpdate(() => new Date())
			.notNull(),
	},
	(table) => [
		index("orgModuleEntitlement_organizationId_idx").on(table.organizationId),
		uniqueIndex("orgModuleEntitlement_org_module_uidx").on(
			table.organizationId,
			table.moduleKey,
		),
	],
);
