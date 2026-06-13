import { defineMutator } from "@rocicorp/zero";
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
import "@/zero/context";

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
    updateSettings: defineMutator(
      updateOrganizationSettingsArgsSchema,
      async () => {
        // Server-only validation; client completes without optimistic writes.
      }
    ),
    joinLinkCreate: defineMutator(createJoinLinkArgsSchema, async () => {
      // Server-only organization writes; client completes without optimistic writes.
    }),
    joinLinkRevoke: defineMutator(revokeJoinLinkArgsSchema, async () => {
      // Server-only organization writes; client completes without optimistic writes.
    }),
    inviteMember: defineMutator(inviteMemberArgsSchema, async () => {
      // Server-only organization writes; client completes without optimistic writes.
    }),
    cancelInvitation: defineMutator(cancelInvitationArgsSchema, async () => {
      // Server-only organization writes; client completes without optimistic writes.
    }),
    updateMemberRole: defineMutator(updateMemberRoleArgsSchema, async () => {
      // Server-only organization writes; client completes without optimistic writes.
    }),
    removeMember: defineMutator(removeMemberArgsSchema, async () => {
      // Server-only organization writes; client completes without optimistic writes.
    }),
    leaveOrganization: defineMutator(leaveOrganizationArgsSchema, async () => {
      // Server-only organization writes; client completes without optimistic writes.
    }),
    updateOrganization: defineMutator(
      updateOrganizationArgsSchema,
      async () => {
        // Server-only organization writes; client completes without optimistic writes.
      }
    ),
    deleteOrganization: defineMutator(
      deleteOrganizationArgsSchema,
      async () => {
        // Server-only organization writes; client completes without optimistic writes.
      }
    ),
    joinLinkRedeem: defineMutator(joinLinkRedeemArgsSchema, async () => {
      // Server-only organization writes; client completes without optimistic writes.
    }),
  },
};
