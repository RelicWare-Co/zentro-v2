import {
  foreignKey,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { organization, user } from "./auth.schema";

export const organizationModuleEntitlement = pgTable(
  "organization_module_entitlement",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id").notNull(),
    moduleKey: text("module_key").notNull(),
    status: text("status").notNull().default("granted"),
    updatedByUserId: text("updated_by_user_id"),
    createdAt: timestamp("created_at", {
      withTimezone: true,
      mode: "date",
    }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    foreignKey({
      name: "org_mod_ent_org_fk",
      columns: [table.organizationId],
      foreignColumns: [organization.id],
    }).onDelete("cascade"),
    foreignKey({
      name: "org_mod_ent_upd_by_fk",
      columns: [table.updatedByUserId],
      foreignColumns: [user.id],
    }).onDelete("set null"),
    uniqueIndex("orgModuleEntitlement_org_module_uidx").on(
      table.organizationId,
      table.moduleKey
    ),
  ]
);
