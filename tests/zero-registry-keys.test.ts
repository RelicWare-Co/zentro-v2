import { describe, expect, test } from "bun:test";
import { mutators } from "@/zero/mutators";
import { serverMutators } from "@/zero/mutators.server";
import { queries } from "@/zero/queries";
import {
  flattenZeroRegistryPaths,
  getRegistryNameMismatches,
  getServerMutatorOverridePaths,
} from "./helpers/zero-registry-keys";

const EXPECTED_QUERY_PATHS = [
  "credit.accounts",
  "credit.transactions",
  "customers.search",
  "modules.capabilities",
  "myMembership",
  "orders.inbox",
  "organization.current",
  "organization.environment",
  "organization.management",
  "organization.moduleEntitlements",
  "organization.selection",
  "productIngredients.byProduct",
  "products.byId",
  "products.categories",
  "products.ingredients",
  "products.modifiers",
  "products.movements.list",
  "products.posCatalog",
  "products.search",
  "restaurants.kitchenBoard",
  "restaurants.layout",
  "restaurants.openOrders",
  "restaurants.tableById",
  "sales.byId",
  "sales.filterOptions",
  "sales.list",
  "sales.terminalOptions",
  "shifts.active",
  "shifts.byId",
  "shifts.list",
] as const;

const EXPECTED_MUTATOR_PATHS = [
  "credit.registerPayment",
  "customers.create",
  "customers.delete",
  "customers.update",
  "modules.setEntitlement",
  "orders.accept",
  "orders.cancel",
  "orders.pay",
  "organization.cancelInvitation",
  "organization.deleteOrganization",
  "organization.inviteMember",
  "organization.joinLinkCreate",
  "organization.joinLinkRedeem",
  "organization.joinLinkRevoke",
  "organization.leaveOrganization",
  "organization.removeMember",
  "organization.updateMemberRole",
  "organization.updateOrganization",
  "organization.updateSettings",
  "productIngredients.create",
  "productIngredients.delete",
  "productIngredients.setForProduct",
  "products.create",
  "products.createCategory",
  "products.delete",
  "products.deleteCategory",
  "products.registerInventoryMovement",
  "products.toggleFavorite",
  "products.update",
  "products.updateCategory",
  "restaurants.addOrderItem",
  "restaurants.closeOrder",
  "restaurants.createArea",
  "restaurants.createTable",
  "restaurants.deleteArea",
  "restaurants.deleteDraftItem",
  "restaurants.deleteTable",
  "restaurants.sendToKitchen",
  "restaurants.updateArea",
  "restaurants.updateDraftItem",
  "restaurants.updateItemStatus",
  "restaurants.updateOrderMeta",
  "restaurants.updateTable",
  "sales.cancel",
  "sales.create",
  "shifts.cashMovement",
  "shifts.close",
  "shifts.open",
] as const;

const EXPECTED_SERVER_MUTATOR_OVERRIDE_PATHS = [
  "credit.registerPayment",
  "modules.setEntitlement",
  "orders.pay",
  "organization.cancelInvitation",
  "organization.deleteOrganization",
  "organization.inviteMember",
  "organization.joinLinkCreate",
  "organization.joinLinkRedeem",
  "organization.joinLinkRevoke",
  "organization.leaveOrganization",
  "organization.removeMember",
  "organization.updateMemberRole",
  "organization.updateOrganization",
  "organization.updateSettings",
  "productIngredients.create",
  "productIngredients.setForProduct",
  "products.registerInventoryMovement",
  "restaurants.addOrderItem",
  "restaurants.closeOrder",
  "restaurants.createArea",
  "restaurants.createTable",
  "restaurants.deleteArea",
  "restaurants.deleteDraftItem",
  "restaurants.deleteTable",
  "restaurants.sendToKitchen",
  "restaurants.updateArea",
  "restaurants.updateDraftItem",
  "restaurants.updateItemStatus",
  "restaurants.updateOrderMeta",
  "restaurants.updateTable",
  "sales.cancel",
  "sales.create",
  "shifts.close",
] as const;

describe("Zero registry dispatch paths", () => {
  test("queries registry exposes the pre-split leaf path set", () => {
    expect(flattenZeroRegistryPaths(queries)).toEqual([
      ...EXPECTED_QUERY_PATHS,
    ]);
  });

  test("mutators registry exposes the pre-split leaf path set", () => {
    expect(flattenZeroRegistryPaths(mutators)).toEqual([
      ...EXPECTED_MUTATOR_PATHS,
    ]);
  });

  test("server mutators override the expected leaf path set", () => {
    expect(getServerMutatorOverridePaths(mutators, serverMutators)).toEqual([
      ...EXPECTED_SERVER_MUTATOR_OVERRIDE_PATHS,
    ]);
  });

  test("server mutators expose the same leaf path set as client mutators", () => {
    expect(flattenZeroRegistryPaths(serverMutators)).toEqual([
      ...EXPECTED_MUTATOR_PATHS,
    ]);
  });

  test("queryName matches dotted registry path for every query", () => {
    expect(getRegistryNameMismatches(queries, "queryName")).toEqual([]);
  });

  test("mutatorName matches dotted registry path for every client mutator", () => {
    expect(getRegistryNameMismatches(mutators, "mutatorName")).toEqual([]);
  });

  test("mutatorName matches dotted registry path for every server mutator", () => {
    expect(getRegistryNameMismatches(serverMutators, "mutatorName")).toEqual(
      []
    );
  });
});
