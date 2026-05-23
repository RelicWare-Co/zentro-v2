import { defineMutator, defineMutators } from "@rocicorp/zero";
import type { CreditPaymentDbExecutor } from "@/server/credit/register-payment.server";
import { runRegisterCreditPayment } from "@/server/credit/register-payment.server";
import type { SetModuleEntitlementDbExecutor } from "@/server/modules/set-entitlement.server";
import { runSetModuleEntitlement } from "@/server/modules/set-entitlement.server";
import type { CancelSaleDbExecutor } from "@/server/sales/cancel-sale.server";
import { runCancelSale } from "@/server/sales/cancel-sale.server";
import type { CreateSaleDbExecutor } from "@/server/sales/create-sale.server";
import { runCreateSale } from "@/server/sales/create-sale.server";
import type { UpdateSettingsDbExecutor } from "@/server/settings/update-settings.server";
import { runUpdateOrganizationSettings } from "@/server/settings/update-settings.server";
import {
  cancelSaleArgsSchema,
  createSaleArgsSchema,
  registerCreditPaymentArgsSchema,
  setModuleEntitlementArgsSchema,
  mutators as sharedMutators,
  updateOrganizationSettingsArgsSchema,
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
});

export type ServerMutators = typeof serverMutators;
