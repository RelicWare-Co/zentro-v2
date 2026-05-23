import { defineMutator, defineMutators } from "@rocicorp/zero";
import type { CreditPaymentDbExecutor } from "@/server/credit/register-payment.server";
import { runRegisterCreditPayment } from "@/server/credit/register-payment.server";
import type { SetModuleEntitlementDbExecutor } from "@/server/modules/set-entitlement.server";
import { runSetModuleEntitlement } from "@/server/modules/set-entitlement.server";
import type { RestaurantDbExecutor } from "@/server/restaurants/restaurant-mutations.server";
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
} from "@/server/restaurants/restaurant-mutations.server";
import type { CancelSaleDbExecutor } from "@/server/sales/cancel-sale.server";
import { runCancelSale } from "@/server/sales/cancel-sale.server";
import type { CreateSaleDbExecutor } from "@/server/sales/create-sale.server";
import { runCreateSale } from "@/server/sales/create-sale.server";
import type { UpdateSettingsDbExecutor } from "@/server/settings/update-settings.server";
import { runUpdateOrganizationSettings } from "@/server/settings/update-settings.server";
import {
  addRestaurantOrderItemArgsSchema,
  cancelSaleArgsSchema,
  closeRestaurantOrderArgsSchema,
  createRestaurantAreaArgsSchema,
  createRestaurantTableArgsSchema,
  createSaleArgsSchema,
  deleteRestaurantAreaArgsSchema,
  deleteRestaurantDraftItemArgsSchema,
  deleteRestaurantTableArgsSchema,
  registerCreditPaymentArgsSchema,
  sendRestaurantOrderToKitchenArgsSchema,
  setModuleEntitlementArgsSchema,
  mutators as sharedMutators,
  updateOrganizationSettingsArgsSchema,
  updateRestaurantAreaArgsSchema,
  updateRestaurantDraftItemArgsSchema,
  updateRestaurantOrderItemStatusArgsSchema,
  updateRestaurantOrderMetaArgsSchema,
  updateRestaurantTableArgsSchema,
} from "./mutators";

export const serverMutators = defineMutators(sharedMutators, {
  credit: {
    registerPayment: defineMutator(
      registerCreditPaymentArgsSchema,
      async ({ tx, args, ctx }) => {
        if (!ctx) {
          throw new Error("No autorizado");
        }

        if (!("dbTransaction" in tx)) {
          throw new Error(
            "El registro de abonos de crédito solo puede ejecutarse en el servidor"
          );
        }

        const drizzleTx = tx.dbTransaction.wrappedTransaction;
        await runRegisterCreditPayment(
          drizzleTx as unknown as CreditPaymentDbExecutor,
          args,
          {
            organizationId: ctx.orgID,
            userId: ctx.id,
          }
        );
      }
    ),
  },
  sales: {
    create: defineMutator(createSaleArgsSchema, async ({ tx, args, ctx }) => {
      if (!ctx) {
        throw new Error("No autorizado");
      }

      if (!("dbTransaction" in tx)) {
        throw new Error(
          "La creación de ventas solo puede ejecutarse en el servidor"
        );
      }

      const drizzleTx = tx.dbTransaction.wrappedTransaction;
      await runCreateSale(drizzleTx as unknown as CreateSaleDbExecutor, args, {
        organizationId: ctx.orgID,
        userId: ctx.id,
      });
    }),
    cancel: defineMutator(cancelSaleArgsSchema, async ({ tx, args, ctx }) => {
      if (!ctx) {
        throw new Error("No autorizado");
      }

      if (!("dbTransaction" in tx)) {
        throw new Error(
          "La anulación de ventas solo puede ejecutarse en el servidor"
        );
      }

      const drizzleTx = tx.dbTransaction.wrappedTransaction;
      await runCancelSale(drizzleTx as unknown as CancelSaleDbExecutor, args, {
        organizationId: ctx.orgID,
        userId: ctx.id,
      });
    }),
  },
  organization: {
    updateSettings: defineMutator(
      updateOrganizationSettingsArgsSchema,
      async ({ tx, args, ctx }) => {
        if (!ctx) {
          throw new Error("No autorizado");
        }

        if (!("dbTransaction" in tx)) {
          throw new Error(
            "La actualización de configuración solo puede ejecutarse en el servidor"
          );
        }

        const drizzleTx = tx.dbTransaction.wrappedTransaction;
        await runUpdateOrganizationSettings(
          drizzleTx as unknown as UpdateSettingsDbExecutor,
          args,
          ctx
        );
      }
    ),
  },
  modules: {
    setEntitlement: defineMutator(
      setModuleEntitlementArgsSchema,
      async ({ tx, args, ctx }) => {
        if (!ctx) {
          throw new Error("No autorizado");
        }

        if (!("dbTransaction" in tx)) {
          throw new Error(
            "La actualización de entitlements solo puede ejecutarse en el servidor"
          );
        }

        const drizzleTx = tx.dbTransaction.wrappedTransaction;
        await runSetModuleEntitlement(
          drizzleTx as unknown as SetModuleEntitlementDbExecutor,
          args,
          ctx
        );
      }
    ),
  },
  restaurants: {
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
          { organizationId: ctx.orgID, userId: ctx.id }
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
          { organizationId: ctx.orgID, userId: ctx.id }
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
          { organizationId: ctx.orgID, userId: ctx.id }
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
          { organizationId: ctx.orgID, userId: ctx.id }
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
          { organizationId: ctx.orgID, userId: ctx.id }
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
          { organizationId: ctx.orgID, userId: ctx.id }
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
          { organizationId: ctx.orgID, userId: ctx.id }
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
          { organizationId: ctx.orgID, userId: ctx.id }
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
          { organizationId: ctx.orgID, userId: ctx.id }
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
          { organizationId: ctx.orgID, userId: ctx.id }
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
          { organizationId: ctx.orgID, userId: ctx.id }
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
          { organizationId: ctx.orgID, userId: ctx.id }
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
          { organizationId: ctx.orgID, userId: ctx.id }
        );
      }
    ),
  },
});

export type ServerMutators = typeof serverMutators;
