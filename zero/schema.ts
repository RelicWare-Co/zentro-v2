// Re-export of the Zero schema generated from Drizzle.
//
// The actual schema lives in `./schema.gen.ts` (see `bun run zero:schema:gen`).
// `schema.gen.ts` already adds the `declare module '@rocicorp/zero'`
// augmentation for `DefaultTypes['schema']`, so consumers can use
// `useQuery`/`useZero` without manually parameterising types.
//
// `./context.ts` adds the parallel `DefaultTypes['context']` augmentation; we
// re-export from there here so importing this module establishes both.
//
// This module is an intentional, tiny re-export point so consumers always
// import schema + context types from a single stable location even if the
// generator output filename changes. It is not a generic barrel.

// biome-ignore-start lint/performance/noBarrelFile: small, stable re-export point.
export type { ZeroContext } from "./context";
export type {
  CashMovement,
  Category,
  CreditAccount,
  CreditTransaction,
  Customer,
  InventoryMovement,
  Invitation,
  Member,
  Organization,
  OrganizationJoinLink,
  OrganizationModuleEntitlement,
  Payment,
  Pedido,
  PedidoItem,
  Product,
  ProductIngredient,
  RestaurantArea,
  RestaurantKitchenTicket,
  RestaurantKitchenTicketLine,
  RestaurantOrder,
  RestaurantOrderItem,
  RestaurantOrderItemModifier,
  RestaurantTable,
  Sale,
  SaleItem,
  SaleItemModifier,
  Shift,
  ShiftClosure,
  User,
} from "./schema.gen";
export {
  builder,
  type Schema,
  schema,
  zql,
} from "./schema.gen";
// biome-ignore-end lint/performance/noBarrelFile: small, stable re-export point.
