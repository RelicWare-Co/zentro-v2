import { and, eq, gt, like, or } from "drizzle-orm";
import type { z } from "zod";
import type { Database } from "@/database/drizzle/db";
import {
  invitation,
  member,
  organization,
  organizationJoinLink,
  user as userTable,
} from "@/database/drizzle/schema/auth.schema";
import {
  getJoinLinkErrorMessage,
  getJoinLinkStatus,
  normalizeLabel,
  toTimestamp,
} from "@/features/organization/organization.shared";
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
} from "@/schemas/organization";
import { isOrganizationManagerRole } from "@/server/organization/access-control.shared";

export type OrganizationDbExecutor = Pick<
  Database,
  "select" | "insert" | "update" | "delete" | "transaction"
>;

type OrganizationTransaction = Parameters<
  Parameters<OrganizationDbExecutor["transaction"]>[0]
>[0];
type OrganizationDatabase = OrganizationDbExecutor | OrganizationTransaction;

export interface OrganizationOrgAuth {
  organizationId: string;
  userId: string;
}

export interface OrganizationUserAuth {
  userId: string;
}

function parseRoleList(role: string | null | undefined) {
  return (role ?? "").split(",").flatMap((value) => {
    const trimmed = value.trim().toLowerCase();
    return trimmed ? [trimmed] : [];
  });
}

async function getOrganizationMemberOrThrow(input: {
  organizationId: string;
  userId: string;
  db: OrganizationDatabase;
}) {
  const [memberRow] = await input.db
    .select({
      id: member.id,
      role: member.role,
      createdAt: member.createdAt,
    })
    .from(member)
    .where(
      and(
        eq(member.organizationId, input.organizationId),
        eq(member.userId, input.userId)
      )
    )
    .limit(1);

  if (!memberRow) {
    throw new Error("No perteneces a la organización activa.");
  }

  return memberRow;
}

export function normalizeInvitationResult(row: {
  id: string;
  email: string;
  role: string | null;
  organizationId: string;
  inviterId: string;
  status: string;
  expiresAt: Date | number | string | null | undefined;
  createdAt: Date | number | string | null | undefined;
}) {
  return {
    id: row.id,
    email: row.email,
    role: row.role ?? "member",
    organizationId: row.organizationId,
    inviterId: row.inviterId,
    status: row.status,
    expiresAt: toTimestamp(row.expiresAt),
    createdAt: toTimestamp(row.createdAt),
  };
}

export function normalizeMemberResult(row: {
  id: string;
  userId: string;
  organizationId: string;
  role: string;
}) {
  return {
    id: row.id,
    userId: row.userId,
    organizationId: row.organizationId,
    role: row.role,
  };
}

function assertCanManageAccess(role: string | null | undefined) {
  if (!isOrganizationManagerRole(role)) {
    throw new Error(
      "No tienes permisos para gestionar miembros en esta organización."
    );
  }
}

const VALID_ORG_ROLES = new Set(["member", "admin", "owner"]);

function validateOrgRole(role: string, callerRole: string | null | undefined) {
  const normalized = role.trim().toLowerCase();
  if (!VALID_ORG_ROLES.has(normalized)) {
    throw new Error(
      "Rol no válido. Los roles permitidos son: member, admin, owner."
    );
  }
  const isOwner = parseRoleList(callerRole).includes("owner");
  if (normalized === "owner" && !isOwner) {
    throw new Error("Solo el owner puede asignar el rol owner.");
  }
  return normalized;
}

export async function runJoinLinkCreate(
  db: OrganizationDbExecutor,
  args: z.infer<typeof CreateJoinLinkSchema> & { id: string; token: string },
  auth: OrganizationOrgAuth
): Promise<void> {
  const currentMember = await getOrganizationMemberOrThrow({
    organizationId: auth.organizationId,
    userId: auth.userId,
    db,
  });

  if (!isOrganizationManagerRole(currentMember.role)) {
    throw new Error(
      "No tienes permisos para crear enlaces de acceso en esta organización."
    );
  }

  const createdAt = new Date();
  const expiresAt = new Date(
    Date.now() + args.expiresInDays * 24 * 60 * 60 * 1000
  );

  await db.insert(organizationJoinLink).values({
    id: args.id,
    organizationId: auth.organizationId,
    token: args.token,
    role: "member",
    label: normalizeLabel(args.label),
    createdByUserId: auth.userId,
    createdAt,
    expiresAt,
    maxUses: 1,
    useCount: 0,
    lastUsedAt: null,
    lastUsedByUserId: null,
    revokedAt: null,
  });
}

export async function runJoinLinkRevoke(
  db: OrganizationDbExecutor,
  args: z.infer<typeof RevokeJoinLinkSchema>,
  auth: OrganizationOrgAuth
): Promise<void> {
  const currentMember = await getOrganizationMemberOrThrow({
    organizationId: auth.organizationId,
    userId: auth.userId,
    db,
  });

  if (!isOrganizationManagerRole(currentMember.role)) {
    throw new Error(
      "No tienes permisos para revocar enlaces de acceso en esta organización."
    );
  }

  const [joinLink] = await db
    .select({ id: organizationJoinLink.id })
    .from(organizationJoinLink)
    .where(
      and(
        eq(organizationJoinLink.id, args.joinLinkId),
        eq(organizationJoinLink.organizationId, auth.organizationId)
      )
    )
    .limit(1);

  if (!joinLink) {
    throw new Error("No se encontró el enlace solicitado.");
  }

  await db
    .update(organizationJoinLink)
    .set({ revokedAt: new Date() })
    .where(eq(organizationJoinLink.id, args.joinLinkId));
}

export async function runInviteMember(
  db: OrganizationDbExecutor,
  args: z.infer<typeof InviteMemberSchema>,
  auth: OrganizationOrgAuth
): Promise<void> {
  const currentMember = await getOrganizationMemberOrThrow({
    organizationId: auth.organizationId,
    userId: auth.userId,
    db,
  });
  assertCanManageAccess(currentMember.role);

  const validatedRole = validateOrgRole(args.role, currentMember.role);
  const normalizedEmail = args.email.trim().toLowerCase();
  const now = new Date();

  const [existingMember] = await db
    .select({ id: member.id })
    .from(member)
    .innerJoin(userTable, eq(member.userId, userTable.id))
    .where(
      and(
        eq(member.organizationId, auth.organizationId),
        eq(userTable.email, normalizedEmail)
      )
    )
    .limit(1);
  if (existingMember) {
    throw new Error("El usuario ya es miembro de esta organización.");
  }

  const [pendingInvitation] = await db
    .select({ id: invitation.id })
    .from(invitation)
    .where(
      and(
        eq(invitation.organizationId, auth.organizationId),
        eq(invitation.email, normalizedEmail),
        eq(invitation.status, "pending"),
        gt(invitation.expiresAt, now)
      )
    )
    .limit(1);
  if (pendingInvitation) {
    throw new Error("Ya existe una invitación pendiente para este correo.");
  }

  const expiresAt = new Date(now.getTime() + 48 * 60 * 60 * 1000);

  await db.insert(invitation).values({
    id: crypto.randomUUID(),
    organizationId: auth.organizationId,
    inviterId: auth.userId,
    email: normalizedEmail,
    role: validatedRole,
    status: "pending",
    expiresAt,
    createdAt: now,
  });
}

export async function runCancelInvitation(
  db: OrganizationDbExecutor,
  args: z.infer<typeof CancelInvitationSchema>,
  auth: OrganizationOrgAuth
): Promise<void> {
  const currentMember = await getOrganizationMemberOrThrow({
    organizationId: auth.organizationId,
    userId: auth.userId,
    db,
  });
  assertCanManageAccess(currentMember.role);

  const [inv] = await db
    .select({
      id: invitation.id,
      organizationId: invitation.organizationId,
      status: invitation.status,
    })
    .from(invitation)
    .where(eq(invitation.id, args.invitationId))
    .limit(1);

  if (!inv || inv.organizationId !== auth.organizationId) {
    throw new Error("No se encontró la invitación en esta organización.");
  }

  if (inv.status !== "pending") {
    throw new Error("Solo se pueden cancelar invitaciones pendientes.");
  }

  await db
    .update(invitation)
    .set({ status: "canceled" })
    .where(eq(invitation.id, args.invitationId));
}

export async function runUpdateMemberRole(
  db: OrganizationDbExecutor,
  args: z.infer<typeof UpdateMemberRoleSchema>,
  auth: OrganizationOrgAuth
): Promise<void> {
  const currentMember = await getOrganizationMemberOrThrow({
    organizationId: auth.organizationId,
    userId: auth.userId,
    db,
  });
  assertCanManageAccess(currentMember.role);

  const [target] = await db
    .select({
      id: member.id,
      role: member.role,
    })
    .from(member)
    .where(
      and(
        eq(member.id, args.memberId),
        eq(member.organizationId, auth.organizationId)
      )
    )
    .limit(1);

  if (!target) {
    throw new Error("No se encontró el miembro en esta organización.");
  }

  const normalizedRole = validateOrgRole(args.role, currentMember.role);
  const isOwner = parseRoleList(currentMember.role).includes("owner");
  const targetIsOwner = parseRoleList(target.role).includes("owner");
  const settingOwner = normalizedRole === "owner";

  if ((targetIsOwner || settingOwner) && !isOwner) {
    throw new Error("Solo el owner puede modificar roles de owner.");
  }

  if (targetIsOwner && !settingOwner) {
    const owners = await db
      .select({ id: member.id })
      .from(member)
      .where(
        and(
          eq(member.organizationId, auth.organizationId),
          like(member.role, "%owner%")
        )
      );
    if (owners.length <= 1) {
      throw new Error("No puedes degradar al único owner de la organización.");
    }
  }

  await db
    .update(member)
    .set({ role: normalizedRole })
    .where(eq(member.id, args.memberId));
}

export async function runRemoveMember(
  db: OrganizationDbExecutor,
  args: z.infer<typeof RemoveMemberSchema>,
  auth: OrganizationOrgAuth
): Promise<void> {
  const currentMember = await getOrganizationMemberOrThrow({
    organizationId: auth.organizationId,
    userId: auth.userId,
    db,
  });
  assertCanManageAccess(currentMember.role);

  const [targetMemberRow] = await db
    .select({
      id: member.id,
      role: member.role,
    })
    .from(member)
    .innerJoin(userTable, eq(member.userId, userTable.id))
    .where(
      and(
        eq(member.organizationId, auth.organizationId),
        or(
          eq(member.id, args.memberIdOrEmail),
          eq(userTable.email, args.memberIdOrEmail)
        )
      )
    )
    .limit(1);

  if (!targetMemberRow) {
    throw new Error("No se encontró el miembro en esta organización.");
  }

  if (
    parseRoleList(targetMemberRow.role).includes("owner") &&
    !parseRoleList(currentMember.role).includes("owner")
  ) {
    throw new Error("Solo el owner puede remover a un owner.");
  }

  if (parseRoleList(targetMemberRow.role).includes("owner")) {
    const owners = await db
      .select({ id: member.id })
      .from(member)
      .where(
        and(
          eq(member.organizationId, auth.organizationId),
          like(member.role, "%owner%")
        )
      );
    if (owners.length <= 1) {
      throw new Error("No puedes remover al único owner de la organización.");
    }
  }

  await db
    .delete(member)
    .where(
      and(
        eq(member.id, targetMemberRow.id),
        eq(member.organizationId, auth.organizationId)
      )
    );
}

export async function runLeaveOrganization(
  db: OrganizationDbExecutor,
  args: z.infer<typeof LeaveOrganizationSchema>,
  auth: OrganizationUserAuth
): Promise<void> {
  const [currentMember] = await db
    .select({ id: member.id, role: member.role })
    .from(member)
    .where(
      and(
        eq(member.organizationId, args.organizationId),
        eq(member.userId, auth.userId)
      )
    )
    .limit(1);

  if (!currentMember) {
    throw new Error("No eres miembro de esta organización.");
  }

  if (parseRoleList(currentMember.role).includes("owner")) {
    const owners = await db
      .select({ id: member.id })
      .from(member)
      .where(
        and(
          eq(member.organizationId, args.organizationId),
          like(member.role, "%owner%")
        )
      );
    if (owners.length <= 1) {
      throw new Error("No puedes salir si eres el único owner.");
    }
  }

  await db
    .delete(member)
    .where(
      and(
        eq(member.organizationId, args.organizationId),
        eq(member.userId, auth.userId)
      )
    );
}

export async function runUpdateOrganization(
  db: OrganizationDbExecutor,
  args: z.infer<typeof UpdateOrganizationSchema>,
  auth: OrganizationOrgAuth
): Promise<void> {
  const currentMember = await getOrganizationMemberOrThrow({
    organizationId: auth.organizationId,
    userId: auth.userId,
    db,
  });
  assertCanManageAccess(currentMember.role);

  const setData: Partial<Record<string, unknown>> = {};
  if (args.name !== undefined) {
    setData.name = args.name;
  }
  if (args.slug !== undefined) {
    setData.slug = args.slug;
  }
  if (args.logo !== undefined) {
    setData.logo = args.logo;
  }

  if (Object.keys(setData).length === 0) {
    throw new Error("No se proporcionaron campos para actualizar.");
  }

  await db
    .update(organization)
    .set(setData)
    .where(eq(organization.id, auth.organizationId));
}

export async function runDeleteOrganization(
  db: OrganizationDbExecutor,
  args: z.infer<typeof DeleteOrganizationSchema>,
  auth: OrganizationOrgAuth
): Promise<void> {
  if (args.organizationId !== auth.organizationId) {
    throw new Error(
      "No puedes eliminar una organización diferente a la activa."
    );
  }

  const currentMember = await getOrganizationMemberOrThrow({
    organizationId: auth.organizationId,
    userId: auth.userId,
    db,
  });

  if (!parseRoleList(currentMember.role).includes("owner")) {
    throw new Error("Solo el owner puede eliminar la organización.");
  }

  await db.delete(organization).where(eq(organization.id, auth.organizationId));
}

export async function runJoinLinkRedeem(
  db: OrganizationDbExecutor,
  args: z.infer<typeof JoinTokenSchema>,
  auth: OrganizationUserAuth
): Promise<void> {
  await db.transaction(async (tx) => {
    const [row] = await tx
      .select({
        id: organizationJoinLink.id,
        organizationId: organizationJoinLink.organizationId,
        role: organizationJoinLink.role,
        expiresAt: organizationJoinLink.expiresAt,
        revokedAt: organizationJoinLink.revokedAt,
        useCount: organizationJoinLink.useCount,
        maxUses: organizationJoinLink.maxUses,
      })
      .from(organizationJoinLink)
      .innerJoin(
        organization,
        eq(organizationJoinLink.organizationId, organization.id)
      )
      .where(eq(organizationJoinLink.token, args.token))
      .limit(1);

    if (!row) {
      throw new Error("Este enlace ya no es válido.");
    }

    const status = getJoinLinkStatus(row);
    if (status !== "active") {
      throw new Error(getJoinLinkErrorMessage(status));
    }

    const [existingMembership] = await tx
      .select({ id: member.id })
      .from(member)
      .where(
        and(
          eq(member.organizationId, row.organizationId),
          eq(member.userId, auth.userId)
        )
      )
      .limit(1);

    if (!existingMembership) {
      const now = new Date();
      await tx.insert(member).values({
        id: crypto.randomUUID(),
        organizationId: row.organizationId,
        userId: auth.userId,
        role: row.role,
        createdAt: now,
      });

      await tx
        .update(organizationJoinLink)
        .set({
          useCount: row.useCount + 1,
          lastUsedAt: now,
          lastUsedByUserId: auth.userId,
        })
        .where(eq(organizationJoinLink.id, row.id));
    }
  });
}
