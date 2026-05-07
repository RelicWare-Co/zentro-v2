import { and, asc, desc, eq, gt } from "drizzle-orm";
import { ORPCError } from "@orpc/server";
import { pub, authed, orgRequired } from "../bases";
import {
	JoinTokenSchema,
	CreateJoinLinkSchema,
	RevokeJoinLinkSchema,
	JoinLinkPreviewSchema,
	JoinLinkRedeemResultSchema,
	OrganizationManagementSchema,
	OrganizationSelectionSchema,
} from "../../../schemas/organization";
import {
	invitation,
	member,
	organization,
	organizationJoinLink,
	user as userTable,
} from "../../../database/drizzle/schema/auth.schema";
import { getOrganizationAccessPolicy } from "../../organization/organization-policy";
import type { Database } from "../../../database/drizzle/db";

function toTimestamp(value: Date | number | string | null | undefined) {
	if (!value) return null;
	if (value instanceof Date) return value.getTime();
	const dateValue = new Date(value);
	return Number.isNaN(dateValue.getTime()) ? null : dateValue.getTime();
}

function normalizeLabel(value: string | undefined) {
	const trimmedValue = value?.trim();
	return trimmedValue ? trimmedValue : null;
}

function parseRoleList(role: string | null | undefined) {
	return (role ?? "")
		.split(",")
		.map((value) => value.trim().toLowerCase())
		.filter(Boolean);
}

function isOrganizationManagerRole(role: string | null | undefined) {
	const roles = parseRoleList(role);
	return roles.includes("owner") || roles.includes("admin");
}

type JoinLinkStatus = "active" | "expired" | "used" | "revoked";

function getJoinLinkStatus(input: {
	expiresAt: Date | number | string | null | undefined;
	revokedAt: Date | number | string | null | undefined;
	useCount: number;
	maxUses: number;
}): JoinLinkStatus {
	if (input.revokedAt) return "revoked";
	const expiresAt = toTimestamp(input.expiresAt);
	if (expiresAt !== null && expiresAt <= Date.now()) return "expired";
	if (input.useCount >= input.maxUses) return "used";
	return "active";
}

function getJoinLinkErrorMessage(
	status: Exclude<JoinLinkStatus, "active">,
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

function buildOrganizationJoinPath(token: string) {
	return `/join?token=${encodeURIComponent(token)}`;
}

async function getOrganizationMemberOrThrow(input: {
	organizationId: string;
	userId: string;
	db: Database;
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
				eq(member.userId, input.userId),
			),
		)
		.limit(1);

	if (!memberRow) {
		throw new ORPCError("FORBIDDEN", {
			message: "No perteneces a la organización activa.",
		});
	}

	return memberRow;
}

export const joinLinkPreview = pub
	.route({
		method: "GET",
		path: "/organization/join-link/preview",
		summary: "Preview de un join link",
		tags: ["Organization"],
	})
	.input(JoinTokenSchema)
	.output(JoinLinkPreviewSchema)
	.handler(async ({ input, context }) => {
		const [row] = await context.db
			.select({
				id: organizationJoinLink.id,
				role: organizationJoinLink.role,
				label: organizationJoinLink.label,
				expiresAt: organizationJoinLink.expiresAt,
				revokedAt: organizationJoinLink.revokedAt,
				useCount: organizationJoinLink.useCount,
				maxUses: organizationJoinLink.maxUses,
				organizationId: organization.id,
				organizationName: organization.name,
				organizationSlug: organization.slug,
			})
			.from(organizationJoinLink)
			.innerJoin(
				organization,
				eq(organizationJoinLink.organizationId, organization.id),
			)
			.where(eq(organizationJoinLink.token, input.token))
			.limit(1);

		if (!row) {
			return {
				status: "not-found" as const,
				canJoin: false,
				message: "Este enlace ya no es válido.",
				organization: null,
				role: null,
				label: null,
				expiresAt: null,
			};
		}

		const status = getJoinLinkStatus(row);
		const canJoin = status === "active";

		return {
			status,
			canJoin,
			message: canJoin ? null : getJoinLinkErrorMessage(status),
			organization: {
				id: row.organizationId,
				name: row.organizationName,
				slug: row.organizationSlug,
			},
			role: row.role,
			label: row.label,
			expiresAt: toTimestamp(row.expiresAt),
		};
	});

export const joinLinkRedeem = authed
	.route({
		method: "POST",
		path: "/organization/join-link/redeem",
		summary: "Canjear un join link",
		tags: ["Organization"],
	})
	.input(JoinTokenSchema)
	.output(JoinLinkRedeemResultSchema)
	.handler(async ({ input, context }) => {
		const userId = context.user.id;

		const result = await context.db.transaction(async (tx) => {
			const [row] = await tx
				.select({
					id: organizationJoinLink.id,
					organizationId: organizationJoinLink.organizationId,
					role: organizationJoinLink.role,
					expiresAt: organizationJoinLink.expiresAt,
					revokedAt: organizationJoinLink.revokedAt,
					useCount: organizationJoinLink.useCount,
					maxUses: organizationJoinLink.maxUses,
					organizationName: organization.name,
				})
				.from(organizationJoinLink)
				.innerJoin(
					organization,
					eq(organizationJoinLink.organizationId, organization.id),
				)
				.where(eq(organizationJoinLink.token, input.token))
				.limit(1);

			if (!row) {
				throw new ORPCError("BAD_REQUEST", {
					message: "Este enlace ya no es válido.",
				});
			}

			const status = getJoinLinkStatus(row);
			if (status !== "active") {
				throw new ORPCError("BAD_REQUEST", {
					message: getJoinLinkErrorMessage(status),
				});
			}

			const [existingMembership] = await tx
				.select({ id: member.id })
				.from(member)
				.where(
					and(
						eq(member.organizationId, row.organizationId),
						eq(member.userId, userId),
					),
				)
				.limit(1);

			if (existingMembership) {
				return {
					status: "already-member" as const,
					organizationId: row.organizationId,
					organizationName: row.organizationName,
				};
			}

			const now = new Date();
			await tx.insert(member).values({
				id: crypto.randomUUID(),
				organizationId: row.organizationId,
				userId,
				role: row.role,
				createdAt: now,
			});

			await tx
				.update(organizationJoinLink)
				.set({
					useCount: row.useCount + 1,
					lastUsedAt: now,
					lastUsedByUserId: userId,
				})
				.where(eq(organizationJoinLink.id, row.id));

			return {
				status: "joined" as const,
				organizationId: row.organizationId,
				organizationName: row.organizationName,
			};
		});

		return result;
	});

export const selection = authed
	.route({
		method: "GET",
		path: "/organization/selection",
		summary: "Datos de selección de organización",
		tags: ["Organization"],
	})
	.output(OrganizationSelectionSchema)
	.handler(async ({ context }) => {
		const user = context.user;
		const policy = getOrganizationAccessPolicy({ role: user.role });
		const normalizedEmail = user.email.trim().toLowerCase();

		const invitationRows = await context.db
			.select({
				id: invitation.id,
				organizationId: invitation.organizationId,
				organizationName: organization.name,
				organizationSlug: organization.slug,
				role: invitation.role,
				expiresAt: invitation.expiresAt,
				createdAt: invitation.createdAt,
			})
			.from(invitation)
			.innerJoin(organization, eq(invitation.organizationId, organization.id))
			.where(
				and(
					eq(invitation.email, normalizedEmail),
					eq(invitation.status, "pending"),
					gt(invitation.expiresAt, new Date()),
				),
			)
			.orderBy(desc(invitation.createdAt));

		return {
			allowOrganizationCreation: policy.allowSelfServiceCreation,
			contactLabel: policy.contactLabel,
			contactHref: policy.contactHref,
			contactMessage: policy.contactMessage,
			invitations: invitationRows.map((row) => ({
				id: row.id,
				organizationId: row.organizationId,
				organizationName: row.organizationName,
				organizationSlug: row.organizationSlug,
				role: row.role ?? "member",
				expiresAt: toTimestamp(row.expiresAt),
				createdAt: toTimestamp(row.createdAt),
			})),
		};
	});

export const management = orgRequired
	.route({
		method: "GET",
		path: "/organization/management",
		summary: "Datos de gestión de organización",
		tags: ["Organization"],
	})
	.output(OrganizationManagementSchema)
	.handler(async ({ context }) => {
		const organizationId = context.organizationId;
		const currentUser = context.user;

		const [
			organizationRows,
			currentMember,
			membersRows,
			invitationRows,
			joinLinkRows,
		] = await Promise.all([
			context.db
				.select({
					id: organization.id,
					name: organization.name,
					slug: organization.slug,
					logo: organization.logo,
					createdAt: organization.createdAt,
				})
				.from(organization)
				.where(eq(organization.id, organizationId))
				.limit(1),
			getOrganizationMemberOrThrow({
				organizationId,
				userId: currentUser.id,
				db: context.db,
			}),
			context.db
				.select({
					memberId: member.id,
					userId: userTable.id,
					name: userTable.name,
					email: userTable.email,
					role: member.role,
					joinedAt: member.createdAt,
				})
				.from(member)
				.innerJoin(userTable, eq(member.userId, userTable.id))
				.where(eq(member.organizationId, organizationId))
				.orderBy(asc(userTable.name), asc(userTable.email)),
			context.db
				.select({
					id: invitation.id,
					email: invitation.email,
					role: invitation.role,
					expiresAt: invitation.expiresAt,
					createdAt: invitation.createdAt,
				})
				.from(invitation)
				.where(
					and(
						eq(invitation.organizationId, organizationId),
						eq(invitation.status, "pending"),
						gt(invitation.expiresAt, new Date()),
					),
				)
				.orderBy(desc(invitation.createdAt)),
			context.db
				.select({
					id: organizationJoinLink.id,
					token: organizationJoinLink.token,
					role: organizationJoinLink.role,
					label: organizationJoinLink.label,
					createdAt: organizationJoinLink.createdAt,
					expiresAt: organizationJoinLink.expiresAt,
					maxUses: organizationJoinLink.maxUses,
					useCount: organizationJoinLink.useCount,
					lastUsedAt: organizationJoinLink.lastUsedAt,
					lastUsedByUserId: organizationJoinLink.lastUsedByUserId,
					revokedAt: organizationJoinLink.revokedAt,
				})
				.from(organizationJoinLink)
				.where(eq(organizationJoinLink.organizationId, organizationId))
				.orderBy(desc(organizationJoinLink.createdAt)),
		]);

		const organizationRow = organizationRows[0];
		if (!organizationRow) {
			throw new ORPCError("NOT_FOUND", {
				message: "No se encontró la organización activa.",
			});
		}

		const joinLinks = joinLinkRows.map((row) => {
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

		const policy = getOrganizationAccessPolicy({ role: currentUser.role });

		return {
			organization: {
				id: organizationRow.id,
				name: organizationRow.name,
				slug: organizationRow.slug,
				logo: organizationRow.logo,
				createdAt: toTimestamp(organizationRow.createdAt),
			},
			viewer: {
				userId: currentUser.id,
				role: currentMember.role,
				canManageAccess: isOrganizationManagerRole(currentMember.role),
			},
			policy: {
				allowOrganizationCreation: policy.allowSelfServiceCreation,
				contactLabel: policy.contactLabel,
				contactHref: policy.contactHref,
				contactMessage: policy.contactMessage,
			},
			stats: {
				membersCount: membersRows.length,
				pendingInvitationsCount: invitationRows.length,
				activeJoinLinksCount: joinLinks.filter(
					(link) => link.status === "active",
				).length,
			},
			members: membersRows.map((row) => ({
				memberId: row.memberId,
				userId: row.userId,
				name: row.name,
				email: row.email,
				role: row.role,
				joinedAt: toTimestamp(row.joinedAt),
			})),
			pendingInvitations: invitationRows.map((row) => ({
				id: row.id,
				email: row.email,
				role: row.role ?? "member",
				expiresAt: toTimestamp(row.expiresAt),
				createdAt: toTimestamp(row.createdAt),
			})),
			joinLinks,
		};
	});

export const joinLinkCreate = orgRequired
	.route({
		method: "POST",
		path: "/organization/join-link",
		summary: "Crear un join link",
		tags: ["Organization"],
	})
	.input(CreateJoinLinkSchema)
	.handler(async ({ input, context }) => {
		const organizationId = context.organizationId;
		const user = context.user;

		const currentMember = await getOrganizationMemberOrThrow({
			organizationId,
			userId: user.id,
			db: context.db,
		});

		if (!isOrganizationManagerRole(currentMember.role)) {
			throw new ORPCError("FORBIDDEN", {
				message:
					"No tienes permisos para crear enlaces de acceso en esta organización.",
			});
		}

		const token = `${crypto.randomUUID().replaceAll("-", "")}${crypto.randomUUID().replaceAll("-", "")}`;
		const createdAt = new Date();
		const expiresAt = new Date(
			Date.now() + input.expiresInDays * 24 * 60 * 60 * 1000,
		);

		await context.db.insert(organizationJoinLink).values({
			id: crypto.randomUUID(),
			organizationId,
			token,
			role: "member",
			label: normalizeLabel(input.label),
			createdByUserId: user.id,
			createdAt,
			expiresAt,
			maxUses: 1,
			useCount: 0,
			lastUsedAt: null,
			lastUsedByUserId: null,
			revokedAt: null,
		});

		return {
			joinPath: buildOrganizationJoinPath(token),
			expiresAt: expiresAt.getTime(),
		};
	});

export const joinLinkRevoke = orgRequired
	.route({
		method: "POST",
		path: "/organization/join-link/revoke",
		summary: "Revocar un join link",
		tags: ["Organization"],
	})
	.input(RevokeJoinLinkSchema)
	.handler(async ({ input, context }) => {
		const organizationId = context.organizationId;
		const user = context.user;

		const currentMember = await getOrganizationMemberOrThrow({
			organizationId,
			userId: user.id,
			db: context.db,
		});

		if (!isOrganizationManagerRole(currentMember.role)) {
			throw new ORPCError("FORBIDDEN", {
				message:
					"No tienes permisos para revocar enlaces de acceso en esta organización.",
			});
		}

		const [joinLink] = await context.db
			.select({ id: organizationJoinLink.id })
			.from(organizationJoinLink)
			.where(
				and(
					eq(organizationJoinLink.id, input.joinLinkId),
					eq(organizationJoinLink.organizationId, organizationId),
				),
			)
			.limit(1);

		if (!joinLink) {
			throw new ORPCError("NOT_FOUND", {
				message: "No se encontró el enlace solicitado.",
			});
		}

		await context.db
			.update(organizationJoinLink)
			.set({ revokedAt: new Date() })
			.where(eq(organizationJoinLink.id, input.joinLinkId));

		return { success: true };
	});
