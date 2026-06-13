import { defineMutator } from "@rocicorp/zero";
import type { RestaurantDbExecutor } from "@/features/restaurants/restaurant-mutations.server";
import {
  runAddRestaurantOrderItem,
  runCloseRestaurantOrder,
  runCreateRestaurantArea,
  runCreateRestaurantTable,
  runDeleteRestaurantArea,
  runDeleteRestaurantDraftItem,
  runDeleteRestaurantTable,
  runSendRestaurantOrderToKitchen,
  runUpdateRestaurantArea,
  runUpdateRestaurantDraftItem,
  runUpdateRestaurantOrderItemStatus,
  runUpdateRestaurantOrderMeta,
  runUpdateRestaurantTable,
} from "@/features/restaurants/restaurant-mutations.server";
import {
  addRestaurantOrderItemArgsSchema,
  closeRestaurantOrderArgsSchema,
  createRestaurantAreaArgsSchema,
  createRestaurantTableArgsSchema,
  deleteRestaurantAreaArgsSchema,
  deleteRestaurantDraftItemArgsSchema,
  deleteRestaurantTableArgsSchema,
  sendRestaurantOrderToKitchenArgsSchema,
  updateRestaurantAreaArgsSchema,
  updateRestaurantDraftItemArgsSchema,
  updateRestaurantOrderItemStatusArgsSchema,
  updateRestaurantOrderMetaArgsSchema,
  updateRestaurantTableArgsSchema,
} from "@/features/restaurants/restaurants.mutators";
import { requireOrgContext } from "@/zero/mutators.shared";

export const restaurantsServerMutators = {
  addOrderItem: defineMutator(
    addRestaurantOrderItemArgsSchema,
    async ({ tx, args, ctx }) => {
      if (!ctx) {
        throw new Error("No autorizado");
      }
      if (!("dbTransaction" in tx)) {
        throw new Error(
          "Las mutaciones de restaurantes solo pueden ejecutarse en el servidor"
        );
      }
      const drizzleTx = tx.dbTransaction.wrappedTransaction;
      await runAddRestaurantOrderItem(
        drizzleTx as unknown as RestaurantDbExecutor,
        args,
        { organizationId: requireOrgContext(ctx).orgID, userId: ctx.id }
      );
    }
  ),
  updateOrderMeta: defineMutator(
    updateRestaurantOrderMetaArgsSchema,
    async ({ tx, args, ctx }) => {
      if (!ctx) {
        throw new Error("No autorizado");
      }
      if (!("dbTransaction" in tx)) {
        throw new Error(
          "Las mutaciones de restaurantes solo pueden ejecutarse en el servidor"
        );
      }
      const drizzleTx = tx.dbTransaction.wrappedTransaction;
      await runUpdateRestaurantOrderMeta(
        drizzleTx as unknown as RestaurantDbExecutor,
        args,
        { organizationId: requireOrgContext(ctx).orgID, userId: ctx.id }
      );
    }
  ),
  updateDraftItem: defineMutator(
    updateRestaurantDraftItemArgsSchema,
    async ({ tx, args, ctx }) => {
      if (!ctx) {
        throw new Error("No autorizado");
      }
      if (!("dbTransaction" in tx)) {
        throw new Error(
          "Las mutaciones de restaurantes solo pueden ejecutarse en el servidor"
        );
      }
      const drizzleTx = tx.dbTransaction.wrappedTransaction;
      await runUpdateRestaurantDraftItem(
        drizzleTx as unknown as RestaurantDbExecutor,
        args,
        { organizationId: requireOrgContext(ctx).orgID, userId: ctx.id }
      );
    }
  ),
  deleteDraftItem: defineMutator(
    deleteRestaurantDraftItemArgsSchema,
    async ({ tx, args, ctx }) => {
      if (!ctx) {
        throw new Error("No autorizado");
      }
      if (!("dbTransaction" in tx)) {
        throw new Error(
          "Las mutaciones de restaurantes solo pueden ejecutarse en el servidor"
        );
      }
      const drizzleTx = tx.dbTransaction.wrappedTransaction;
      await runDeleteRestaurantDraftItem(
        drizzleTx as unknown as RestaurantDbExecutor,
        args,
        { organizationId: requireOrgContext(ctx).orgID, userId: ctx.id }
      );
    }
  ),
  sendToKitchen: defineMutator(
    sendRestaurantOrderToKitchenArgsSchema,
    async ({ tx, args, ctx }) => {
      if (!ctx) {
        throw new Error("No autorizado");
      }
      if (!("dbTransaction" in tx)) {
        throw new Error(
          "Las mutaciones de restaurantes solo pueden ejecutarse en el servidor"
        );
      }
      const drizzleTx = tx.dbTransaction.wrappedTransaction;
      await runSendRestaurantOrderToKitchen(
        drizzleTx as unknown as RestaurantDbExecutor,
        args,
        { organizationId: requireOrgContext(ctx).orgID, userId: ctx.id }
      );
    }
  ),
  updateItemStatus: defineMutator(
    updateRestaurantOrderItemStatusArgsSchema,
    async ({ tx, args, ctx }) => {
      if (!ctx) {
        throw new Error("No autorizado");
      }
      if (!("dbTransaction" in tx)) {
        throw new Error(
          "Las mutaciones de restaurantes solo pueden ejecutarse en el servidor"
        );
      }
      const drizzleTx = tx.dbTransaction.wrappedTransaction;
      await runUpdateRestaurantOrderItemStatus(
        drizzleTx as unknown as RestaurantDbExecutor,
        args,
        { organizationId: requireOrgContext(ctx).orgID, userId: ctx.id }
      );
    }
  ),
  closeOrder: defineMutator(
    closeRestaurantOrderArgsSchema,
    async ({ tx, args, ctx }) => {
      if (!ctx) {
        throw new Error("No autorizado");
      }
      if (!("dbTransaction" in tx)) {
        throw new Error(
          "Las mutaciones de restaurantes solo pueden ejecutarse en el servidor"
        );
      }
      const drizzleTx = tx.dbTransaction.wrappedTransaction;
      await runCloseRestaurantOrder(
        drizzleTx as unknown as RestaurantDbExecutor,
        args,
        { organizationId: requireOrgContext(ctx).orgID, userId: ctx.id }
      );
    }
  ),
  createArea: defineMutator(
    createRestaurantAreaArgsSchema,
    async ({ tx, args, ctx }) => {
      if (!ctx) {
        throw new Error("No autorizado");
      }
      if (!("dbTransaction" in tx)) {
        throw new Error(
          "Las mutaciones de restaurantes solo pueden ejecutarse en el servidor"
        );
      }
      const drizzleTx = tx.dbTransaction.wrappedTransaction;
      await runCreateRestaurantArea(
        drizzleTx as unknown as RestaurantDbExecutor,
        args,
        { organizationId: requireOrgContext(ctx).orgID, userId: ctx.id }
      );
    }
  ),
  updateArea: defineMutator(
    updateRestaurantAreaArgsSchema,
    async ({ tx, args, ctx }) => {
      if (!ctx) {
        throw new Error("No autorizado");
      }
      if (!("dbTransaction" in tx)) {
        throw new Error(
          "Las mutaciones de restaurantes solo pueden ejecutarse en el servidor"
        );
      }
      const drizzleTx = tx.dbTransaction.wrappedTransaction;
      await runUpdateRestaurantArea(
        drizzleTx as unknown as RestaurantDbExecutor,
        args,
        { organizationId: requireOrgContext(ctx).orgID, userId: ctx.id }
      );
    }
  ),
  deleteArea: defineMutator(
    deleteRestaurantAreaArgsSchema,
    async ({ tx, args, ctx }) => {
      if (!ctx) {
        throw new Error("No autorizado");
      }
      if (!("dbTransaction" in tx)) {
        throw new Error(
          "Las mutaciones de restaurantes solo pueden ejecutarse en el servidor"
        );
      }
      const drizzleTx = tx.dbTransaction.wrappedTransaction;
      await runDeleteRestaurantArea(
        drizzleTx as unknown as RestaurantDbExecutor,
        args,
        { organizationId: requireOrgContext(ctx).orgID, userId: ctx.id }
      );
    }
  ),
  createTable: defineMutator(
    createRestaurantTableArgsSchema,
    async ({ tx, args, ctx }) => {
      if (!ctx) {
        throw new Error("No autorizado");
      }
      if (!("dbTransaction" in tx)) {
        throw new Error(
          "Las mutaciones de restaurantes solo pueden ejecutarse en el servidor"
        );
      }
      const drizzleTx = tx.dbTransaction.wrappedTransaction;
      await runCreateRestaurantTable(
        drizzleTx as unknown as RestaurantDbExecutor,
        args,
        { organizationId: requireOrgContext(ctx).orgID, userId: ctx.id }
      );
    }
  ),
  updateTable: defineMutator(
    updateRestaurantTableArgsSchema,
    async ({ tx, args, ctx }) => {
      if (!ctx) {
        throw new Error("No autorizado");
      }
      if (!("dbTransaction" in tx)) {
        throw new Error(
          "Las mutaciones de restaurantes solo pueden ejecutarse en el servidor"
        );
      }
      const drizzleTx = tx.dbTransaction.wrappedTransaction;
      await runUpdateRestaurantTable(
        drizzleTx as unknown as RestaurantDbExecutor,
        args,
        { organizationId: requireOrgContext(ctx).orgID, userId: ctx.id }
      );
    }
  ),
  deleteTable: defineMutator(
    deleteRestaurantTableArgsSchema,
    async ({ tx, args, ctx }) => {
      if (!ctx) {
        throw new Error("No autorizado");
      }
      if (!("dbTransaction" in tx)) {
        throw new Error(
          "Las mutaciones de restaurantes solo pueden ejecutarse en el servidor"
        );
      }
      const drizzleTx = tx.dbTransaction.wrappedTransaction;
      await runDeleteRestaurantTable(
        drizzleTx as unknown as RestaurantDbExecutor,
        args,
        { organizationId: requireOrgContext(ctx).orgID, userId: ctx.id }
      );
    }
  ),
};
