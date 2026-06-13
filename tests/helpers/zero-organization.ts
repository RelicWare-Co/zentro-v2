import type { z } from "zod";
import { getJoinLinkPreviewByToken } from "@/features/organization/join-link-preview.server";
import type {
  CancelInvitationSchema,
  CreateJoinLinkSchema,
  DeleteOrganizationSchema,
  InviteMemberSchema,
  JoinTokenSchema,
  LeaveOrganizationSchema,
  RemoveMemberSchema,
  RevokeJoinLinkSchema,
  UpdateMemberRoleSchema,
  UpdateOrganizationSchema,
} from "@/features/organization/organization.schema";
import {
  buildOrganizationManagement,
  buildOrganizationSelection,
} from "@/features/organization/organization.shared";
import { serverMutators } from "@/zero/mutators.server";
import { queries } from "@/zero/queries";
import type { ZeroContext } from "@/zero/schema";
import type { createZeroTestDb } from "./zero-shifts";

type ZeroTestDb = ReturnType<typeof createZeroTestDb>;

function normalizeExpiresAtMs(
  value: number | Date | string | null | undefined
) {
  if (typeof value === "number") {
    return value;
  }
  if (value == null) {
    return null;
  }
  return new Date(value).getTime();
}

type CreateJoinLinkInput = z.infer<typeof CreateJoinLinkSchema>;
type RevokeJoinLinkInput = z.infer<typeof RevokeJoinLinkSchema>;
type InviteMemberInput = z.infer<typeof InviteMemberSchema>;
type CancelInvitationInput = z.infer<typeof CancelInvitationSchema>;
type UpdateMemberRoleInput = z.infer<typeof UpdateMemberRoleSchema>;
type RemoveMemberInput = z.infer<typeof RemoveMemberSchema>;
type LeaveOrganizationInput = z.infer<typeof LeaveOrganizationSchema>;
type UpdateOrganizationInput = z.infer<typeof UpdateOrganizationSchema>;
type DeleteOrganizationInput = z.infer<typeof DeleteOrganizationSchema>;
type JoinLinkRedeemInput = z.infer<typeof JoinTokenSchema>;

function createJoinLinkToken() {
  return `${crypto.randomUUID().replaceAll("-", "")}${crypto.randomUUID().replaceAll("-", "")}`;
}

export async function getOrganizationSelectionViaZero({
  zeroDb,
  ctx,
}: {
  zeroDb: ZeroTestDb;
  ctx: ZeroContext;
}) {
  const invitationRows = await zeroDb.run(
    queries.organization.selection.fn({ args: undefined, ctx })
  );

  const now = Date.now();
  return buildOrganizationSelection({
    systemRole: ctx.systemRole,
    invitationRows: invitationRows
      .filter((row) => {
        const expiresAt = normalizeExpiresAtMs(row.expiresAt);
        return expiresAt == null || expiresAt > now;
      })
      .map((row) => ({
        id: row.id,
        organizationId: row.organizationId,
        organizationName:
          (row as { organization?: { name?: string } }).organization?.name ??
          "",
        organizationSlug:
          (row as { organization?: { slug?: string } }).organization?.slug ??
          "",
        role: row.role,
        expiresAt: row.expiresAt,
        createdAt: row.createdAt,
      })),
  });
}

export async function getOrganizationManagementViaZero({
  zeroDb,
  ctx,
}: {
  zeroDb: ZeroTestDb;
  ctx: ZeroContext;
}) {
  const organizationRows = await zeroDb.run(
    queries.organization.management.fn({ args: undefined, ctx })
  );
  const organizationRow = organizationRows[0] as
    | {
        id: string;
        name: string;
        slug: string;
        logo: string | null;
        createdAt: number | Date;
        members?: Array<{
          id: string;
          userId: string;
          role: string;
          createdAt: number | Date;
          user?: { name: string; email: string } | null;
        }>;
        invitations?: Array<{
          id: string;
          email: string;
          role: string | null;
          expiresAt: number | Date;
          createdAt: number | Date;
        }>;
        joinLinks?: Array<{
          id: string;
          token: string;
          label: string | null;
          role: string;
          createdAt: number | Date;
          expiresAt: number | Date;
          maxUses: number;
          useCount: number;
          lastUsedAt: number | Date | null;
          lastUsedByUserId: string | null;
          revokedAt: number | Date | null;
        }>;
      }
    | undefined;

  if (!organizationRow) {
    throw new Error("No se encontró la organización activa.");
  }

  const currentMember = organizationRow.members?.find(
    (memberRow) => memberRow.userId === ctx.id
  );
  if (!currentMember) {
    throw new Error("No perteneces a la organización activa.");
  }

  const now = Date.now();
  return buildOrganizationManagement({
    organizationRow: {
      id: organizationRow.id,
      name: organizationRow.name,
      slug: organizationRow.slug,
      logo: organizationRow.logo,
      createdAt: organizationRow.createdAt,
    },
    currentUserId: ctx.id,
    currentMemberRole: currentMember.role,
    systemRole: ctx.systemRole,
    members: (organizationRow.members ?? []).map((memberRow) => ({
      memberId: memberRow.id,
      userId: memberRow.userId,
      name: memberRow.user?.name ?? "",
      email: memberRow.user?.email ?? "",
      role: memberRow.role,
      joinedAt: memberRow.createdAt,
    })),
    invitations: (organizationRow.invitations ?? [])
      .filter((row) => {
        const expiresAt = normalizeExpiresAtMs(row.expiresAt);
        return expiresAt == null || expiresAt > now;
      })
      .map((row) => ({
        id: row.id,
        email: row.email,
        role: row.role,
        expiresAt: row.expiresAt,
        createdAt: row.createdAt,
      })),
    joinLinks: (organizationRow.joinLinks ?? []).map((row) => ({
      id: row.id,
      token: row.token,
      label: row.label,
      role: row.role,
      createdAt: row.createdAt,
      expiresAt: row.expiresAt,
      maxUses: row.maxUses,
      useCount: row.useCount,
      lastUsedAt: row.lastUsedAt,
      lastUsedByUserId: row.lastUsedByUserId,
      revokedAt: row.revokedAt,
    })),
  });
}

export function getJoinLinkPreviewViaZero({
  db,
  token,
}: {
  db: Parameters<typeof getJoinLinkPreviewByToken>[0]["db"];
  token: string;
}) {
  return getJoinLinkPreviewByToken({ db, token });
}

export async function joinLinkCreateViaZero({
  zeroDb,
  ctx,
  input,
}: {
  zeroDb: ZeroTestDb;
  ctx: ZeroContext;
  input: CreateJoinLinkInput;
}) {
  const id = crypto.randomUUID();
  const token = createJoinLinkToken();
  await zeroDb.transaction((tx) =>
    serverMutators.organization.joinLinkCreate.fn({
      args: { ...input, id, token },
      ctx,
      tx,
    })
  );

  return {
    joinPath: `/join?token=${encodeURIComponent(token)}`,
    expiresAt: Date.now() + input.expiresInDays * 24 * 60 * 60 * 1000,
  };
}

export async function joinLinkRedeemViaZero({
  zeroDb,
  ctx,
  input,
}: {
  zeroDb: ZeroTestDb;
  ctx: ZeroContext;
  input: JoinLinkRedeemInput;
}) {
  await zeroDb.transaction((tx) =>
    serverMutators.organization.joinLinkRedeem.fn({
      args: input,
      ctx,
      tx,
    })
  );
}

export async function joinLinkRevokeViaZero({
  zeroDb,
  ctx,
  input,
}: {
  zeroDb: ZeroTestDb;
  ctx: ZeroContext;
  input: RevokeJoinLinkInput;
}) {
  await zeroDb.transaction((tx) =>
    serverMutators.organization.joinLinkRevoke.fn({
      args: input,
      ctx,
      tx,
    })
  );
  return { success: true as const };
}

export async function inviteMemberViaZero({
  zeroDb,
  ctx,
  input,
}: {
  zeroDb: ZeroTestDb;
  ctx: ZeroContext;
  input: InviteMemberInput;
}) {
  await zeroDb.transaction((tx) =>
    serverMutators.organization.inviteMember.fn({ args: input, ctx, tx })
  );
}

export async function cancelInvitationViaZero({
  zeroDb,
  ctx,
  input,
}: {
  zeroDb: ZeroTestDb;
  ctx: ZeroContext;
  input: CancelInvitationInput;
}) {
  await zeroDb.transaction((tx) =>
    serverMutators.organization.cancelInvitation.fn({ args: input, ctx, tx })
  );
}

export async function updateMemberRoleViaZero({
  zeroDb,
  ctx,
  input,
}: {
  zeroDb: ZeroTestDb;
  ctx: ZeroContext;
  input: UpdateMemberRoleInput;
}) {
  await zeroDb.transaction((tx) =>
    serverMutators.organization.updateMemberRole.fn({ args: input, ctx, tx })
  );
}

export async function removeMemberViaZero({
  zeroDb,
  ctx,
  input,
}: {
  zeroDb: ZeroTestDb;
  ctx: ZeroContext;
  input: RemoveMemberInput;
}) {
  await zeroDb.transaction((tx) =>
    serverMutators.organization.removeMember.fn({ args: input, ctx, tx })
  );
}

export async function leaveOrganizationViaZero({
  zeroDb,
  ctx,
  input,
}: {
  zeroDb: ZeroTestDb;
  ctx: ZeroContext;
  input: LeaveOrganizationInput;
}) {
  await zeroDb.transaction((tx) =>
    serverMutators.organization.leaveOrganization.fn({ args: input, ctx, tx })
  );
}

export async function updateOrganizationViaZero({
  zeroDb,
  ctx,
  input,
}: {
  zeroDb: ZeroTestDb;
  ctx: ZeroContext;
  input: UpdateOrganizationInput;
}) {
  await zeroDb.transaction((tx) =>
    serverMutators.organization.updateOrganization.fn({ args: input, ctx, tx })
  );
}

export async function deleteOrganizationViaZero({
  zeroDb,
  ctx,
  input,
}: {
  zeroDb: ZeroTestDb;
  ctx: ZeroContext;
  input: DeleteOrganizationInput;
}) {
  await zeroDb.transaction((tx) =>
    serverMutators.organization.deleteOrganization.fn({ args: input, ctx, tx })
  );
  return { success: true as const };
}
