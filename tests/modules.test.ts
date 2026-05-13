import { describe, expect, test } from "bun:test";
import { eq } from "drizzle-orm";
import { organization } from "../database/drizzle/schema/auth.schema";
import { serializeOrganizationSettingsMetadata } from "../features/settings/settings.shared";
import { createServerORPCClient } from "../server/orpc/client/server";
import { buildMockContext } from "./helpers/orpc-context";
import { makeUser, seedOrganizationWithMember } from "./helpers/seed";
import { createTestDb } from "./helpers/test-db";

async function setRestaurantModuleEnabled(
  db: ReturnType<typeof createTestDb>["db"],
  organizationId: string,
  enabled: boolean
) {
  await db
    .update(organization)
    .set({
      metadata: serializeOrganizationSettingsMetadata({
        modules: {
          restaurants: { enabled },
        },
      } as any),
    })
    .where(eq(organization.id, organizationId));
}

describe("module access control", () => {
  describe("VAL-MOD-001: capabilities builds navigation for enabled modules", () => {
    test("capabilities includes restaurant navigation when module enabled", async () => {
      const { db, cleanup } = createTestDb();
      const { organizationId, userId } = await seedOrganizationWithMember(db, {
        memberRole: "owner",
      });
      await setRestaurantModuleEnabled(db, organizationId, true);

      const u = makeUser({ id: userId, email: "owner@example.com" });
      const ctx = buildMockContext(db, u, organizationId);
      const client = createServerORPCClient(ctx);

      const result = await client.modules.capabilities();
      expect(result.modules.restaurants.enabled).toBe(true);
      expect(result.modules.restaurants.accessible).toBe(true);
      expect(result.modules.restaurants.navigation.length).toBeGreaterThan(0);
      expect(
        result.modules.restaurants.navigation.some(
          (n) => n.id === "restaurants"
        )
      ).toBe(true);

      await cleanup();
    });
  });

  describe("VAL-MOD-002: capabilities omits navigation for disabled modules", () => {
    test("capabilities excludes restaurant navigation when module disabled", async () => {
      const { db, cleanup } = createTestDb();
      const { organizationId, userId } = await seedOrganizationWithMember(db, {
        memberRole: "owner",
      });
      // Default organization metadata has restaurants disabled

      const u = makeUser({ id: userId, email: "owner@example.com" });
      const ctx = buildMockContext(db, u, organizationId);
      const client = createServerORPCClient(ctx);

      const result = await client.modules.capabilities();
      expect(result.modules.restaurants.enabled).toBe(false);
      expect(result.modules.restaurants.accessible).toBe(false);
      expect(result.modules.restaurants.navigation.length).toBe(0);

      await cleanup();
    });
  });

  describe("VAL-MOD-003: setEntitlement requires platform admin", () => {
    test("non-platform-admin is rejected from setEntitlement", async () => {
      const { db, cleanup } = createTestDb();
      const { organizationId, userId } = await seedOrganizationWithMember(db, {
        memberRole: "owner",
        userRole: "user",
      });

      const u = makeUser({
        id: userId,
        email: "owner@example.com",
        role: "user",
      });
      const ctx = buildMockContext(db, u, organizationId);
      const client = createServerORPCClient(ctx);

      await expect(
        client.modules.setEntitlement({
          moduleKey: "restaurants",
          status: "blocked",
        })
      ).rejects.toThrow("administrador de la app");

      await cleanup();
    });

    test("platform admin can setEntitlement successfully", async () => {
      const { db, cleanup } = createTestDb();
      const { organizationId, userId } = await seedOrganizationWithMember(db, {
        memberRole: "owner",
        userRole: "admin",
      });

      const u = makeUser({
        id: userId,
        email: "admin@example.com",
        role: "admin",
      });
      const ctx = buildMockContext(db, u, organizationId);
      const client = createServerORPCClient(ctx);

      const result = await client.modules.setEntitlement({
        moduleKey: "restaurants",
        status: "blocked",
      });
      expect(result.key).toBe("restaurants");
      expect(result.entitlementStatus).toBe("blocked");

      await cleanup();
    });
  });

  describe("VAL-MOD-004: restaurant module access rejects when module disabled", () => {
    test("restaurant bootstrap rejects when restaurant module is disabled", async () => {
      const { db, cleanup } = createTestDb();
      const { organizationId, userId } = await seedOrganizationWithMember(db, {
        memberRole: "owner",
      });
      // Default metadata has restaurants disabled

      const u = makeUser({ id: userId, email: "owner@example.com" });
      const ctx = buildMockContext(db, u, organizationId);
      const client = createServerORPCClient(ctx);

      await expect(client.restaurants.bootstrap()).rejects.toThrow(
        "El módulo de restaurantes no está habilitado"
      );

      await cleanup();
    });
  });
});
