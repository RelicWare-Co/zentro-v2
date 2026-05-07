import { z } from "zod";

export const JoinTokenSchema = z.object({
	token: z.string().trim().min(1).max(255),
});

export const CreateJoinLinkSchema = z.object({
	label: z.string().trim().max(80).optional(),
	expiresInDays: z.number().int().min(1).max(90),
});

export const RevokeJoinLinkSchema = z.object({
	joinLinkId: z.string().trim().min(1),
});

export const OrganizationSchema = z.object({
	id: z.string(),
	name: z.string(),
	slug: z.string(),
	logo: z.string().nullable().optional(),
	createdAt: z.number().nullable().optional(),
});

export const MemberSchema = z.object({
	memberId: z.string(),
	userId: z.string(),
	name: z.string(),
	email: z.string(),
	role: z.string(),
	joinedAt: z.number().nullable().optional(),
});

export const InvitationSchema = z.object({
	id: z.string(),
	email: z.string(),
	role: z.string(),
	expiresAt: z.number().nullable().optional(),
	createdAt: z.number().nullable().optional(),
});

export const JoinLinkSchema = z.object({
	id: z.string(),
	label: z.string().nullable().optional(),
	role: z.string(),
	status: z.enum(["active", "expired", "used", "revoked"]),
	joinPath: z.string(),
	createdAt: z.number().nullable().optional(),
	expiresAt: z.number().nullable().optional(),
	lastUsedAt: z.number().nullable().optional(),
	lastUsedByUserId: z.string().nullable().optional(),
	maxUses: z.number(),
	useCount: z.number(),
});

export const JoinLinkPreviewSchema = z.object({
	status: z.enum(["active", "expired", "used", "revoked", "not-found"]),
	canJoin: z.boolean(),
	message: z.string().nullable().optional(),
	organization: OrganizationSchema.nullable().optional(),
	role: z.string().nullable().optional(),
	label: z.string().nullable().optional(),
	expiresAt: z.number().nullable().optional(),
});

export const JoinLinkRedeemResultSchema = z.object({
	status: z.enum(["joined", "already-member"]),
	organizationId: z.string(),
	organizationName: z.string(),
});

export const CreateJoinLinkResultSchema = z.object({
	joinPath: z.string(),
	expiresAt: z.number(),
});

export const RevokeJoinLinkResultSchema = z.object({
	success: z.boolean(),
});

export const OrganizationManagementSchema = z.object({
	organization: OrganizationSchema,
	viewer: z.object({
		userId: z.string(),
		role: z.string(),
		canManageAccess: z.boolean(),
	}),
	policy: z.object({
		allowOrganizationCreation: z.boolean(),
		contactLabel: z.string().nullable().optional(),
		contactHref: z.string().nullable().optional(),
		contactMessage: z.string(),
	}),
	stats: z.object({
		membersCount: z.number(),
		pendingInvitationsCount: z.number(),
		activeJoinLinksCount: z.number(),
	}),
	members: z.array(MemberSchema),
	pendingInvitations: z.array(InvitationSchema),
	joinLinks: z.array(JoinLinkSchema),
});

export const OrganizationSelectionSchema = z.object({
	allowOrganizationCreation: z.boolean(),
	contactLabel: z.string().nullable().optional(),
	contactHref: z.string().nullable().optional(),
	contactMessage: z.string(),
	invitations: z.array(
		z.object({
			id: z.string(),
			organizationId: z.string(),
			organizationName: z.string(),
			organizationSlug: z.string(),
			role: z.string(),
			expiresAt: z.number().nullable().optional(),
			createdAt: z.number().nullable().optional(),
		}),
	),
});
