import { useQuery as useZeroQuery } from "@rocicorp/zero/react";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import type { z } from "zod";
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
  buildOrganizationJoinPath,
  buildOrganizationManagement,
  buildOrganizationSelection,
  type JoinLinkPreview,
  type OrganizationManagement,
  toTimestamp,
} from "@/features/organization/organization.shared";
import { usePageZeroContext } from "@/lib/use-page-zero-context";
import {
  getZeroQueryError,
  useZeroMutation,
  waitForZeroMutation,
} from "@/lib/use-zero-mutation";
import { mutators } from "@/zero/mutators";
import { queries } from "@/zero/queries";

export type {
  JoinLinkPreview,
  OrganizationManagement,
  OrganizationSelection,
} from "@/features/organization/organization.shared";

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

interface SelectionInvitationRow {
  createdAt: number;
  email: string;
  expiresAt: number;
  id: string;
  inviterId: string;
  organization?: {
    id: string;
    name: string;
    slug: string;
  } | null;
  organizationId: string;
  role: string | null;
  status: string | null;
}

interface ManagementMemberRow {
  createdAt: number;
  id: string;
  role: string;
  user?: {
    email: string;
    name: string;
  } | null;
  userId: string;
}

interface ManagementInvitationRow {
  createdAt: number;
  email: string;
  expiresAt: number;
  id: string;
  role: string | null;
}

interface ManagementJoinLinkRow {
  createdAt: number;
  expiresAt: number;
  id: string;
  label: string | null;
  lastUsedAt: number | null;
  lastUsedByUserId: string | null;
  maxUses: number;
  revokedAt: number | null;
  role: string;
  token: string;
  useCount: number;
}

interface ManagementOrganizationRow {
  createdAt: number;
  id: string;
  invitations?: ManagementInvitationRow[];
  joinLinks?: ManagementJoinLinkRow[];
  logo: string | null;
  members?: ManagementMemberRow[];
  name: string;
  slug: string;
}

export function useOrganizationSelection() {
  const zeroContext = usePageZeroContext();
  const [invitationRows, status] = useZeroQuery(
    queries.organization.selection()
  );
  const error = getZeroQueryError(status);
  const isQueryLoading =
    Boolean(zeroContext) &&
    status.type === "unknown" &&
    invitationRows.length === 0;

  const data = useMemo(() => {
    if (!zeroContext) {
      return;
    }

    const pendingInvitations = (invitationRows as SelectionInvitationRow[])
      .filter((row) => {
        const expiresAt = toTimestamp(row.expiresAt);
        return expiresAt === null || expiresAt > Date.now();
      })
      .map((row) => ({
        id: row.id,
        organizationId: row.organizationId,
        organizationName: row.organization?.name ?? "",
        organizationSlug: row.organization?.slug ?? "",
        role: row.role,
        expiresAt: row.expiresAt,
        createdAt: row.createdAt,
      }));

    return buildOrganizationSelection({
      systemRole: zeroContext.systemRole,
      policy: zeroContext.organizationPolicy,
      invitationRows: pendingInvitations,
    });
  }, [invitationRows, zeroContext]);

  return {
    data,
    error,
    isError: Boolean(error),
    isPending: isQueryLoading,
    isLoading: isQueryLoading,
    refetch: () => {
      if (status.type === "error") {
        status.retry();
      }
      return Promise.resolve();
    },
  };
}

export function useOrganizationManagement() {
  const zeroContext = usePageZeroContext();
  const [organizationRows, status] = useZeroQuery(
    queries.organization.management()
  );
  const error = getZeroQueryError(status);
  const organizationRow = organizationRows[0] as
    | ManagementOrganizationRow
    | undefined;
  const currentMember = organizationRow?.members?.find(
    (memberRow) => memberRow.userId === zeroContext?.id
  );
  const isQueryLoading =
    !error &&
    Boolean(zeroContext?.orgID) &&
    (status.type === "unknown" ||
      (status.type !== "complete" && !(organizationRow && currentMember)));

  const data = useMemo((): OrganizationManagement | undefined => {
    if (!zeroContext?.orgID) {
      return;
    }

    if (!organizationRow) {
      return;
    }

    if (!currentMember) {
      return;
    }

    const pendingInvitations = (organizationRow.invitations ?? []).filter(
      (row) => {
        const expiresAt = toTimestamp(row.expiresAt);
        return expiresAt === null || expiresAt > Date.now();
      }
    );

    return buildOrganizationManagement({
      organizationRow: {
        id: organizationRow.id,
        name: organizationRow.name,
        slug: organizationRow.slug,
        logo: organizationRow.logo,
        createdAt: organizationRow.createdAt,
      },
      currentUserId: zeroContext.id,
      currentMemberRole: currentMember.role,
      systemRole: zeroContext.systemRole,
      policy: zeroContext.organizationPolicy,
      members: (organizationRow.members ?? []).map((memberRow) => ({
        memberId: memberRow.id,
        userId: memberRow.userId,
        name: memberRow.user?.name ?? "",
        email: memberRow.user?.email ?? "",
        role: memberRow.role,
        joinedAt: memberRow.createdAt,
      })),
      invitations: pendingInvitations.map((row) => ({
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
  }, [currentMember, organizationRow, zeroContext]);

  return {
    data,
    error,
    isError: Boolean(error),
    isPending: isQueryLoading,
    isLoading: isQueryLoading,
    refetch: () => {
      if (status.type === "error") {
        status.retry();
      }
      return Promise.resolve();
    },
  };
}

async function fetchJoinLinkPreview(token: string): Promise<JoinLinkPreview> {
  const response = await fetch(
    `/api/organization/join-link-preview?token=${encodeURIComponent(token)}`
  );

  if (!response.ok) {
    throw new Error("No se pudo validar el enlace de acceso.");
  }

  return response.json() as Promise<JoinLinkPreview>;
}

export function useJoinLinkPreview(token: string | null | undefined) {
  const normalizedToken = token?.trim() ?? "";
  const query = useQuery({
    queryKey: ["organization", "join-link-preview", normalizedToken],
    queryFn: () => fetchJoinLinkPreview(normalizedToken),
    enabled: normalizedToken.length > 0,
  });

  return {
    data: normalizedToken ? query.data : undefined,
    error: query.error,
    isError: query.isError,
    isPending: normalizedToken.length > 0 && query.isPending,
    isLoading: normalizedToken.length > 0 && query.isLoading,
    refetch: query.refetch,
  };
}

export function useCreateJoinLinkMutation() {
  return useZeroMutation(async (input: CreateJoinLinkInput, zero) => {
    const id = crypto.randomUUID();
    const token = createJoinLinkToken();
    await waitForZeroMutation(
      zero.mutate(
        mutators.organization.joinLinkCreate({
          ...input,
          id,
          token,
        })
      )
    );
    return {
      joinPath: buildOrganizationJoinPath(token),
      expiresAt: Date.now() + input.expiresInDays * 24 * 60 * 60 * 1000,
    };
  });
}

export function useRevokeJoinLinkMutation() {
  return useZeroMutation(async (input: RevokeJoinLinkInput, zero) => {
    await waitForZeroMutation(
      zero.mutate(mutators.organization.joinLinkRevoke(input))
    );
    return { success: true as const };
  });
}

export function useInviteMemberMutation() {
  return useZeroMutation(async (input: InviteMemberInput, zero) => {
    await waitForZeroMutation(
      zero.mutate(mutators.organization.inviteMember(input))
    );
  });
}

export function useCancelInvitationMutation() {
  return useZeroMutation(async (input: CancelInvitationInput, zero) => {
    await waitForZeroMutation(
      zero.mutate(mutators.organization.cancelInvitation(input))
    );
  });
}

export function useUpdateMemberRoleMutation() {
  return useZeroMutation(async (input: UpdateMemberRoleInput, zero) => {
    await waitForZeroMutation(
      zero.mutate(mutators.organization.updateMemberRole(input))
    );
  });
}

export function useRemoveMemberMutation() {
  return useZeroMutation(async (input: RemoveMemberInput, zero) => {
    await waitForZeroMutation(
      zero.mutate(mutators.organization.removeMember(input))
    );
  });
}

export function useLeaveOrganizationMutation() {
  return useZeroMutation(async (input: LeaveOrganizationInput, zero) => {
    await waitForZeroMutation(
      zero.mutate(mutators.organization.leaveOrganization(input))
    );
  });
}

export function useUpdateOrganizationMutation() {
  return useZeroMutation(async (input: UpdateOrganizationInput, zero) => {
    await waitForZeroMutation(
      zero.mutate(mutators.organization.updateOrganization(input))
    );
  });
}

export function useDeleteOrganizationMutation() {
  return useZeroMutation(async (input: DeleteOrganizationInput, zero) => {
    await waitForZeroMutation(
      zero.mutate(mutators.organization.deleteOrganization(input))
    );
    return { success: true as const };
  });
}

export function useJoinLinkRedeemMutation() {
  return useZeroMutation(async (input: JoinLinkRedeemInput, zero) => {
    await waitForZeroMutation(
      zero.mutate(mutators.organization.joinLinkRedeem(input))
    );
  });
}
