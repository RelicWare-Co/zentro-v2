import { useZero, useQuery as useZeroQuery } from "@rocicorp/zero/react";
import { useMutation } from "@tanstack/react-query";
import { useMemo } from "react";
import { usePageContext } from "vike-react/usePageContext";
import type { z } from "zod";
import {
  buildJoinLinkPreview,
  buildOrganizationJoinPath,
  buildOrganizationManagement,
  buildOrganizationSelection,
  type JoinLinkPreview,
  type OrganizationManagement,
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
import { mutators } from "@/src/zero/mutators";
import { queries } from "@/src/zero/queries";

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

type ZeroMutationDetails =
  | { readonly type: "success" }
  | {
      readonly error: { readonly message: string };
      readonly type: "error";
    };

interface ZeroMutationResult {
  readonly client: Promise<ZeroMutationDetails>;
  readonly server: Promise<ZeroMutationDetails>;
}

function toError(details: Extract<ZeroMutationDetails, { type: "error" }>) {
  return new Error(details.error.message || "La mutación de Zero falló");
}

async function waitForZeroMutation(result: ZeroMutationResult) {
  const clientResult = await result.client;
  if (clientResult.type === "error") {
    throw toError(clientResult);
  }

  const serverResult = await result.server;
  if (serverResult.type === "error") {
    throw toError(serverResult);
  }
}

function getQueryError(status: { type: string; error?: { message?: string } }) {
  return status.type === "error"
    ? new Error(status.error?.message ?? "No se pudo cargar la consulta Zero")
    : null;
}

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

interface JoinLinkPreviewRow {
  expiresAt: number | null;
  id: string;
  label: string | null;
  maxUses: number;
  organization?: {
    id: string;
    name: string;
    slug: string;
  } | null;
  organizationId: string;
  revokedAt: number | null;
  role: string;
  useCount: number;
}

export function useOrganizationSelection() {
  const pageContext = usePageContext();
  const zeroContext = pageContext.zeroContext;
  const [invitationRows, status] = useZeroQuery(
    queries.organization.selection()
  );
  const error = getQueryError(status);
  const isQueryLoading =
    Boolean(zeroContext) &&
    status.type === "unknown" &&
    invitationRows.length === 0;

  const data = useMemo(() => {
    if (!zeroContext) {
      return;
    }

    const now = Date.now();
    const pendingInvitations = (invitationRows as SelectionInvitationRow[])
      .filter((row) => {
        const expiresAt = toTimestamp(row.expiresAt);
        return expiresAt === null || expiresAt > now;
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
  const pageContext = usePageContext();
  const zeroContext = pageContext.zeroContext;
  const [organizationRows, status] = useZeroQuery(
    queries.organization.management()
  );
  const error = getQueryError(status);
  const isQueryLoading =
    Boolean(zeroContext?.orgID) &&
    status.type === "unknown" &&
    organizationRows.length === 0;

  const data = useMemo((): OrganizationManagement | undefined => {
    if (!zeroContext?.orgID) {
      return;
    }

    const organizationRow = organizationRows[0] as
      | ManagementOrganizationRow
      | undefined;
    if (!organizationRow) {
      return;
    }

    const currentMember = organizationRow.members?.find(
      (memberRow) => memberRow.userId === zeroContext.id
    );
    if (!currentMember) {
      return;
    }

    const now = Date.now();
    const pendingInvitations = (organizationRow.invitations ?? []).filter(
      (row) => {
        const expiresAt = toTimestamp(row.expiresAt);
        return expiresAt === null || expiresAt > now;
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
  }, [organizationRows, zeroContext]);

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

export function useJoinLinkPreview(token: string | null | undefined) {
  const normalizedToken = token?.trim() ?? "";
  const [rows, status] = useZeroQuery(
    queries.organization.joinLinkPreview({ token: normalizedToken || " " })
  );
  const error = getQueryError(status);
  const isQueryLoading =
    normalizedToken.length > 0 &&
    status.type === "unknown" &&
    rows.length === 0;

  const data = useMemo((): JoinLinkPreview | undefined => {
    if (!normalizedToken) {
      return;
    }

    const row = rows[0] as JoinLinkPreviewRow | undefined;
    if (!row) {
      return buildJoinLinkPreview({ row: null });
    }

    return buildJoinLinkPreview({
      row: {
        id: row.id,
        role: row.role,
        label: row.label,
        expiresAt: row.expiresAt,
        revokedAt: row.revokedAt,
        useCount: row.useCount,
        maxUses: row.maxUses,
        organizationId: row.organization?.id ?? row.organizationId,
        organizationName: row.organization?.name ?? "",
        organizationSlug: row.organization?.slug ?? "",
      },
    });
  }, [normalizedToken, rows]);

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

export function useCreateJoinLinkMutation() {
  const zero = useZero();

  return useMutation({
    mutationFn: async (input: CreateJoinLinkInput) => {
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
    },
  });
}

export function useRevokeJoinLinkMutation() {
  const zero = useZero();

  return useMutation({
    mutationFn: async (input: RevokeJoinLinkInput) => {
      await waitForZeroMutation(
        zero.mutate(mutators.organization.joinLinkRevoke(input))
      );
      return { success: true as const };
    },
  });
}

export function useInviteMemberMutation() {
  const zero = useZero();

  return useMutation({
    mutationFn: async (input: InviteMemberInput) => {
      await waitForZeroMutation(
        zero.mutate(mutators.organization.inviteMember(input))
      );
    },
  });
}

export function useCancelInvitationMutation() {
  const zero = useZero();

  return useMutation({
    mutationFn: async (input: CancelInvitationInput) => {
      await waitForZeroMutation(
        zero.mutate(mutators.organization.cancelInvitation(input))
      );
    },
  });
}

export function useUpdateMemberRoleMutation() {
  const zero = useZero();

  return useMutation({
    mutationFn: async (input: UpdateMemberRoleInput) => {
      await waitForZeroMutation(
        zero.mutate(mutators.organization.updateMemberRole(input))
      );
    },
  });
}

export function useRemoveMemberMutation() {
  const zero = useZero();

  return useMutation({
    mutationFn: async (input: RemoveMemberInput) => {
      await waitForZeroMutation(
        zero.mutate(mutators.organization.removeMember(input))
      );
    },
  });
}

export function useLeaveOrganizationMutation() {
  const zero = useZero();

  return useMutation({
    mutationFn: async (input: LeaveOrganizationInput) => {
      await waitForZeroMutation(
        zero.mutate(mutators.organization.leaveOrganization(input))
      );
    },
  });
}

export function useUpdateOrganizationMutation() {
  const zero = useZero();

  return useMutation({
    mutationFn: async (input: UpdateOrganizationInput) => {
      await waitForZeroMutation(
        zero.mutate(mutators.organization.updateOrganization(input))
      );
    },
  });
}

export function useDeleteOrganizationMutation() {
  const zero = useZero();

  return useMutation({
    mutationFn: async (input: DeleteOrganizationInput) => {
      await waitForZeroMutation(
        zero.mutate(mutators.organization.deleteOrganization(input))
      );
      return { success: true as const };
    },
  });
}

export function useJoinLinkRedeemMutation() {
  const zero = useZero();

  return useMutation({
    mutationFn: async (input: JoinLinkRedeemInput) => {
      await waitForZeroMutation(
        zero.mutate(mutators.organization.joinLinkRedeem(input))
      );
    },
  });
}
