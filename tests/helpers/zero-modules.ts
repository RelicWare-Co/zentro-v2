import type { z } from "zod";
import type { SetModuleEntitlementSchema } from "@/features/modules/modules.schema";
import {
  buildModuleCapabilities,
  type ModuleEntitlementRow,
} from "@/features/settings/organization-environment.shared";
import { parseOrganizationSettingsMetadata } from "@/features/settings/settings.shared";
import { serverMutators } from "@/zero/mutators.server";
import { queries } from "@/zero/queries";
import type { ZeroContext } from "@/zero/schema";
import type { createZeroTestDb } from "./zero-shifts";

type ZeroTestDb = ReturnType<typeof createZeroTestDb>;
type SetModuleEntitlementInput = z.infer<typeof SetModuleEntitlementSchema>;

export async function getModuleCapabilitiesViaZero({
  zeroDb,
  ctx,
}: {
  zeroDb: ZeroTestDb;
  ctx: ZeroContext;
}) {
  const [organizationRows, entitlementRows] = await Promise.all([
    zeroDb.run(queries.modules.capabilities.fn({ args: undefined, ctx })),
    zeroDb.run(
      queries.organization.moduleEntitlements.fn({ args: undefined, ctx })
    ),
  ]);
  const organizationRow = organizationRows[0];
  if (!organizationRow) {
    throw new Error("No se encontró la organización activa.");
  }

  return buildModuleCapabilities({
    ctx,
    entitlementRows: entitlementRows as ModuleEntitlementRow[],
    settings: parseOrganizationSettingsMetadata(organizationRow.metadata),
  });
}

export async function setModuleEntitlementViaZero({
  zeroDb,
  ctx,
  input,
}: {
  zeroDb: ZeroTestDb;
  ctx: ZeroContext;
  input: SetModuleEntitlementInput;
}) {
  await zeroDb.transaction((tx) =>
    serverMutators.modules.setEntitlement.fn({
      args: input,
      ctx,
      tx,
    })
  );

  const capabilities = await getModuleCapabilitiesViaZero({ zeroDb, ctx });
  return capabilities.modules[input.moduleKey];
}
