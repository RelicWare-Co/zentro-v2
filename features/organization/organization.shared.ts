import type { z } from "zod";
import { isOrganizationManagerRole } from "@/features/organization/access-control.shared";
import type {
  JoinLinkPreviewSchema,
  OrganizationManagementSchema,
  OrganizationSelectionSchema,
} from "@/features/organization/organization.schema";
import {
  buildOrganizationAccessPolicy,
  type OrganizationAccessPolicy,
} from "@/features/organization/organization-policy.shared";

export type OrganizationSelection = z.infer<typeof OrganizationSelectionSchema>;
export type OrganizationManagement = z.infer<
  typeof OrganizationManagementSchema
>;
export type JoinLinkPreview = z.infer<typeof JoinLinkPreviewSchema>;

export type JoinLinkStatus = "active" | "expired" | "used" | "revoked";

export interface OrganizationSelectionInvitationRow {
  createdAt: Date | number | string | null | undefined;
  expiresAt: Date | number | string | null | undefined;
  id: string;
  organizationId: string;
  organizationName: string;
  organizationSlug: string;
  role: string | null;
}

export interface OrganizationManagementOrgRow {
  createdAt: Date | number | string | null | undefined;
  id: string;
  logo: string | null;
  name: string;
  slug: string;
}

export interface OrganizationManagementMemberRow {
  email: string;
  joinedAt: Date | number | string | null | undefined;
  memberId: string;
  name: string;
  role: string;
  userId: string;
}

export interface OrganizationManagementInvitationRow {
  createdAt: Date | number | string | null | undefined;
  email: string;
  expiresAt: Date | number | string | null | undefined;
  id: string;
  role: string | null;
}

export interface OrganizationManagementJoinLinkRow {
  createdAt: Date | number | string | null | undefined;
  expiresAt: Date | number | string | null | undefined;
  id: string;
  label: string | null;
  lastUsedAt: Date | number | string | null | undefined;
  lastUsedByUserId: string | null;
  maxUses: number;
  revokedAt: Date | number | string | null | undefined;
  role: string;
  token: string;
  useCount: number;
}

export interface OrganizationJoinLinkPreviewRow {
  expiresAt: Date | number | string | null | undefined;
  id: string;
  label: string | null;
  maxUses: number;
  organizationId: string;
  organizationName: string;
  organizationSlug: string;
  revokedAt: Date | number | string | null | undefined;
  role: string;
  useCount: number;
}

export function toTimestamp(value: Date | number | string | null | undefined) {
  if (!value) {
    return null;
  }
  if (value instanceof Date) {
    return value.getTime();
  }
  if (typeof value === "number") {
    return value;
  }
  const dateValue = new Date(value);
  return Number.isNaN(dateValue.getTime()) ? null : dateValue.getTime();
}

export function normalizeLabel(value: string | undefined) {
  const trimmedValue = value?.trim();
  return trimmedValue ? trimmedValue : null;
}

export function buildOrganizationJoinPath(token: string) {
  return `/join?token=${encodeURIComponent(token)}`;
}

export function getJoinLinkStatus(input: {
  expiresAt: Date | number | string | null | undefined;
  revokedAt: Date | number | string | null | undefined;
  useCount: number;
  maxUses: number;
}): JoinLinkStatus {
  if (input.revokedAt) {
    return "revoked";
  }
  const expiresAt = toTimestamp(input.expiresAt);
  if (expiresAt !== null && expiresAt <= Date.now()) {
    return "expired";
  }
  if (input.useCount >= input.maxUses) {
    return "used";
  }
  return "active";
}

export function getJoinLinkErrorMessage(
  status: Exclude<JoinLinkStatus, "active">
) {
  switch (status) {
    case "expired":
      return "Este enlace expiró. Solicita uno nuevo al administrador.";
    case "revoked":
      return "Este enlace fue revocado por un administrador.";
    case "used":
      return "Este enlace ya fue utilizado.";
    default:
      return "Este enlace ya no es válido.";
  }
}

export function buildJoinLinkPreview(input: {
  row: OrganizationJoinLinkPreviewRow | null | undefined;
}): JoinLinkPreview {
  const row = input.row;
  const rowStatus = row ? getJoinLinkStatus(row) : null;
  const canJoin = rowStatus === "active";

  return row && rowStatus
    ? {
        status: rowStatus,
        canJoin,
        message: canJoin ? null : getJoinLinkErrorMessage(rowStatus),
        organization: {
          id: row.organizationId,
          name: row.organizationName,
          slug: row.organizationSlug,
        },
        role: row.role,
        label: row.label,
        expiresAt: toTimestamp(row.expiresAt),
      }
    : {
        status: "not-found",
        canJoin: false,
        message: "Este enlace ya no es válido.",
        organization: null,
        role: null,
        label: null,
        expiresAt: null,
      };
}

export function buildOrganizationSelection(input: {
  systemRole: string | null | undefined;
  invitationRows: OrganizationSelectionInvitationRow[];
  policy?: OrganizationAccessPolicy;
}): OrganizationSelection {
  const policy =
    input.policy ?? buildOrganizationAccessPolicy({ role: input.systemRole });

  return {
    allowOrganizationCreation: policy.allowSelfServiceCreation,
    contactLabel: policy.contactLabel,
    contactHref: policy.contactHref,
    contactMessage: policy.contactMessage,
    invitations: input.invitationRows.map((row) => ({
      id: row.id,
      organizationId: row.organizationId,
      organizationName: row.organizationName,
      organizationSlug: row.organizationSlug,
      role: row.role ?? "member",
      expiresAt: toTimestamp(row.expiresAt),
      createdAt: toTimestamp(row.createdAt),
    })),
  };
}

export function buildOrganizationManagement(input: {
  organizationRow: OrganizationManagementOrgRow;
  currentUserId: string;
  currentMemberRole: string;
  systemRole: string | null | undefined;
  policy?: OrganizationAccessPolicy;
  members: OrganizationManagementMemberRow[];
  invitations: OrganizationManagementInvitationRow[];
  joinLinks: OrganizationManagementJoinLinkRow[];
}): OrganizationManagement {
  const joinLinks = input.joinLinks.map((row) => {
    const status = getJoinLinkStatus(row);
    return {
      id: row.id,
      label: row.label,
      role: row.role,
      status,
      joinPath: buildOrganizationJoinPath(row.token),
      createdAt: toTimestamp(row.createdAt),
      expiresAt: toTimestamp(row.expiresAt),
      lastUsedAt: toTimestamp(row.lastUsedAt),
      lastUsedByUserId: row.lastUsedByUserId,
      maxUses: row.maxUses,
      useCount: row.useCount,
    };
  });

  const policy =
    input.policy ?? buildOrganizationAccessPolicy({ role: input.systemRole });

  return {
    organization: {
      id: input.organizationRow.id,
      name: input.organizationRow.name,
      slug: input.organizationRow.slug,
      logo: input.organizationRow.logo,
      createdAt: toTimestamp(input.organizationRow.createdAt),
    },
    viewer: {
      userId: input.currentUserId,
      role: input.currentMemberRole,
      canManageAccess: isOrganizationManagerRole(input.currentMemberRole),
    },
    policy: {
      allowOrganizationCreation: policy.allowSelfServiceCreation,
      contactLabel: policy.contactLabel,
      contactHref: policy.contactHref,
      contactMessage: policy.contactMessage,
    },
    stats: {
      membersCount: input.members.length,
      pendingInvitationsCount: input.invitations.length,
      activeJoinLinksCount: joinLinks.filter((link) => link.status === "active")
        .length,
    },
    members: input.members.map((row) => ({
      memberId: row.memberId,
      userId: row.userId,
      name: row.name,
      email: row.email,
      role: row.role,
      joinedAt: toTimestamp(row.joinedAt),
    })),
    pendingInvitations: input.invitations.map((row) => ({
      id: row.id,
      email: row.email,
      role: row.role ?? "member",
      expiresAt: toTimestamp(row.expiresAt),
      createdAt: toTimestamp(row.createdAt),
    })),
    joinLinks,
  };
}
