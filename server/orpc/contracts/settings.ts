import { oc } from "@orpc/contract";
import {
  SettingsDataSchema,
  UpdateSettingsResultSchema,
  UpdateSettingsSchema,
} from "@/schemas/settings";

export const settingsContract = {
  get: oc
    .route({
      method: "GET",
      path: "/settings",
      summary: "Obtener ajustes de la organización activa",
      tags: ["Settings"],
    })
    .output(SettingsDataSchema),
  update: oc
    .route({
      method: "POST",
      path: "/settings",
      summary: "Actualizar ajustes de la organización activa",
      tags: ["Settings"],
    })
    .input(UpdateSettingsSchema)
    .output(UpdateSettingsResultSchema),
};
