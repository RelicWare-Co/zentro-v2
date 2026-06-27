import { z as zod } from "zod";
import {
  CancelInvitationSchema,
  DeleteOrganizationSchema,
  InviteMemberSchema,
  JoinTokenSchema,
  LeaveOrganizationSchema,
  RemoveMemberSchema,
  RevokeJoinLinkSchema,
  UpdateMemberRoleSchema,
  UpdateOrganizationSchema,
} from "@/features/organization/organization.schema";
import { UpdateSettingsSchema } from "@/features/settings/settings.schema";
import { defineZentroMutator } from "@/zero/sdk";

export const updateOrganizationSettingsArgsSchema = UpdateSettingsSchema;

export const createJoinLinkArgsSchema = zod.object({
  id: zod.string().trim().min(1),
  token: zod.string().trim().min(1).max(255),
  label: zod.string().trim().max(80).optional(),
  expiresInDays: zod.number().int().min(1).max(90),
});
export const revokeJoinLinkArgsSchema = RevokeJoinLinkSchema;
export const inviteMemberArgsSchema = InviteMemberSchema;
export const cancelInvitationArgsSchema = CancelInvitationSchema;
export const updateMemberRoleArgsSchema = UpdateMemberRoleSchema;
export const removeMemberArgsSchema = RemoveMemberSchema;
export const leaveOrganizationArgsSchema = LeaveOrganizationSchema;
export const updateOrganizationArgsSchema = UpdateOrganizationSchema;
export const deleteOrganizationArgsSchema = DeleteOrganizationSchema;
export const joinLinkRedeemArgsSchema = JoinTokenSchema;

export const organizationMutators = {
  organization: {
    updateSettings: defineZentroMutator(
      updateOrganizationSettingsArgsSchema,
      async () => {
        // Server-only validation; client completes without optimistic writes.
      }
    ),
    joinLinkCreate: defineZentroMutator(createJoinLinkArgsSchema, async () => {
      // Server-only organization writes; client completes without optimistic writes.
    }),
    joinLinkRevoke: defineZentroMutator(revokeJoinLinkArgsSchema, async () => {
      // Server-only organization writes; client completes without optimistic writes.
    }),
    inviteMember: defineZentroMutator(inviteMemberArgsSchema, async () => {
      // Server-only organization writes; client completes without optimistic writes.
    }),
    cancelInvitation: defineZentroMutator(
      cancelInvitationArgsSchema,
      async () => {
        // Server-only organization writes; client completes without optimistic writes.
      }
    ),
    updateMemberRole: defineZentroMutator(
      updateMemberRoleArgsSchema,
      async () => {
        // Server-only organization writes; client completes without optimistic writes.
      }
    ),
    removeMember: defineZentroMutator(removeMemberArgsSchema, async () => {
      // Server-only organization writes; client completes without optimistic writes.
    }),
    leaveOrganization: defineZentroMutator(
      leaveOrganizationArgsSchema,
      async () => {
        // Server-only organization writes; client completes without optimistic writes.
      }
    ),
    updateOrganization: defineZentroMutator(
      updateOrganizationArgsSchema,
      async () => {
        // Server-only organization writes; client completes without optimistic writes.
      }
    ),
    deleteOrganization: defineZentroMutator(
      deleteOrganizationArgsSchema,
      async () => {
        // Server-only organization writes; client completes without optimistic writes.
      }
    ),
    joinLinkRedeem: defineZentroMutator(joinLinkRedeemArgsSchema, async () => {
      // Server-only organization writes; client completes without optimistic writes.
    }),
  },
};
