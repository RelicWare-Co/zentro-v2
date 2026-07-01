import type { ModuleAccessState } from "@/features/modules/module-access.shared";
import { MODULE_KEYS, type ModuleKey } from "@/features/modules/module-keys";
import { getModuleDefinition } from "@/features/modules/module-registry";
import type { PosExtension } from "@/features/pos/pos-extension.shared";

export function usePosExtensions(
  moduleAccess: Record<ModuleKey, ModuleAccessState> | undefined
): PosExtension[] {
  return MODULE_KEYS.flatMap((moduleKey) => {
    const access = moduleAccess?.[moduleKey];
    if (!access) {
      return [];
    }
    const definition = getModuleDefinition(moduleKey);
    return (
      definition.getPosExtensions?.({
        accessible: access.accessible,
        flags: access.flags as never,
      }) ?? []
    );
  });
}
