import { z } from "zod";
import { MODULE_KEYS } from "@/features/modules/module-registry";

export const ModuleKeySchema = z.enum(MODULE_KEYS);

const ModuleEntitlementStatusSchema = z.enum(["granted", "blocked"]);

const ModuleNavigationItemSchema = z.object({
  id: z.string(),
  label: z.string(),
  path: z.string(),
  order: z.number(),
  icon: z.string(),
});

export const ModuleAccessStateSchema = z.object({
  key: ModuleKeySchema,
  label: z.string(),
  entitlementStatus: ModuleEntitlementStatusSchema,
  activationPolicy: z.enum([
    "self_service",
    "entitled_self_service",
    "platform_admin_only",
  ]),
  enabled: z.boolean(),
  accessible: z.boolean(),
  canManageToggle: z.boolean(),
  requiresPlatformAdmin: z.boolean(),
  flags: z.record(z.string(), z.boolean()),
  navigation: z.array(ModuleNavigationItemSchema),
});

export const OrganizationCapabilitiesSchema = z.object({
  viewer: z.object({
    organizationRole: z.string(),
    isOrganizationManager: z.boolean(),
    isPlatformAdmin: z.boolean(),
  }),
  modules: z.record(ModuleKeySchema, ModuleAccessStateSchema),
});

export const SetModuleEntitlementSchema = z.object({
  moduleKey: ModuleKeySchema,
  status: ModuleEntitlementStatusSchema,
});
