import { describe, test, expect } from "bun:test";
import { createTestDb } from "./helpers/test-db";
import {
	seedOrganizationWithMember,
	seedInvitation,
	seedJoinLink,
	makeUser,
	seedUser,
} from "./helpers/seed";
import { buildMockContext } from "./helpers/orpc-context";
import { createServerORPCClient } from "../server/orpc/client/server";
import { member } from "../database/drizzle/schema/auth.schema";
import { and, eq } from "drizzle-orm";

describe("organization access control", () => {
	describe("VAL-ORG-001: join link creation authorization", () => {
		test("manager can create join links", async () => {
			const { db, cleanup } = createTestDb();
			const { organizationId, userId } = await seedOrganizationWithMember(db, {
				memberRole: "admin",
			});
			const u = makeUser({ id: userId, email: "admin@example.com" });
			const ctx = buildMockContext(db, u, organizationId);
			const client = createServerORPCClient(ctx);

			const result = await client.organization.joinLinkCreate({
				label: "Test Link",
				expiresInDays: 7,
			});
			expect(result.joinPath).toStartWith("/join?token=");
			expect(result.expiresAt).toBeNumber();

			await cleanup();
		});

		test("non-manager is rejected when creating join links", async () => {
			const { db, cleanup } = createTestDb();
			const { organizationId, userId } = await seedOrganizationWithMember(db, {
				memberRole: "cashier",
			});
			const u = makeUser({ id: userId, email: "cashier@example.com" });
			const ctx = buildMockContext(db, u, organizationId);
			const client = createServerORPCClient(ctx);

			await expect(
				client.organization.joinLinkCreate({
					label: "Test Link",
					expiresInDays: 7,
				}),
			).rejects.toThrow("No tienes permisos");

			await cleanup();
		});
	});

	describe("VAL-ORG-002: join link redemption adds user as member", () => {
		test("redeeming a join link adds the user as a member", async () => {
			const { db, cleanup } = createTestDb();
			const { organizationId, userId: creatorId } = await seedOrganizationWithMember(db, {
				memberRole: "owner",
			});
			const token = "redeem-test-token-123";
			await seedJoinLink(
				db,
				{
					organizationId,
					token,
					createdByUserId: creatorId,
					maxUses: 1,
				},
			);

			const redeemer = await seedUser(db, {
				name: "Redeemer",
				email: "redeemer@example.com",
			});

			const ctx = buildMockContext(db, redeemer, organizationId);
			const client = createServerORPCClient(ctx);

			const result = await client.organization.joinLinkRedeem({ token });
			expect(result.status).toBe("joined");
			expect(result.organizationId).toBe(organizationId);

			const memberships = await db
				.select()
				.from(member)
				.where(
					and(eq(member.organizationId, organizationId), eq(member.userId, redeemer.id)),
				);
			expect(memberships.length).toBe(1);
			expect(memberships[0].role).toBe("member");

			await cleanup();
		});

		test("redeeming by an existing member returns already-member", async () => {
			const { db, cleanup } = createTestDb();
			const { organizationId, userId } = await seedOrganizationWithMember(db, {
				memberRole: "member",
			});
			const token = "existing-member-token";
			await seedJoinLink(db, {
				organizationId,
				token,
				createdByUserId: userId,
				maxUses: 1,
			});

			const u = makeUser({ id: userId, email: "member@example.com" });
			const ctx = buildMockContext(db, u, organizationId);
			const client = createServerORPCClient(ctx);

			const result = await client.organization.joinLinkRedeem({ token });
			expect(result.status).toBe("already-member");

			await cleanup();
		});
	});

	describe("VAL-ORG-003: join link preview returns correct status", () => {
		test("preview returns active for a valid token", async () => {
			const { db, cleanup } = createTestDb();
			const { organizationId, userId } = await seedOrganizationWithMember(db);
			const token = "active-token";
			await seedJoinLink(db, {
				organizationId,
				token,
				createdByUserId: userId,
				expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
			});

			const ctx = buildMockContext(db, makeUser(), organizationId);
			const client = createServerORPCClient(ctx);
			const result = await client.organization.joinLinkPreview({ token });
			expect(result.status).toBe("active");
			expect(result.canJoin).toBe(true);
			expect(result.organization).not.toBeNull();

			await cleanup();
		});

		test("preview returns expired for an expired token", async () => {
			const { db, cleanup } = createTestDb();
			const { organizationId, userId } = await seedOrganizationWithMember(db);
			const token = "expired-token";
			await seedJoinLink(db, {
				organizationId,
				token,
				createdByUserId: userId,
				expiresAt: new Date(Date.now() - 1000),
			});

			const ctx = buildMockContext(db, makeUser(), organizationId);
			const client = createServerORPCClient(ctx);
			const result = await client.organization.joinLinkPreview({ token });
			expect(result.status).toBe("expired");
			expect(result.canJoin).toBe(false);

			await cleanup();
		});

		test("preview returns revoked for a revoked token", async () => {
			const { db, cleanup } = createTestDb();
			const { organizationId, userId } = await seedOrganizationWithMember(db);
			const token = "revoked-token";
			await seedJoinLink(db, {
				organizationId,
				token,
				createdByUserId: userId,
				revokedAt: new Date(),
			});

			const ctx = buildMockContext(db, makeUser(), organizationId);
			const client = createServerORPCClient(ctx);
			const result = await client.organization.joinLinkPreview({ token });
			expect(result.status).toBe("revoked");
			expect(result.canJoin).toBe(false);

			await cleanup();
		});
	});

	describe("VAL-ORG-004: organization selection data includes invitations and contact fallback", () => {
		test("selection returns pending invitations for the user", async () => {
			const { db, cleanup } = createTestDb();
			const { organizationId, userId } = await seedOrganizationWithMember(db, {
				userEmail: "alice@example.com",
			});
			await seedInvitation(db, {
				organizationId,
				inviterId: userId,
				email: "alice@example.com",
				role: "admin",
			});

			const u = makeUser({ id: userId, email: "alice@example.com" });
			const ctx = buildMockContext(db, u, organizationId);
			const client = createServerORPCClient(ctx);

			const result = await client.organization.selection();
			expect(result.invitations.length).toBe(1);
			expect(result.invitations[0].role).toBe("admin");
			expect(result.invitations[0].organizationName).toBeString();

			await cleanup();
		});

		test("selection includes contact fallback fields", async () => {
			const { db, cleanup } = createTestDb();
			const { organizationId, userId } = await seedOrganizationWithMember(db, {
				memberRole: "member",
			});

			const u = makeUser({ id: userId, email: "member@example.com" });
			const ctx = buildMockContext(db, u, organizationId);
			const client = createServerORPCClient(ctx);

			const result = await client.organization.selection();
			expect(typeof result.allowOrganizationCreation).toBe("boolean");
			expect(result.contactMessage).toBeString();

			await cleanup();
		});
	});

	describe("VAL-ORG-005: management data includes members, stats, and join links", () => {
		test("management returns members list, stats, and join links", async () => {
			const { db, cleanup } = createTestDb();
			const { organizationId, userId } = await seedOrganizationWithMember(db, {
				memberRole: "owner",
				userName: "Manager",
			});
			await seedInvitation(db, {
				organizationId,
				inviterId: userId,
				email: "invited@example.com",
			});
			await seedJoinLink(db, {
				organizationId,
				token: "mgmt-token",
				createdByUserId: userId,
			});

			const u = makeUser({ id: userId, email: "manager@example.com" });
			const ctx = buildMockContext(db, u, organizationId);
			const client = createServerORPCClient(ctx);

			const result = await client.organization.management();
			expect(result.members.length).toBeGreaterThanOrEqual(1);
			expect(result.stats.membersCount).toBe(result.members.length);
			expect(result.stats.pendingInvitationsCount).toBe(1);
			expect(result.stats.activeJoinLinksCount).toBe(1);
			expect(result.joinLinks.length).toBeGreaterThanOrEqual(1);
			expect(result.joinLinks[0].status).toBe("active");

			await cleanup();
		});
	});

	describe("VAL-ORG-006: operations without active organization are rejected", () => {
		test("organization-scoped procedure rejects when no active organization", async () => {
			const { db, cleanup } = createTestDb();
			const { organizationId, userId } = await seedOrganizationWithMember(db);

			const u = makeUser({ id: userId, email: "noorg@example.com" });
			// Build context without activeOrganizationId
			const ctx = buildMockContext(db, u, null);
			const client = createServerORPCClient(ctx);

			await expect(client.products.list()).rejects.toThrow("No hay una organización activa");

			await cleanup();
		});
	});
});
