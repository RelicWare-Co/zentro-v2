import { and, asc, desc, eq, gt, like, or } from "drizzle-orm";
import { implement, ORPCError } from "@orpc/server";
import {
	invitation,
	member,
	organization,
	organizationJoinLink,
	user as userTable,
} from "../../../database/drizzle/schema/auth.schema";
import { dbSqlite, type Database } from "../../../database/drizzle/db";
import { getOrganizationAccessPolicy } from "../../organization/organization-policy";
import { organizationContract } from "../contracts/organization";
import { authMiddleware } from "../middlewares/auth";
import { dbMiddleware } from "../middlewares/db";
import { requireOrgMiddleware } from "../middlewares/require-org";

const organizationImplementer = implement(organizationContract).$context<{
	headers: Headers;
	db: ReturnType<typeof dbSqlite>;
}>();

const publicProcedure = organizationImplementer.use(dbMiddleware);
const authedProcedure = publicProcedure.use(authMiddleware);
const orgRequiredProcedure = authedProcedure.use(requireOrgMiddleware);

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

export const joinLinkPreview = publicProcedure.joinLinkPreview.handler(
	async ({ input, context }) => {
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
	},
);

export const joinLinkRedeem = authedProcedure.joinLinkRedeem.handler(
	async ({ input, context }) => {
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
	},
);

export const selection = authedProcedure.selection.handler(async ({ context }) => {
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

export const management = orgRequiredProcedure.management.handler(
	async ({ context }) => {
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
	},
);

export const joinLinkCreate = orgRequiredProcedure.joinLinkCreate.handler(
	async ({ input, context }) => {
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
	},
);

export const joinLinkRevoke = orgRequiredProcedure.joinLinkRevoke.handler(
	async ({ input, context }) => {
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
	},
);

function normalizeInvitationResult(row: {
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

function normalizeMemberResult(row: {
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
		throw new ORPCError("FORBIDDEN", {
			message:
				"No tienes permisos para gestionar miembros en esta organización.",
		});
	}
}

const VALID_ORG_ROLES = new Set(["member", "admin", "owner"]);

function validateOrgRole(role: string, callerRole: string | null | undefined) {
	const normalized = role.trim().toLowerCase();
	if (!VALID_ORG_ROLES.has(normalized)) {
		throw new ORPCError("BAD_REQUEST", {
			message: `Rol no válido. Los roles permitidos son: member, admin, owner.`,
		});
	}
	const isOwner = parseRoleList(callerRole).includes("owner");
	if (normalized === "owner" && !isOwner) {
		throw new ORPCError("FORBIDDEN", {
			message: "Solo el owner puede asignar el rol owner.",
		});
	}
	return normalized;
}

export const inviteMember = orgRequiredProcedure.inviteMember.handler(
	async ({ input, context }) => {
		const organizationId = context.organizationId;
		const user = context.user;

		const currentMember = await getOrganizationMemberOrThrow({
			organizationId,
			userId: user.id,
			db: context.db,
		});
		assertCanManageAccess(currentMember.role);

		const validatedRole = validateOrgRole(input.role, currentMember.role);
		const normalizedEmail = input.email.trim().toLowerCase();
		const now = new Date();

		// Prevent inviting an existing member
		const [existingMember] = await context.db
			.select({ id: member.id })
			.from(member)
			.innerJoin(userTable, eq(member.userId, userTable.id))
			.where(
				and(
					eq(member.organizationId, organizationId),
					eq(userTable.email, normalizedEmail),
				),
			)
			.limit(1);
		if (existingMember) {
			throw new ORPCError("BAD_REQUEST", {
				message: "El usuario ya es miembro de esta organización.",
			});
		}

		// Check for pending invitation to the same email
		const [pendingInvitation] = await context.db
			.select({ id: invitation.id })
			.from(invitation)
			.where(
				and(
					eq(invitation.organizationId, organizationId),
					eq(invitation.email, normalizedEmail),
					eq(invitation.status, "pending"),
					gt(invitation.expiresAt, now),
				),
			)
			.limit(1);
		if (pendingInvitation) {
			throw new ORPCError("BAD_REQUEST", {
				message: "Ya existe una invitación pendiente para este correo.",
			});
		}

		const id = crypto.randomUUID();
		const expiresAt = new Date(now.getTime() + 48 * 60 * 60 * 1000); // 48 hours

		await context.db.insert(invitation).values({
			id,
			organizationId,
			inviterId: user.id,
			email: normalizedEmail,
			role: validatedRole,
			status: "pending",
			expiresAt,
			createdAt: now,
		});

		return {
			id,
			email: normalizedEmail,
			role: validatedRole,
			organizationId,
			inviterId: user.id,
			status: "pending",
			expiresAt: expiresAt.getTime(),
			createdAt: now.getTime(),
		};
	},
);

export const cancelInvitation = orgRequiredProcedure.cancelInvitation.handler(
	async ({ input, context }) => {
		const organizationId = context.organizationId;
		const user = context.user;

		const currentMember = await getOrganizationMemberOrThrow({
			organizationId,
			userId: user.id,
			db: context.db,
		});
		assertCanManageAccess(currentMember.role);

		const [inv] = await context.db
			.select({
				id: invitation.id,
				organizationId: invitation.organizationId,
				email: invitation.email,
				role: invitation.role,
				status: invitation.status,
				expiresAt: invitation.expiresAt,
				createdAt: invitation.createdAt,
				inviterId: invitation.inviterId,
			})
			.from(invitation)
			.where(eq(invitation.id, input.invitationId))
			.limit(1);

		if (!inv || inv.organizationId !== organizationId) {
			throw new ORPCError("NOT_FOUND", {
				message: "No se encontró la invitación en esta organización.",
			});
		}

		if (inv.status !== "pending") {
			throw new ORPCError("BAD_REQUEST", {
				message: "Solo se pueden cancelar invitaciones pendientes.",
			});
		}

		await context.db
			.update(invitation)
			.set({ status: "canceled" })
			.where(eq(invitation.id, input.invitationId));

		return normalizeInvitationResult({
			...inv,
			status: "canceled",
		});
	},
);

export const updateMemberRole =
	orgRequiredProcedure.updateMemberRole.handler(
		async ({ input, context }) => {
			const organizationId = context.organizationId;
			const user = context.user;

			const currentMember = await getOrganizationMemberOrThrow({
				organizationId,
				userId: user.id,
				db: context.db,
			});
			assertCanManageAccess(currentMember.role);

			// Verify target member exists in this organization
			const [target] = await context.db
				.select({ id: member.id, role: member.role, userId: member.userId, organizationId: member.organizationId })
				.from(member)
				.where(
					and(
						eq(member.id, input.memberId),
						eq(member.organizationId, organizationId),
					),
				)
				.limit(1);

			if (!target) {
				throw new ORPCError("NOT_FOUND", {
					message: "No se encontró el miembro en esta organización.",
				});
			}

			const normalizedRole = validateOrgRole(input.role, currentMember.role);
			const isOwner = parseRoleList(currentMember.role).includes("owner");
			const targetIsOwner = parseRoleList(target.role).includes("owner");
			const settingOwner = normalizedRole === "owner";

			// Only owners can touch owner roles (assign or remove)
			if ((targetIsOwner || settingOwner) && !isOwner) {
				throw new ORPCError("FORBIDDEN", {
					message: "Solo el owner puede modificar roles de owner.",
				});
			}

			// Protect the last owner: cannot demote the only owner
			if (targetIsOwner && !settingOwner) {
				const owners = await context.db
					.select({ id: member.id })
					.from(member)
					.where(
						and(
							eq(member.organizationId, organizationId),
							like(member.role, "%owner%"),
						),
					);
				if (owners.length <= 1) {
					throw new ORPCError("BAD_REQUEST", {
						message: "No puedes degradar al único owner de la organización.",
					});
				}
			}

			await context.db
				.update(member)
				.set({ role: normalizedRole })
				.where(eq(member.id, input.memberId));

			return normalizeMemberResult({
				id: target.id,
				userId: target.userId,
				organizationId: target.organizationId,
				role: normalizedRole,
			});
		},
	);

export const removeMember = orgRequiredProcedure.removeMember.handler(
	async ({ input, context }) => {
		const organizationId = context.organizationId;
		const user = context.user;

		const currentMember = await getOrganizationMemberOrThrow({
			organizationId,
			userId: user.id,
			db: context.db,
		});
		assertCanManageAccess(currentMember.role);

		const [targetMemberRow] = await context.db
			.select({
				id: member.id,
				role: member.role,
				userId: member.userId,
				organizationId: member.organizationId,
			})
			.from(member)
			.innerJoin(userTable, eq(member.userId, userTable.id))
			.where(
				and(
					eq(member.organizationId, organizationId),
					or(eq(member.id, input.memberIdOrEmail), eq(userTable.email, input.memberIdOrEmail)),
				),
			)
			.limit(1);

		if (!targetMemberRow) {
			throw new ORPCError("NOT_FOUND", {
				message: "No se encontró el miembro en esta organización.",
			});
		}

		// Only owners can remove other owners
		if (
			parseRoleList(targetMemberRow.role).includes("owner") &&
			!parseRoleList(currentMember.role).includes("owner")
		) {
			throw new ORPCError("FORBIDDEN", {
				message: "Solo el owner puede remover a un owner.",
			});
		}

		// Protect removing the last owner
		if (parseRoleList(targetMemberRow.role).includes("owner")) {
			const owners = await context.db
				.select({ id: member.id })
				.from(member)
				.where(
					and(
						eq(member.organizationId, organizationId),
						like(member.role, "%owner%"),
					),
				);
			if (owners.length <= 1) {
				throw new ORPCError("BAD_REQUEST", {
					message: "No puedes remover al único owner de la organización.",
				});
			}
		}

		await context.db
			.delete(member)
			.where(
				and(
					eq(member.id, targetMemberRow.id),
					eq(member.organizationId, organizationId),
				),
			);

		return normalizeMemberResult(targetMemberRow);
	},
);

export const leaveOrganization = orgRequiredProcedure.leaveOrganization.handler(
	async ({ input, context }) => {
		const user = context.user;
		const organizationId = input.organizationId;

		const [currentMember] = await context.db
			.select({ id: member.id, role: member.role })
			.from(member)
			.where(
				and(
					eq(member.organizationId, organizationId),
					eq(member.userId, user.id),
				),
			)
			.limit(1);

		if (!currentMember) {
			throw new ORPCError("NOT_FOUND", {
				message: "No eres miembro de esta organización.",
			});
		}

		// Prevent leaving if you're the only owner
		if (parseRoleList(currentMember.role).includes("owner")) {
			const owners = await context.db
				.select({ id: member.id })
				.from(member)
				.where(
					and(
						eq(member.organizationId, organizationId),
						like(member.role, "%owner%"),
					),
				);
			if (owners.length <= 1) {
				throw new ORPCError("BAD_REQUEST", {
					message: "No puedes salir si eres el único owner.",
				});
			}
		}

		await context.db
			.delete(member)
			.where(
				and(
					eq(member.organizationId, organizationId),
					eq(member.userId, user.id),
				),
			);

		return normalizeMemberResult({
			id: currentMember.id,
			userId: user.id,
			organizationId,
			role: currentMember.role,
		});
	},
);

export const updateOrganization = orgRequiredProcedure.updateOrganization.handler(
	async ({ input, context }) => {
		const organizationId = context.organizationId;
		const user = context.user;

		const currentMember = await getOrganizationMemberOrThrow({
			organizationId,
			userId: user.id,
			db: context.db,
		});
		assertCanManageAccess(currentMember.role);

		const setData: Partial<Record<string, unknown>> = {};
		if (input.name !== undefined) setData.name = input.name;
		if (input.slug !== undefined) setData.slug = input.slug;
		if (input.logo !== undefined) setData.logo = input.logo;

		if (Object.keys(setData).length === 0) {
			throw new ORPCError("BAD_REQUEST", {
				message: "No se proporcionaron campos para actualizar.",
			});
		}

		await context.db
			.update(organization)
			.set(setData)
			.where(eq(organization.id, organizationId));

		const [updatedOrg] = await context.db
			.select({
				id: organization.id,
				name: organization.name,
				slug: organization.slug,
				logo: organization.logo,
			})
			.from(organization)
			.where(eq(organization.id, organizationId))
			.limit(1);

		return updatedOrg ?? { id: organizationId, name: "", slug: "", logo: null };
	},
);

export const deleteOrganization = orgRequiredProcedure.deleteOrganization.handler(
	async ({ input, context }) => {
		const user = context.user;
		const organizationId = context.organizationId;

		if (input.organizationId !== organizationId) {
			throw new ORPCError("FORBIDDEN", {
				message: "No puedes eliminar una organización diferente a la activa.",
			});
		}

		const currentMember = await getOrganizationMemberOrThrow({
			organizationId,
			userId: user.id,
			db: context.db,
		});

		if (!parseRoleList(currentMember.role).includes("owner")) {
			throw new ORPCError("FORBIDDEN", {
				message: "Solo el owner puede eliminar la organización.",
			});
		}

		await context.db
			.delete(organization)
			.where(eq(organization.id, organizationId));

		return { success: true };
	},
);
