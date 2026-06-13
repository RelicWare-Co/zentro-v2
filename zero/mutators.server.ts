import { defineMutator, defineMutators } from "@rocicorp/zero";
import type { CreditPaymentDbExecutor } from "@/features/credit/register-payment.server";
import { runRegisterCreditPayment } from "@/features/credit/register-payment.server";
import type { SetModuleEntitlementDbExecutor } from "@/features/modules/set-entitlement.server";
import { runSetModuleEntitlement } from "@/features/modules/set-entitlement.server";
import type { OrganizationDbExecutor } from "@/features/organization/organization-mutations.server";
import {
  runCancelInvitation,
  runDeleteOrganization,
  runInviteMember,
  runJoinLinkCreate,
  runJoinLinkRedeem,
  runJoinLinkRevoke,
  runLeaveOrganization,
  runRemoveMember,
  runUpdateMemberRole,
  runUpdateOrganization,
} from "@/features/organization/organization-mutations.server";
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
import type { CancelSaleDbExecutor } from "@/features/sales/cancel-sale.server";
import { runCancelSale } from "@/features/sales/cancel-sale.server";
import type { CreateSaleDbExecutor } from "@/features/sales/create-sale.server";
import { runCreateSale } from "@/features/sales/create-sale.server";
import type { UpdateSettingsDbExecutor } from "@/features/settings/update-settings.server";
import { runUpdateOrganizationSettings } from "@/features/settings/update-settings.server";
import type { ZeroContext } from "./context";
import {
  addRestaurantOrderItemArgsSchema,
  cancelInvitationArgsSchema,
  cancelSaleArgsSchema,
  closeRestaurantOrderArgsSchema,
  closeShiftArgsSchema,
  createJoinLinkArgsSchema,
  createRestaurantAreaArgsSchema,
  createRestaurantTableArgsSchema,
  createSaleArgsSchema,
  deleteOrganizationArgsSchema,
  deleteRestaurantAreaArgsSchema,
  deleteRestaurantDraftItemArgsSchema,
  deleteRestaurantTableArgsSchema,
  inviteMemberArgsSchema,
  joinLinkRedeemArgsSchema,
  leaveOrganizationArgsSchema,
  registerCreditPaymentArgsSchema,
  removeMemberArgsSchema,
  revokeJoinLinkArgsSchema,
  runCloseShiftServerMutator,
  sendRestaurantOrderToKitchenArgsSchema,
  setModuleEntitlementArgsSchema,
  mutators as sharedMutators,
  updateMemberRoleArgsSchema,
  updateOrganizationArgsSchema,
  updateOrganizationSettingsArgsSchema,
  updateRestaurantAreaArgsSchema,
  updateRestaurantDraftItemArgsSchema,
  updateRestaurantOrderItemStatusArgsSchema,
  updateRestaurantOrderMetaArgsSchema,
  updateRestaurantTableArgsSchema,
} from "./mutators";

function requireOrgContext(
  ctx: ZeroContext | undefined
): ZeroContext & { orgID: string } {
  if (!ctx?.orgID) {
    throw new Error("No autorizado");
  }

  return ctx as ZeroContext & { orgID: string };
}

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
            organizationId: requireOrgContext(ctx).orgID,
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
        organizationId: requireOrgContext(ctx).orgID,
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
        organizationId: requireOrgContext(ctx).orgID,
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

        const orgCtx = requireOrgContext(ctx);
        const drizzleTx = tx.dbTransaction.wrappedTransaction;
        await runUpdateOrganizationSettings(
          drizzleTx as unknown as UpdateSettingsDbExecutor,
          args,
          orgCtx
        );
      }
    ),
    joinLinkCreate: defineMutator(
      createJoinLinkArgsSchema,
      async ({ tx, args, ctx }) => {
        const orgCtx = requireOrgContext(ctx);
        if (!("dbTransaction" in tx)) {
          throw new Error(
            "Las mutaciones de organización solo pueden ejecutarse en el servidor"
          );
        }
        const drizzleTx = tx.dbTransaction.wrappedTransaction;
        await runJoinLinkCreate(
          drizzleTx as unknown as OrganizationDbExecutor,
          args,
          { organizationId: orgCtx.orgID, userId: orgCtx.id }
        );
      }
    ),
    joinLinkRevoke: defineMutator(
      revokeJoinLinkArgsSchema,
      async ({ tx, args, ctx }) => {
        const orgCtx = requireOrgContext(ctx);
        if (!("dbTransaction" in tx)) {
          throw new Error(
            "Las mutaciones de organización solo pueden ejecutarse en el servidor"
          );
        }
        const drizzleTx = tx.dbTransaction.wrappedTransaction;
        await runJoinLinkRevoke(
          drizzleTx as unknown as OrganizationDbExecutor,
          args,
          { organizationId: orgCtx.orgID, userId: orgCtx.id }
        );
      }
    ),
    inviteMember: defineMutator(
      inviteMemberArgsSchema,
      async ({ tx, args, ctx }) => {
        const orgCtx = requireOrgContext(ctx);
        if (!("dbTransaction" in tx)) {
          throw new Error(
            "Las mutaciones de organización solo pueden ejecutarse en el servidor"
          );
        }
        const drizzleTx = tx.dbTransaction.wrappedTransaction;
        await runInviteMember(
          drizzleTx as unknown as OrganizationDbExecutor,
          args,
          { organizationId: orgCtx.orgID, userId: orgCtx.id }
        );
      }
    ),
    cancelInvitation: defineMutator(
      cancelInvitationArgsSchema,
      async ({ tx, args, ctx }) => {
        const orgCtx = requireOrgContext(ctx);
        if (!("dbTransaction" in tx)) {
          throw new Error(
            "Las mutaciones de organización solo pueden ejecutarse en el servidor"
          );
        }
        const drizzleTx = tx.dbTransaction.wrappedTransaction;
        await runCancelInvitation(
          drizzleTx as unknown as OrganizationDbExecutor,
          args,
          { organizationId: orgCtx.orgID, userId: orgCtx.id }
        );
      }
    ),
    updateMemberRole: defineMutator(
      updateMemberRoleArgsSchema,
      async ({ tx, args, ctx }) => {
        const orgCtx = requireOrgContext(ctx);
        if (!("dbTransaction" in tx)) {
          throw new Error(
            "Las mutaciones de organización solo pueden ejecutarse en el servidor"
          );
        }
        const drizzleTx = tx.dbTransaction.wrappedTransaction;
        await runUpdateMemberRole(
          drizzleTx as unknown as OrganizationDbExecutor,
          args,
          { organizationId: orgCtx.orgID, userId: orgCtx.id }
        );
      }
    ),
    removeMember: defineMutator(
      removeMemberArgsSchema,
      async ({ tx, args, ctx }) => {
        const orgCtx = requireOrgContext(ctx);
        if (!("dbTransaction" in tx)) {
          throw new Error(
            "Las mutaciones de organización solo pueden ejecutarse en el servidor"
          );
        }
        const drizzleTx = tx.dbTransaction.wrappedTransaction;
        await runRemoveMember(
          drizzleTx as unknown as OrganizationDbExecutor,
          args,
          { organizationId: orgCtx.orgID, userId: orgCtx.id }
        );
      }
    ),
    leaveOrganization: defineMutator(
      leaveOrganizationArgsSchema,
      async ({ tx, args, ctx }) => {
        if (!ctx) {
          throw new Error("No autorizado");
        }
        if (!("dbTransaction" in tx)) {
          throw new Error(
            "Las mutaciones de organización solo pueden ejecutarse en el servidor"
          );
        }
        const drizzleTx = tx.dbTransaction.wrappedTransaction;
        await runLeaveOrganization(
          drizzleTx as unknown as OrganizationDbExecutor,
          args,
          { userId: ctx.id }
        );
      }
    ),
    updateOrganization: defineMutator(
      updateOrganizationArgsSchema,
      async ({ tx, args, ctx }) => {
        const orgCtx = requireOrgContext(ctx);
        if (!("dbTransaction" in tx)) {
          throw new Error(
            "Las mutaciones de organización solo pueden ejecutarse en el servidor"
          );
        }
        const drizzleTx = tx.dbTransaction.wrappedTransaction;
        await runUpdateOrganization(
          drizzleTx as unknown as OrganizationDbExecutor,
          args,
          { organizationId: orgCtx.orgID, userId: orgCtx.id }
        );
      }
    ),
    deleteOrganization: defineMutator(
      deleteOrganizationArgsSchema,
      async ({ tx, args, ctx }) => {
        const orgCtx = requireOrgContext(ctx);
        if (!("dbTransaction" in tx)) {
          throw new Error(
            "Las mutaciones de organización solo pueden ejecutarse en el servidor"
          );
        }
        const drizzleTx = tx.dbTransaction.wrappedTransaction;
        await runDeleteOrganization(
          drizzleTx as unknown as OrganizationDbExecutor,
          args,
          { organizationId: orgCtx.orgID, userId: orgCtx.id }
        );
      }
    ),
    joinLinkRedeem: defineMutator(
      joinLinkRedeemArgsSchema,
      async ({ tx, args, ctx }) => {
        if (!ctx) {
          throw new Error("No autorizado");
        }
        if (!("dbTransaction" in tx)) {
          throw new Error(
            "Las mutaciones de organización solo pueden ejecutarse en el servidor"
          );
        }
        const drizzleTx = tx.dbTransaction.wrappedTransaction;
        await runJoinLinkRedeem(
          drizzleTx as unknown as OrganizationDbExecutor,
          args,
          { userId: ctx.id }
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
  },
  shifts: {
    close: defineMutator(closeShiftArgsSchema, runCloseShiftServerMutator),
  },
});

export type ServerMutators = typeof serverMutators;
