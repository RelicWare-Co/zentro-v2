import { oc } from "@orpc/contract";
import { z } from "zod";
import {
  CancelInvitationSchema,
  CreateJoinLinkResultSchema,
  CreateJoinLinkSchema,
  DeleteOrganizationSchema,
  InvitationResultSchema,
  InviteMemberSchema,
  JoinLinkPreviewSchema,
  JoinLinkRedeemResultSchema,
  JoinTokenSchema,
  LeaveOrganizationSchema,
  MemberResultSchema,
  OrganizationManagementSchema,
  OrganizationSelectionSchema,
  RemoveMemberSchema,
  RevokeJoinLinkResultSchema,
  RevokeJoinLinkSchema,
  UpdateMemberRoleSchema,
  UpdateOrganizationResultSchema,
  UpdateOrganizationSchema,
} from "@/schemas/organization";

export const organizationContract = {
  joinLinkPreview: oc
    .route({
      method: "GET",
      path: "/organization/join-link/preview",
      summary: "Preview de un join link",
      tags: ["Organization"],
    })
    .input(JoinTokenSchema)
    .output(JoinLinkPreviewSchema),
  joinLinkRedeem: oc
    .route({
      method: "POST",
      path: "/organization/join-link/redeem",
      summary: "Canjear un join link",
      tags: ["Organization"],
    })
    .input(JoinTokenSchema)
    .output(JoinLinkRedeemResultSchema),
  selection: oc
    .route({
      method: "GET",
      path: "/organization/selection",
      summary: "Datos de selección de organización",
      tags: ["Organization"],
    })
    .output(OrganizationSelectionSchema),
  management: oc
    .route({
      method: "GET",
      path: "/organization/management",
      summary: "Datos de gestión de organización",
      tags: ["Organization"],
    })
    .output(OrganizationManagementSchema),
  joinLinkCreate: oc
    .route({
      method: "POST",
      path: "/organization/join-link",
      summary: "Crear un join link",
      tags: ["Organization"],
    })
    .input(CreateJoinLinkSchema)
    .output(CreateJoinLinkResultSchema),
  joinLinkRevoke: oc
    .route({
      method: "POST",
      path: "/organization/join-link/revoke",
      summary: "Revocar un join link",
      tags: ["Organization"],
    })
    .input(RevokeJoinLinkSchema)
    .output(RevokeJoinLinkResultSchema),
  inviteMember: oc
    .route({
      method: "POST",
      path: "/organization/invite",
      summary: "Invitar un miembro",
      tags: ["Organization"],
    })
    .input(InviteMemberSchema)
    .output(InvitationResultSchema),
  cancelInvitation: oc
    .route({
      method: "POST",
      path: "/organization/invitation/cancel",
      summary: "Cancelar una invitación pendiente",
      tags: ["Organization"],
    })
    .input(CancelInvitationSchema)
    .output(InvitationResultSchema),
  updateMemberRole: oc
    .route({
      method: "POST",
      path: "/organization/member/role",
      summary: "Actualizar rol de un miembro",
      tags: ["Organization"],
    })
    .input(UpdateMemberRoleSchema)
    .output(MemberResultSchema),
  removeMember: oc
    .route({
      method: "POST",
      path: "/organization/member/remove",
      summary: "Remover un miembro",
      tags: ["Organization"],
    })
    .input(RemoveMemberSchema)
    .output(MemberResultSchema),
  leaveOrganization: oc
    .route({
      method: "POST",
      path: "/organization/leave",
      summary: "Salir de una organización",
      tags: ["Organization"],
    })
    .input(LeaveOrganizationSchema)
    .output(MemberResultSchema),
  updateOrganization: oc
    .route({
      method: "POST",
      path: "/organization/update",
      summary: "Actualizar datos de organización",
      tags: ["Organization"],
    })
    .input(UpdateOrganizationSchema)
    .output(UpdateOrganizationResultSchema),
  deleteOrganization: oc
    .route({
      method: "POST",
      path: "/organization/delete",
      summary: "Eliminar una organización",
      tags: ["Organization"],
    })
    .input(DeleteOrganizationSchema)
    .output(z.object({ success: z.boolean() })),
};
