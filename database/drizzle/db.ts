import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import {
  account,
  accountRelations,
  invitation,
  invitationRelations,
  member,
  memberRelations,
  organization,
  organizationJoinLink,
  organizationJoinLinkRelations,
  organizationRelations,
  session,
  sessionRelations,
  user,
  userRelations,
  verification,
} from "./schema/auth.schema";
import {
  creditAccount,
  creditAccountRelations,
  creditTransaction,
  creditTransactionRelations,
} from "./schema/credit.schema";
import { customer, customerRelations } from "./schema/customer.schema";
import { organizationModuleEntitlement } from "./schema/feature.schema";
import {
  category,
  categoryRelations,
  inventoryMovement,
  inventoryMovementRelations,
  product,
  productRelations,
} from "./schema/inventory.schema";
import {
  cashMovement,
  cashMovementRelations,
  shift,
  shiftClosure,
  shiftClosureRelations,
  shiftRelations,
} from "./schema/pos.schema";
import {
  restaurantArea,
  restaurantAreaRelations,
  restaurantKitchenTicket,
  restaurantKitchenTicketRelations,
  restaurantOrder,
  restaurantOrderItem,
  restaurantOrderItemModifier,
  restaurantOrderItemModifierRelations,
  restaurantOrderItemRelations,
  restaurantOrderRelations,
  restaurantTable,
  restaurantTableRelations,
} from "./schema/restaurant.schema";
import {
  payment,
  paymentRelations,
  sale,
  saleItem,
  saleItemModifier,
  saleItemModifierRelations,
  saleItemRelations,
  saleRelations,
} from "./schema/sales.schema";

const schema = {
  account,
  accountRelations,
  cashMovement,
  cashMovementRelations,
  category,
  categoryRelations,
  creditAccount,
  creditAccountRelations,
  creditTransaction,
  creditTransactionRelations,
  customer,
  customerRelations,
  inventoryMovement,
  inventoryMovementRelations,
  invitation,
  invitationRelations,
  member,
  memberRelations,
  organization,
  organizationJoinLink,
  organizationJoinLinkRelations,
  organizationModuleEntitlement,
  organizationRelations,
  payment,
  paymentRelations,
  product,
  productRelations,
  restaurantArea,
  restaurantAreaRelations,
  restaurantKitchenTicket,
  restaurantKitchenTicketRelations,
  restaurantOrder,
  restaurantOrderItem,
  restaurantOrderItemModifier,
  restaurantOrderItemModifierRelations,
  restaurantOrderItemRelations,
  restaurantOrderRelations,
  restaurantTable,
  restaurantTableRelations,
  sale,
  saleItem,
  saleItemModifier,
  saleItemModifierRelations,
  saleItemRelations,
  saleRelations,
  session,
  sessionRelations,
  shift,
  shiftClosure,
  shiftClosureRelations,
  shiftRelations,
  user,
  userRelations,
  verification,
};

function createDb() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL environment variable is not set");
  }

  const client = postgres(databaseUrl);

  return drizzle(client, { schema });
}

export type Database = ReturnType<typeof createDb>;

let dbInstance: Database | undefined;

function getDb(): Database {
  if (dbInstance) {
    return dbInstance;
  }

  dbInstance = createDb();
  return dbInstance;
}

// Compatibilidad con código existente de zentro-v2 que espera dbSqlite()
export function dbSqlite() {
  return getDb();
}

// Proxy para lazy initialization
const _db = new Proxy({} as Database, {
  get(_target, property, receiver) {
    const target = getDb();
    const value = Reflect.get(target, property, receiver);
    return typeof value === "function" ? value.bind(target) : value;
  },
});

export { _db as db };
