import { describe, expect, test } from "bun:test";
import { eq } from "drizzle-orm";
import { organization } from "@/database/drizzle/schema/auth.schema";
import { serializeOrganizationSettingsMetadata } from "@/features/settings/settings.shared";
import { seedOrganizationWithMember } from "./helpers/seed";
import { createTestDb, type TestDb } from "./helpers/test-db";
import {
  getModuleCapabilitiesViaZero,
  setModuleEntitlementViaZero,
} from "./helpers/zero-modules";
import { getRestaurantBootstrapViaZero } from "./helpers/zero-restaurants";
import { createZeroContext, createZeroTestDb } from "./helpers/zero-shifts";

async function setRestaurantModuleEnabled(
  db: TestDb,
  organizationId: string,
  enabled: boolean,
  options: { kitchenDisplayEnabled?: boolean } = {}
) {
  await db
    .update(organization)
    .set({
      metadata: serializeOrganizationSettingsMetadata({
        modules: {
          restaurants: { enabled },
        },
        restaurants: {
          kitchen: {
            displayEnabled: options.kitchenDisplayEnabled ?? false,
          },
        },
      } as any),
    })
    .where(eq(organization.id, organizationId));
}

describe("module access control", () => {
  describe("VAL-MOD-001: capabilities builds navigation for enabled modules", () => {
    test("capabilities includes restaurant navigation when module enabled", async () => {
      const { db, cleanup } = await createTestDb();
      const { organizationId, userId } = await seedOrganizationWithMember(db, {
        memberRole: "owner",
      });
      await setRestaurantModuleEnabled(db, organizationId, true, {
        kitchenDisplayEnabled: true,
      });

      const zeroDb = createZeroTestDb(db);
      const ctx = createZeroContext(userId, organizationId);
      const result = await getModuleCapabilitiesViaZero({ zeroDb, ctx });
      expect(result.modules.restaurants.enabled).toBe(true);
      expect(result.modules.restaurants.accessible).toBe(true);
      expect(result.modules.restaurants.navigation.length).toBeGreaterThan(0);
      expect(
        result.modules.restaurants.navigation.some(
          (n) => n.id === "restaurants-kitchen"
        )
      ).toBe(true);

      await cleanup();
    });
  });

  describe("VAL-MOD-002: capabilities omits navigation for disabled modules", () => {
    test("capabilities excludes restaurant navigation when module disabled", async () => {
      const { db, cleanup } = await createTestDb();
      const { organizationId, userId } = await seedOrganizationWithMember(db, {
        memberRole: "owner",
      });

      const zeroDb = createZeroTestDb(db);
      const ctx = createZeroContext(userId, organizationId);
      const result = await getModuleCapabilitiesViaZero({ zeroDb, ctx });
      expect(result.modules.restaurants.enabled).toBe(false);
      expect(result.modules.restaurants.accessible).toBe(false);
      expect(result.modules.restaurants.navigation.length).toBe(0);

      await cleanup();
    });
  });

  describe("VAL-MOD-003: setEntitlement requires platform admin", () => {
    test("non-platform-admin is rejected from setEntitlement", async () => {
      const { db, cleanup } = await createTestDb();
      const { organizationId, userId } = await seedOrganizationWithMember(db, {
        memberRole: "owner",
        userRole: "user",
      });

      const zeroDb = createZeroTestDb(db);
      const ctx = createZeroContext(userId, organizationId, {
        role: "owner",
        systemRole: null,
      });

      await expect(
        setModuleEntitlementViaZero({
          zeroDb,
          ctx,
          input: {
            moduleKey: "restaurants",
            status: "blocked",
          },
        })
      ).rejects.toThrow("administrador de la app");

      await cleanup();
    });

    test("platform admin can setEntitlement successfully", async () => {
      const { db, cleanup } = await createTestDb();
      const { organizationId, userId } = await seedOrganizationWithMember(db, {
        memberRole: "owner",
        userRole: "admin",
      });

      const zeroDb = createZeroTestDb(db);
      const ctx = createZeroContext(userId, organizationId, {
        role: "owner",
        systemRole: "admin",
      });

      const result = await setModuleEntitlementViaZero({
        zeroDb,
        ctx,
        input: {
          moduleKey: "restaurants",
          status: "blocked",
        },
      });
      expect(result.key).toBe("restaurants");
      expect(result.entitlementStatus).toBe("blocked");

      await cleanup();
    });
  });

  describe("VAL-MOD-004: restaurant module access rejects when module disabled", () => {
    test("restaurant bootstrap rejects when restaurant module is disabled", async () => {
      const { db, cleanup } = await createTestDb();
      const { organizationId, userId } = await seedOrganizationWithMember(db, {
        memberRole: "owner",
      });

      const zeroDb = createZeroTestDb(db);
      const zeroCtx = createZeroContext(userId, organizationId);

      await expect(
        getRestaurantBootstrapViaZero({ zeroDb, ctx: zeroCtx })
      ).rejects.toThrow("El módulo de restaurantes no está habilitado");

      await cleanup();
    });
  });
});
