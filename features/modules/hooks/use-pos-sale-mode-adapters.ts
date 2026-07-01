import { MODULE_KEYS, type ModuleKey } from "@/features/modules/module-keys";
import { getModuleDefinition } from "@/features/modules/module-registry";
import { useCounterSaleAdapter } from "@/features/pos/sale-modes/counter-sale-adapter";
import type {
  SaleModeAdapter,
  SaleModeFactoryParams,
} from "@/features/pos/sale-modes/types";
import type { ModuleAccessState } from "../module-access.shared";

interface UsePosSaleModeAdaptersParams extends SaleModeFactoryParams {
  moduleAccess: Record<ModuleKey, ModuleAccessState> | undefined;
}

export function usePosSaleModeAdapters(
  params: UsePosSaleModeAdaptersParams
): [SaleModeAdapter, ...SaleModeAdapter[]] {
  const counterAdapter = useCounterSaleAdapter(params);

  const moduleAdapters = MODULE_KEYS.flatMap((moduleKey) => {
    const definition = getModuleDefinition(moduleKey);
    const accessible = params.moduleAccess?.[moduleKey]?.accessible ?? false;
    const factories = definition.getPosSaleModes?.() ?? [];

    return factories.map((factory) =>
      // biome-ignore lint/correctness/useHookAtTopLevel: sale mode factories are collected from MODULE_KEYS in a static order; adapters receive `accessible` instead of being conditionally registered
      factory.useAdapter({
        ...params,
        accessible,
      })
    );
  });

  return [counterAdapter, ...moduleAdapters];
}
