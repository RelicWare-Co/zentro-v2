import { describe, expect, test } from "bun:test";
import {
  buildOrderItemUpdateInput,
  createItemMutationQueue,
} from "@/features/pos/table-order-item-edits.shared";

describe("table order item edits", () => {
  test("keeps a locally incremented quantity when saving a note before replication", () => {
    expect(
      buildOrderItemUpdateInput({
        itemId: "item_1",
        replicatedQuantity: 1,
        quantityOverrides: { item_1: 2 },
        notes: "Sin cebolla",
      })
    ).toEqual({
      orderItemId: "item_1",
      quantity: 2,
      notes: "Sin cebolla",
    });
  });

  test("serializes quantity and note mutations for the same item", async () => {
    const queue = createItemMutationQueue();
    const started: string[] = [];
    let releaseQuantityMutation: (() => void) | undefined;

    const quantityMutation = queue.enqueue("item_1", async () => {
      started.push("quantity");
      await new Promise<void>((resolve) => {
        releaseQuantityMutation = resolve;
      });
    });
    const noteMutation = queue.enqueue("item_1", () => {
      started.push("note");
      return Promise.resolve();
    });

    await Promise.resolve();
    expect(started).toEqual(["quantity"]);

    releaseQuantityMutation?.();
    await Promise.all([quantityMutation, noteMutation]);
    expect(started).toEqual(["quantity", "note"]);
  });
});
