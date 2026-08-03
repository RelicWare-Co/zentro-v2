export type ItemQuantityOverrides = Record<string, number>;

export function createItemMutationQueue() {
  const tails = new Map<string, Promise<void>>();
  const pendingMutations = new Set<Promise<void>>();

  const waitForPendingMutations = async () => {
    while (pendingMutations.size > 0) {
      await Promise.all(pendingMutations);
    }
  };

  return {
    clear() {
      tails.clear();
    },
    enqueue(itemId: string, mutation: () => Promise<void>) {
      const previous = tails.get(itemId) ?? Promise.resolve();
      const next = previous.then(mutation, mutation);
      const settled = next.catch(() => undefined);
      tails.set(itemId, settled);
      pendingMutations.add(settled);
      settled.finally(() => pendingMutations.delete(settled));
      return next;
    },
    hasPending() {
      return pendingMutations.size > 0;
    },
    async waitForAll() {
      await waitForPendingMutations();
    },
    async drain() {
      await waitForPendingMutations();
      tails.clear();
    },
  };
}

export function getEffectiveItemQuantity(
  itemId: string,
  replicatedQuantity: number,
  quantityOverrides: ItemQuantityOverrides
) {
  return quantityOverrides[itemId] ?? replicatedQuantity;
}

export function buildOrderItemUpdateInput(params: {
  itemId: string;
  notes: string | null | undefined;
  quantityOverrides: ItemQuantityOverrides;
  replicatedQuantity: number;
}) {
  return {
    orderItemId: params.itemId,
    quantity: getEffectiveItemQuantity(
      params.itemId,
      params.replicatedQuantity,
      params.quantityOverrides
    ),
    notes: params.notes,
  };
}
