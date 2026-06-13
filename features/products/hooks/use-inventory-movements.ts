import { useQuery as useZeroQuery } from "@rocicorp/zero/react";
import { useDeferredValue, useMemo, useRef } from "react";
import type { z } from "zod";
import type { ListInventoryMovementsInputSchema } from "@/features/products/inventory-movements.schema";
import {
  buildInventoryMovementsListPage,
  type InventoryMovementWithRelations,
  normalizeInventoryMovementsListLimit,
} from "@/features/products/inventory-movements.shared";
import { getZeroQueryError } from "@/lib/use-zero-mutation";
import { queries } from "@/zero/queries";

export type InventoryMovementsListParams = z.infer<
  typeof ListInventoryMovementsInputSchema
>;

function buildInventoryMovementsListQueryArgs(
  params: InventoryMovementsListParams
) {
  return {
    limit: normalizeInventoryMovementsListLimit(params.limit),
    cursor: params.cursor ?? null,
    productId: params.productId ?? null,
    type: params.type ?? null,
    searchQuery: params.searchQuery ?? null,
    startDate: params.startDate ?? null,
    endDate: params.endDate ?? null,
  };
}

export function useInventoryMovementsList(
  params: InventoryMovementsListParams = {}
) {
  const deferredParams = useDeferredValue(params);
  const listQueryArgs = useMemo(
    () => buildInventoryMovementsListQueryArgs(deferredParams),
    [deferredParams]
  );
  const [movementRows, movementStatus] = useZeroQuery(
    queries.products.movements.list(listQueryArgs)
  );
  const error = getZeroQueryError(movementStatus);

  const paginated = useMemo(
    () =>
      buildInventoryMovementsListPage(
        movementRows as InventoryMovementWithRelations[],
        listQueryArgs.limit
      ),
    [listQueryArgs.limit, movementRows]
  );

  const hasLoadedRef = useRef(false);
  const staleDataRef = useRef(paginated);

  const isQueryLoading =
    movementStatus.type === "unknown" && movementRows.length === 0;

  if (!isQueryLoading) {
    staleDataRef.current = paginated;
    hasLoadedRef.current = true;
  }

  const displayData = isQueryLoading ? staleDataRef.current : paginated;

  return {
    data: displayData,
    error,
    isError: Boolean(error),
    isLoading: isQueryLoading && !hasLoadedRef.current,
    isPlaceholderData:
      deferredParams !== params || (isQueryLoading && hasLoadedRef.current),
    isFetching:
      deferredParams !== params || (isQueryLoading && hasLoadedRef.current),
    refetch: () => {
      if (movementStatus.type === "error") {
        movementStatus.retry();
      }
      return Promise.resolve();
    },
  };
}
