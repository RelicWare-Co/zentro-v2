import { describe, expect, test } from "bun:test";
import { and, eq } from "drizzle-orm";
import {
  invitation,
  member,
  organization,
} from "@/database/drizzle/schema/auth.schema";
import {
  seedInvitation,
  seedJoinLink,
  seedOrganizationWithMember,
  seedUser,
} from "./helpers/seed";
import { createTestDb } from "./helpers/test-db";
import {
  cancelInvitationViaZero,
  deleteOrganizationViaZero,
  getJoinLinkPreviewViaZero,
  getOrganizationManagementViaZero,
  getOrganizationSelectionViaZero,
  inviteMemberViaZero,
  joinLinkCreateViaZero,
  joinLinkRedeemViaZero,
  leaveOrganizationViaZero,
  removeMemberViaZero,
  updateMemberRoleViaZero,
  updateOrganizationViaZero,
} from "./helpers/zero-organization";
import { createZeroContext, createZeroTestDb } from "./helpers/zero-shifts";

describe("organization access control", () => {
  describe("VAL-ORG-001: join link creation authorization", () => {
    test("manager can create join links", async () => {
      const { db, cleanup } = await createTestDb();
      const { organizationId, userId } = await seedOrganizationWithMember(db, {
        memberRole: "admin",
      });
      const zeroDb = createZeroTestDb(db);
      const ctx = createZeroContext(userId, organizationId, {
        email: "admin@example.com",
      });

      const result = await joinLinkCreateViaZero({
        zeroDb,
        ctx,
        input: {
          label: "Test Link",
          expiresInDays: 7,
        },
      });
      expect(result.joinPath).toStartWith("/join?token=");
      expect(result.expiresAt).toBeNumber();

      await cleanup();
    });

    test("non-manager is rejected when creating join links", async () => {
      const { db, cleanup } = await createTestDb();
      const { organizationId, userId } = await seedOrganizationWithMember(db, {
        memberRole: "cashier",
      });
      const zeroDb = createZeroTestDb(db);
      const ctx = createZeroContext(userId, organizationId, {
        email: "cashier@example.com",
      });

      await expect(
        joinLinkCreateViaZero({
          zeroDb,
          ctx,
          input: {
            label: "Test Link",
            expiresInDays: 7,
          },
        })
      ).rejects.toThrow("No tienes permisos");

      await cleanup();
    });
  });

  describe("VAL-ORG-002: join link redemption adds user as member", () => {
    test("redeeming a join link adds the user as a member", async () => {
      const { db, cleanup } = await createTestDb();
      const { organizationId, userId: creatorId } =
        await seedOrganizationWithMember(db, {
          memberRole: "owner",
        });
      const token = "redeem-test-token-123";
      await seedJoinLink(db, {
        organizationId,
        token,
        createdByUserId: creatorId,
        maxUses: 1,
      });

      const redeemer = await seedUser(db, {
        name: "Redeemer",
        email: "redeemer@example.com",
      });

      const zeroDb = createZeroTestDb(db);
      const ctx = createZeroContext(redeemer.id, organizationId, {
        email: "redeemer@example.com",
      });

      await joinLinkRedeemViaZero({ zeroDb, ctx, input: { token } });

      const memberships = await db
        .select()
        .from(member)
        .where(
          and(
            eq(member.organizationId, organizationId),
            eq(member.userId, redeemer.id)
          )
        );
      expect(memberships.length).toBe(1);
      expect(memberships[0].role).toBe("member");

      await cleanup();
    });

    test("redeeming by an existing member returns already-member", async () => {
      const { db, cleanup } = await createTestDb();
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

      const zeroDb = createZeroTestDb(db);
      const ctx = createZeroContext(userId, organizationId, {
        email: "member@example.com",
      });

      const beforeMemberships = await db
        .select()
        .from(member)
        .where(
          and(
            eq(member.organizationId, organizationId),
            eq(member.userId, userId)
          )
        );
      expect(beforeMemberships.length).toBe(1);

      await joinLinkRedeemViaZero({ zeroDb, ctx, input: { token } });

      const afterMemberships = await db
        .select()
        .from(member)
        .where(
          and(
            eq(member.organizationId, organizationId),
            eq(member.userId, userId)
          )
        );
      expect(afterMemberships.length).toBe(1);
      expect(afterMemberships[0].id).toBe(beforeMemberships[0].id);

      await cleanup();
    });
  });

  describe("VAL-ORG-003: join link preview returns correct status", () => {
    test("preview returns active for a valid token", async () => {
      const { db, cleanup } = await createTestDb();
      const { organizationId, userId } = await seedOrganizationWithMember(db);
      const token = "active-token";
      await seedJoinLink(db, {
        organizationId,
        token,
        createdByUserId: userId,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      });

      const zeroDb = createZeroTestDb(db);
      const result = await getJoinLinkPreviewViaZero({ zeroDb, token });
      expect(result.status).toBe("active");
      expect(result.canJoin).toBe(true);
      expect(result.organization).not.toBeNull();

      await cleanup();
    });

    test("preview returns expired for an expired token", async () => {
      const { db, cleanup } = await createTestDb();
      const { organizationId, userId } = await seedOrganizationWithMember(db);
      const token = "expired-token";
      await seedJoinLink(db, {
        organizationId,
        token,
        createdByUserId: userId,
        expiresAt: new Date(Date.now() - 1000),
      });

      const zeroDb = createZeroTestDb(db);
      const result = await getJoinLinkPreviewViaZero({ zeroDb, token });
      expect(result.status).toBe("expired");
      expect(result.canJoin).toBe(false);

      await cleanup();
    });

    test("preview returns revoked for a revoked token", async () => {
      const { db, cleanup } = await createTestDb();
      const { organizationId, userId } = await seedOrganizationWithMember(db);
      const token = "revoked-token";
      await seedJoinLink(db, {
        organizationId,
        token,
        createdByUserId: userId,
        revokedAt: new Date(),
      });

      const zeroDb = createZeroTestDb(db);
      const result = await getJoinLinkPreviewViaZero({ zeroDb, token });
      expect(result.status).toBe("revoked");
      expect(result.canJoin).toBe(false);

      await cleanup();
    });
  });

  describe("VAL-ORG-004: organization selection data includes invitations and contact fallback", () => {
    test("selection returns pending invitations for the user", async () => {
      const { db, cleanup } = await createTestDb();
      const { organizationId, userId } = await seedOrganizationWithMember(db, {
        userEmail: "alice@example.com",
      });
      await seedInvitation(db, {
        organizationId,
        inviterId: userId,
        email: "alice@example.com",
        role: "admin",
      });

      const zeroDb = createZeroTestDb(db);
      const ctx = createZeroContext(userId, organizationId, {
        email: "alice@example.com",
      });

      const result = await getOrganizationSelectionViaZero({ zeroDb, ctx });
      expect(result.invitations.length).toBe(1);
      expect(result.invitations[0].role).toBe("admin");
      expect(result.invitations[0].organizationName).toBeString();

      await cleanup();
    });

    test("selection includes contact fallback fields", async () => {
      const { db, cleanup } = await createTestDb();
      const { organizationId, userId } = await seedOrganizationWithMember(db, {
        memberRole: "member",
      });

      const zeroDb = createZeroTestDb(db);
      const ctx = createZeroContext(userId, organizationId, {
        email: "member@example.com",
      });

      const result = await getOrganizationSelectionViaZero({ zeroDb, ctx });
      expect(typeof result.allowOrganizationCreation).toBe("boolean");
      expect(result.contactMessage).toBeString();

      await cleanup();
    });
  });

  describe("VAL-ORG-005: management data includes members, stats, and join links", () => {
    test("management returns members list, stats, and join links", async () => {
      const { db, cleanup } = await createTestDb();
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

      const zeroDb = createZeroTestDb(db);
      const ctx = createZeroContext(userId, organizationId, {
        email: "manager@example.com",
      });

      const result = await getOrganizationManagementViaZero({ zeroDb, ctx });
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
      const { db, cleanup } = await createTestDb();
      const { organizationId } = await seedOrganizationWithMember(db);
      const outsider = await seedUser(db, {
        name: "Outsider",
        email: "noorg@example.com",
      });

      const zeroDb = createZeroTestDb(db);
      const ctx = createZeroContext(outsider.id, organizationId, {
        email: "noorg@example.com",
      });

      await expect(
        getOrganizationManagementViaZero({ zeroDb, ctx })
      ).rejects.toThrow("No perteneces a la organización activa.");

      await cleanup();
    });
  });

  describe("VAL-ORG-007: invite member authorization", () => {
    test("manager can invite a member", async () => {
      const { db, cleanup } = await createTestDb();
      const { organizationId, userId } = await seedOrganizationWithMember(db, {
        memberRole: "admin",
      });
      const zeroDb = createZeroTestDb(db);
      const ctx = createZeroContext(userId, organizationId, {
        email: "admin@example.com",
      });

      await inviteMemberViaZero({
        zeroDb,
        ctx,
        input: {
          email: "newuser@example.com",
          role: "member",
        },
      });

      const [invitationRow] = await db
        .select()
        .from(invitation)
        .where(
          and(
            eq(invitation.organizationId, organizationId),
            eq(invitation.email, "newuser@example.com")
          )
        );
      expect(invitationRow.email).toBe("newuser@example.com");
      expect(invitationRow.role).toBe("member");
      expect(invitationRow.status).toBe("pending");

      await cleanup();
    });

    test("non-manager is rejected when inviting", async () => {
      const { db, cleanup } = await createTestDb();
      const { organizationId, userId } = await seedOrganizationWithMember(db, {
        memberRole: "cashier",
      });
      const zeroDb = createZeroTestDb(db);
      const ctx = createZeroContext(userId, organizationId, {
        email: "cashier@example.com",
      });

      await expect(
        inviteMemberViaZero({
          zeroDb,
          ctx,
          input: {
            email: "newuser@example.com",
            role: "member",
          },
        })
      ).rejects.toThrow("No tienes permisos");

      await cleanup();
    });

    test("inviting an existing member is rejected", async () => {
      const { db, cleanup } = await createTestDb();
      const { organizationId, userId } = await seedOrganizationWithMember(db, {
        memberRole: "admin",
        userEmail: "admin@example.com",
      });
      const zeroDb = createZeroTestDb(db);
      const ctx = createZeroContext(userId, organizationId, {
        email: "admin@example.com",
      });

      await expect(
        inviteMemberViaZero({
          zeroDb,
          ctx,
          input: {
            email: "admin@example.com",
            role: "member",
          },
        })
      ).rejects.toThrow("ya es miembro");

      await cleanup();
    });

    test("non-owner inviting with owner role is rejected", async () => {
      const { db, cleanup } = await createTestDb();
      const { organizationId, userId } = await seedOrganizationWithMember(db, {
        memberRole: "admin",
      });
      const zeroDb = createZeroTestDb(db);
      const ctx = createZeroContext(userId, organizationId, {
        email: "admin@example.com",
      });

      await expect(
        inviteMemberViaZero({
          zeroDb,
          ctx,
          input: {
            email: "newowner@example.com",
            role: "owner",
          },
        })
      ).rejects.toThrow("Solo el owner");

      await cleanup();
    });

    test("invalid role is rejected", async () => {
      const { db, cleanup } = await createTestDb();
      const { organizationId, userId } = await seedOrganizationWithMember(db, {
        memberRole: "owner",
      });
      const zeroDb = createZeroTestDb(db);
      const ctx = createZeroContext(userId, organizationId, {
        email: "owner@example.com",
      });

      await expect(
        inviteMemberViaZero({
          zeroDb,
          ctx,
          input: {
            email: "hacker@example.com",
            role: "superuser",
          },
        })
      ).rejects.toThrow("Rol no válido");

      await cleanup();
    });
  });

  describe("VAL-ORG-008: cancel invitation authorization", () => {
    test("manager can cancel a pending invitation", async () => {
      const { db, cleanup } = await createTestDb();
      const { organizationId, userId } = await seedOrganizationWithMember(db, {
        memberRole: "admin",
      });
      const invId = await seedInvitation(db, {
        organizationId,
        inviterId: userId,
        email: "invited@example.com",
        status: "pending",
      });

      const zeroDb = createZeroTestDb(db);
      const ctx = createZeroContext(userId, organizationId, {
        email: "admin@example.com",
      });

      await cancelInvitationViaZero({
        zeroDb,
        ctx,
        input: { invitationId: invId },
      });

      const [invitationRow] = await db
        .select()
        .from(invitation)
        .where(eq(invitation.id, invId));
      expect(invitationRow.status).toBe("canceled");

      await cleanup();
    });

    test("canceling already-canceled invitation is rejected", async () => {
      const { db, cleanup } = await createTestDb();
      const { organizationId, userId } = await seedOrganizationWithMember(db, {
        memberRole: "admin",
      });
      const invId = await seedInvitation(db, {
        organizationId,
        inviterId: userId,
        email: "invited@example.com",
        status: "canceled",
      });

      const zeroDb = createZeroTestDb(db);
      const ctx = createZeroContext(userId, organizationId, {
        email: "admin@example.com",
      });

      await expect(
        cancelInvitationViaZero({
          zeroDb,
          ctx,
          input: { invitationId: invId },
        })
      ).rejects.toThrow("Solo se pueden cancelar invitaciones pendientes");

      await cleanup();
    });

    test("canceling invitation from another organization is rejected", async () => {
      const { db, cleanup } = await createTestDb();
      const [{ organizationId, userId }, otherOrg] = await Promise.all([
        seedOrganizationWithMember(db, {
          memberRole: "admin",
        }),
        seedOrganizationWithMember(db, {
          orgName: "Other",
          orgSlug: "other",
        }),
      ]);
      const invId = await seedInvitation(db, {
        organizationId: otherOrg.organizationId,
        inviterId: otherOrg.userId,
        email: "invited@example.com",
        status: "pending",
      });

      const zeroDb = createZeroTestDb(db);
      const ctx = createZeroContext(userId, organizationId, {
        email: "admin@example.com",
      });

      await expect(
        cancelInvitationViaZero({
          zeroDb,
          ctx,
          input: { invitationId: invId },
        })
      ).rejects.toThrow("No se encontró la invitación");

      await cleanup();
    });
  });

  describe("VAL-ORG-009: update member role authorization", () => {
    test("manager can update a member role", async () => {
      const { db, cleanup } = await createTestDb();
      const [{ organizationId, userId }, targetUser] = await Promise.all([
        seedOrganizationWithMember(db, {
          memberRole: "owner",
        }),
        seedUser(db, { name: "Target", email: "target@example.com" }),
      ]);
      await db.insert(member).values({
        id: crypto.randomUUID(),
        organizationId,
        userId: targetUser.id,
        role: "member",
        createdAt: new Date(),
      });

      const zeroDb = createZeroTestDb(db);
      const ctx = createZeroContext(userId, organizationId, {
        email: "owner@example.com",
      });

      const rows = await db
        .select({ id: member.id })
        .from(member)
        .where(
          and(
            eq(member.organizationId, organizationId),
            eq(member.userId, targetUser.id)
          )
        );
      const targetMemberId = rows[0].id;

      await updateMemberRoleViaZero({
        zeroDb,
        ctx,
        input: {
          memberId: targetMemberId,
          role: "admin",
        },
      });

      const [updatedMember] = await db
        .select()
        .from(member)
        .where(eq(member.id, targetMemberId));
      expect(updatedMember.role).toBe("admin");

      await cleanup();
    });

    test("non-owner cannot assign owner role", async () => {
      const { db, cleanup } = await createTestDb();
      const [{ organizationId, userId }, targetUser] = await Promise.all([
        seedOrganizationWithMember(db, {
          memberRole: "admin",
        }),
        seedUser(db, { name: "Target", email: "target@example.com" }),
      ]);
      await db.insert(member).values({
        id: crypto.randomUUID(),
        organizationId,
        userId: targetUser.id,
        role: "member",
        createdAt: new Date(),
      });

      const zeroDb = createZeroTestDb(db);
      const ctx = createZeroContext(userId, organizationId, {
        email: "admin@example.com",
      });

      const rows = await db
        .select({ id: member.id })
        .from(member)
        .where(
          and(
            eq(member.organizationId, organizationId),
            eq(member.userId, targetUser.id)
          )
        );
      const targetMemberId = rows[0].id;

      await expect(
        updateMemberRoleViaZero({
          zeroDb,
          ctx,
          input: {
            memberId: targetMemberId,
            role: "owner",
          },
        })
      ).rejects.toThrow("Solo el owner");

      await cleanup();
    });

    test("non-owner cannot demote an existing owner", async () => {
      const { db, cleanup } = await createTestDb();
      const [{ organizationId, userId }, targetUser] = await Promise.all([
        seedOrganizationWithMember(db, {
          memberRole: "admin",
        }),
        seedUser(db, { name: "Target", email: "target@example.com" }),
      ]);
      await db.insert(member).values({
        id: crypto.randomUUID(),
        organizationId,
        userId: targetUser.id,
        role: "owner",
        createdAt: new Date(),
      });

      const zeroDb = createZeroTestDb(db);
      const ctx = createZeroContext(userId, organizationId, {
        email: "admin@example.com",
      });

      const rows = await db
        .select({ id: member.id })
        .from(member)
        .where(
          and(
            eq(member.organizationId, organizationId),
            eq(member.userId, targetUser.id)
          )
        );
      const targetMemberId = rows[0].id;

      await expect(
        updateMemberRoleViaZero({
          zeroDb,
          ctx,
          input: {
            memberId: targetMemberId,
            role: "member",
          },
        })
      ).rejects.toThrow("Solo el owner");

      await cleanup();
    });

    test("demoting the last owner is rejected", async () => {
      const { db, cleanup } = await createTestDb();
      const { organizationId, userId } = await seedOrganizationWithMember(db, {
        memberRole: "owner",
      });

      const zeroDb = createZeroTestDb(db);
      const ctx = createZeroContext(userId, organizationId, {
        email: "owner@example.com",
      });

      const rows = await db
        .select({ id: member.id })
        .from(member)
        .where(
          and(
            eq(member.organizationId, organizationId),
            eq(member.userId, userId)
          )
        );
      const ownMemberId = rows[0].id;

      await expect(
        updateMemberRoleViaZero({
          zeroDb,
          ctx,
          input: {
            memberId: ownMemberId,
            role: "admin",
          },
        })
      ).rejects.toThrow("único owner");

      await cleanup();
    });

    test("invalid role is rejected in updateMemberRole", async () => {
      const { db, cleanup } = await createTestDb();
      const [{ organizationId, userId }, targetUser] = await Promise.all([
        seedOrganizationWithMember(db, {
          memberRole: "owner",
        }),
        seedUser(db, { name: "Target", email: "target@example.com" }),
      ]);
      await db.insert(member).values({
        id: crypto.randomUUID(),
        organizationId,
        userId: targetUser.id,
        role: "member",
        createdAt: new Date(),
      });

      const zeroDb = createZeroTestDb(db);
      const ctx = createZeroContext(userId, organizationId, {
        email: "owner@example.com",
      });

      const rows = await db
        .select({ id: member.id })
        .from(member)
        .where(
          and(
            eq(member.organizationId, organizationId),
            eq(member.userId, targetUser.id)
          )
        );
      const targetMemberId = rows[0].id;

      await expect(
        updateMemberRoleViaZero({
          zeroDb,
          ctx,
          input: {
            memberId: targetMemberId,
            role: "superuser",
          },
        })
      ).rejects.toThrow("Rol no válido");

      await cleanup();
    });
  });

  describe("VAL-ORG-010: remove member authorization", () => {
    test("manager can remove a member", async () => {
      const { db, cleanup } = await createTestDb();
      const [{ organizationId, userId }, targetUser] = await Promise.all([
        seedOrganizationWithMember(db, {
          memberRole: "owner",
        }),
        seedUser(db, { name: "Target", email: "target@example.com" }),
      ]);
      await db.insert(member).values({
        id: crypto.randomUUID(),
        organizationId,
        userId: targetUser.id,
        role: "member",
        createdAt: new Date(),
      });

      const zeroDb = createZeroTestDb(db);
      const ctx = createZeroContext(userId, organizationId, {
        email: "owner@example.com",
      });

      const rows = await db
        .select({ id: member.id })
        .from(member)
        .where(
          and(
            eq(member.organizationId, organizationId),
            eq(member.userId, targetUser.id)
          )
        );
      const targetMemberId = rows[0].id;

      await removeMemberViaZero({
        zeroDb,
        ctx,
        input: { memberIdOrEmail: targetMemberId },
      });

      const remaining = await db
        .select()
        .from(member)
        .where(eq(member.id, targetMemberId));
      expect(remaining.length).toBe(0);

      await cleanup();
    });

    test("removing the last owner is rejected", async () => {
      const { db, cleanup } = await createTestDb();
      const { organizationId, userId } = await seedOrganizationWithMember(db, {
        memberRole: "owner",
      });

      const zeroDb = createZeroTestDb(db);
      const ctx = createZeroContext(userId, organizationId, {
        email: "owner@example.com",
      });

      const rows = await db
        .select({ id: member.id })
        .from(member)
        .where(
          and(
            eq(member.organizationId, organizationId),
            eq(member.userId, userId)
          )
        );
      const ownMemberId = rows[0].id;

      await expect(
        removeMemberViaZero({
          zeroDb,
          ctx,
          input: { memberIdOrEmail: ownMemberId },
        })
      ).rejects.toThrow("único owner");

      await cleanup();
    });

    test("non-owner cannot remove an owner even if multiple owners exist", async () => {
      const { db, cleanup } = await createTestDb();
      const { organizationId, userId } = await seedOrganizationWithMember(db, {
        memberRole: "admin",
      });
      const [owner1, owner2] = await Promise.all([
        seedUser(db, { name: "Owner1", email: "owner1@example.com" }),
        seedUser(db, { name: "Owner2", email: "owner2@example.com" }),
      ]);
      expect(owner1.id).toBeDefined();
      expect(owner2.id).toBeDefined();
      await db.insert(member).values([
        {
          id: crypto.randomUUID(),
          organizationId,
          userId: owner1.id,
          role: "owner",
          createdAt: new Date(),
        },
        {
          id: crypto.randomUUID(),
          organizationId,
          userId: owner2.id,
          role: "owner",
          createdAt: new Date(),
        },
      ]);

      const zeroDb = createZeroTestDb(db);
      const ctx = createZeroContext(userId, organizationId, {
        email: "admin@example.com",
      });

      const rows = await db
        .select({ id: member.id })
        .from(member)
        .where(
          and(
            eq(member.organizationId, organizationId),
            eq(member.userId, owner1.id)
          )
        );
      const targetMemberId = rows[0].id;

      await expect(
        removeMemberViaZero({
          zeroDb,
          ctx,
          input: { memberIdOrEmail: targetMemberId },
        })
      ).rejects.toThrow("Solo el owner");

      await cleanup();
    });
  });

  describe("VAL-ORG-011: leave organization", () => {
    test("member can leave organization", async () => {
      const { db, cleanup } = await createTestDb();
      const { organizationId, userId } = await seedOrganizationWithMember(db, {
        memberRole: "admin",
      });

      const zeroDb = createZeroTestDb(db);
      const ctx = createZeroContext(userId, organizationId, {
        email: "admin@example.com",
      });

      await leaveOrganizationViaZero({
        zeroDb,
        ctx,
        input: { organizationId },
      });

      const remaining = await db
        .select()
        .from(member)
        .where(
          and(
            eq(member.organizationId, organizationId),
            eq(member.userId, userId)
          )
        );
      expect(remaining.length).toBe(0);

      await cleanup();
    });

    test("last owner cannot leave", async () => {
      const { db, cleanup } = await createTestDb();
      const { organizationId, userId } = await seedOrganizationWithMember(db, {
        memberRole: "owner",
      });

      const zeroDb = createZeroTestDb(db);
      const ctx = createZeroContext(userId, organizationId, {
        email: "owner@example.com",
      });

      await expect(
        leaveOrganizationViaZero({
          zeroDb,
          ctx,
          input: { organizationId },
        })
      ).rejects.toThrow("único owner");

      await cleanup();
    });
  });

  describe("VAL-ORG-012: update organization", () => {
    test("manager can update organization name", async () => {
      const { db, cleanup } = await createTestDb();
      const { organizationId, userId } = await seedOrganizationWithMember(db, {
        memberRole: "admin",
      });

      const zeroDb = createZeroTestDb(db);
      const ctx = createZeroContext(userId, organizationId, {
        email: "admin@example.com",
      });

      await updateOrganizationViaZero({
        zeroDb,
        ctx,
        input: { name: "Updated Name" },
      });

      const [org] = await db
        .select({ name: organization.name })
        .from(organization)
        .where(eq(organization.id, organizationId))
        .limit(1);
      expect(org.name).toBe("Updated Name");

      await cleanup();
    });

    test("non-manager is rejected from updating organization", async () => {
      const { db, cleanup } = await createTestDb();
      const { organizationId, userId } = await seedOrganizationWithMember(db, {
        memberRole: "cashier",
      });

      const zeroDb = createZeroTestDb(db);
      const ctx = createZeroContext(userId, organizationId, {
        email: "cashier@example.com",
      });

      await expect(
        updateOrganizationViaZero({
          zeroDb,
          ctx,
          input: { name: "Hacked" },
        })
      ).rejects.toThrow("No tienes permisos");

      await cleanup();
    });
  });

  describe("VAL-ORG-013: delete organization", () => {
    test("owner can delete organization", async () => {
      const { db, cleanup } = await createTestDb();
      const { organizationId, userId } = await seedOrganizationWithMember(db, {
        memberRole: "owner",
      });

      const zeroDb = createZeroTestDb(db);
      const ctx = createZeroContext(userId, organizationId, {
        email: "owner@example.com",
      });

      const result = await deleteOrganizationViaZero({
        zeroDb,
        ctx,
        input: { organizationId },
      });
      expect(result.success).toBe(true);

      const [org] = await db
        .select()
        .from(organization)
        .where(eq(organization.id, organizationId))
        .limit(1);
      expect(org).toBeUndefined();

      await cleanup();
    });

    test("non-owner is rejected from deleting organization", async () => {
      const { db, cleanup } = await createTestDb();
      const { organizationId, userId } = await seedOrganizationWithMember(db, {
        memberRole: "admin",
      });

      const zeroDb = createZeroTestDb(db);
      const ctx = createZeroContext(userId, organizationId, {
        email: "admin@example.com",
      });

      await expect(
        deleteOrganizationViaZero({
          zeroDb,
          ctx,
          input: { organizationId },
        })
      ).rejects.toThrow("Solo el owner");

      await cleanup();
    });
  });
});
