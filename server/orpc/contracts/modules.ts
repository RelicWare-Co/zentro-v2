import { oc } from "@orpc/contract";
import {
  ModuleAccessStateSchema,
  OrganizationCapabilitiesSchema,
  SetModuleEntitlementSchema,
} from "@/schemas/modules";

export const modulesContract = {
  capabilities: oc
    .route({
      method: "GET",
      path: "/modules/capabilities",
      summary: "Capacidades y navegación de módulos",
      tags: ["Modules"],
    })
    .output(OrganizationCapabilitiesSchema),
  setEntitlement: oc
    .route({
      method: "POST",
      path: "/modules/entitlement",
      summary: "Actualizar entitlement de un módulo",
      tags: ["Modules"],
    })
    .input(SetModuleEntitlementSchema)
    .output(ModuleAccessStateSchema),
};
