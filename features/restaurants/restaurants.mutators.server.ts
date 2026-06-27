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
import { defineZentroMutator, requireOrgContext } from "@/zero/sdk";

export const restaurantsServerMutators = {
  addOrderItem: defineZentroMutator(
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
  updateOrderMeta: defineZentroMutator(
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
  updateDraftItem: defineZentroMutator(
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
  deleteDraftItem: defineZentroMutator(
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
  sendToKitchen: defineZentroMutator(
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
  updateItemStatus: defineZentroMutator(
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
  closeOrder: defineZentroMutator(
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
  createArea: defineZentroMutator(
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
  updateArea: defineZentroMutator(
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
  deleteArea: defineZentroMutator(
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
  createTable: defineZentroMutator(
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
  updateTable: defineZentroMutator(
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
  deleteTable: defineZentroMutator(
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
