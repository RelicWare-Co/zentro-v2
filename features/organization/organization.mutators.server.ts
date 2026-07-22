import {
  cancelInvitationArgsSchema,
  createJoinLinkArgsSchema,
  deleteOrganizationArgsSchema,
  inviteMemberArgsSchema,
  joinLinkRedeemArgsSchema,
  leaveOrganizationArgsSchema,
  removeMemberArgsSchema,
  revokeJoinLinkArgsSchema,
  updateMemberRoleArgsSchema,
  updateOrganizationArgsSchema,
  updateOrganizationSettingsArgsSchema,
} from "@/features/organization/organization.mutators";
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
import type { UpdateSettingsDbExecutor } from "@/features/settings/update-settings.server";
import { runUpdateOrganizationSettings } from "@/features/settings/update-settings.server";
import { defineZentroMutator, requireOrgContext } from "@/zero/sdk";

export const organizationServerMutators = {
  updateSettings: defineZentroMutator(
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
  joinLinkCreate: defineZentroMutator(
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
  joinLinkRevoke: defineZentroMutator(
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
  inviteMember: defineZentroMutator(
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
  cancelInvitation: defineZentroMutator(
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
  updateMemberRole: defineZentroMutator(
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
  removeMember: defineZentroMutator(
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
  leaveOrganization: defineZentroMutator(
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
  updateOrganization: defineZentroMutator(
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
  deleteOrganization: defineZentroMutator(
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
  joinLinkRedeem: defineZentroMutator(
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
        { email: ctx.email, userId: ctx.id }
      );
    }
  ),
};
