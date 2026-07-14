export type ItemQuantityOverrides = Record<string, number>;

export function createItemMutationQueue() {
  const tails = new Map<string, Promise<void>>();

  return {
    clear() {
      tails.clear();
    },
    enqueue(itemId: string, mutation: () => Promise<void>) {
      const previous = tails.get(itemId) ?? Promise.resolve();
      const next = previous.then(mutation, mutation);
      tails.set(
        itemId,
        next.catch(() => undefined)
      );
      return next;
    },
    async waitForAll() {
      await Promise.all(tails.values());
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
