import type { RestaurantDbExecutor } from "@/features/restaurants/restaurant-mutations.server";
import {
  runAddRestaurantOrderItem,
  runCloseRestaurantOrder,
  runCreateRestaurantArea,
  runCreateRestaurantTable,
  runDeleteRestaurantArea,
  runDeleteRestaurantDraftItem,
  runDeleteRestaurantTable,
  runSendRestaurantOrderToKitchen,
  runUpdateRestaurantArea,
  runUpdateRestaurantDraftItem,
  runUpdateRestaurantOrderItemStatus,
  runUpdateRestaurantOrderMeta,
  runUpdateRestaurantTable,
} from "@/features/restaurants/restaurant-mutations.server";
import {
  addRestaurantOrderItemArgsSchema,
  closeRestaurantOrderArgsSchema,
  createRestaurantAreaArgsSchema,
  createRestaurantTableArgsSchema,
  deleteRestaurantAreaArgsSchema,
  deleteRestaurantDraftItemArgsSchema,
  deleteRestaurantTableArgsSchema,
  sendRestaurantOrderToKitchenArgsSchema,
  updateRestaurantAreaArgsSchema,
  updateRestaurantDraftItemArgsSchema,
  updateRestaurantOrderItemStatusArgsSchema,
  updateRestaurantOrderMetaArgsSchema,
  updateRestaurantTableArgsSchema,
} from "@/features/restaurants/restaurants.mutators";
import {
  type DrizzleTransaction,
  defineZentroServerMutator,
  type ZentroServerMutatorAuth,
} from "@/zero/sdk.server";

const RESTAURANT_OP_NAME = "Las mutaciones de restaurantes";

function restaurantRunner<Args>(
  fn: (
    tx: RestaurantDbExecutor,
    args: Args,
    ctx: { organizationId: string; userId: string }
  ) => Promise<unknown>
) {
  return async ({
    drizzleTx,
    args,
    auth,
  }: {
    drizzleTx: DrizzleTransaction;
    args: Args;
    auth: ZentroServerMutatorAuth;
  }) => {
    await fn(drizzleTx as RestaurantDbExecutor, args, {
      organizationId: auth.organizationId,
      userId: auth.userId,
    });
  };
}

export const restaurantsServerMutators = {
  addOrderItem: defineZentroServerMutator(
    addRestaurantOrderItemArgsSchema,
    restaurantRunner(runAddRestaurantOrderItem),
    { operationName: RESTAURANT_OP_NAME }
  ),
  updateOrderMeta: defineZentroServerMutator(
    updateRestaurantOrderMetaArgsSchema,
    restaurantRunner(runUpdateRestaurantOrderMeta),
    { operationName: RESTAURANT_OP_NAME }
  ),
  updateDraftItem: defineZentroServerMutator(
    updateRestaurantDraftItemArgsSchema,
    restaurantRunner(runUpdateRestaurantDraftItem),
    { operationName: RESTAURANT_OP_NAME }
  ),
  deleteDraftItem: defineZentroServerMutator(
    deleteRestaurantDraftItemArgsSchema,
    restaurantRunner(runDeleteRestaurantDraftItem),
    { operationName: RESTAURANT_OP_NAME }
  ),
  sendToKitchen: defineZentroServerMutator(
    sendRestaurantOrderToKitchenArgsSchema,
    restaurantRunner(runSendRestaurantOrderToKitchen),
    { operationName: RESTAURANT_OP_NAME }
  ),
  updateItemStatus: defineZentroServerMutator(
    updateRestaurantOrderItemStatusArgsSchema,
    restaurantRunner(runUpdateRestaurantOrderItemStatus),
    { operationName: RESTAURANT_OP_NAME }
  ),
  closeOrder: defineZentroServerMutator(
    closeRestaurantOrderArgsSchema,
    restaurantRunner(runCloseRestaurantOrder),
    { operationName: RESTAURANT_OP_NAME }
  ),
  createArea: defineZentroServerMutator(
    createRestaurantAreaArgsSchema,
    restaurantRunner(runCreateRestaurantArea),
    { operationName: RESTAURANT_OP_NAME }
  ),
  updateArea: defineZentroServerMutator(
    updateRestaurantAreaArgsSchema,
    restaurantRunner(runUpdateRestaurantArea),
    { operationName: RESTAURANT_OP_NAME }
  ),
  deleteArea: defineZentroServerMutator(
    deleteRestaurantAreaArgsSchema,
    restaurantRunner(runDeleteRestaurantArea),
    { operationName: RESTAURANT_OP_NAME }
  ),
  createTable: defineZentroServerMutator(
    createRestaurantTableArgsSchema,
    restaurantRunner(runCreateRestaurantTable),
    { operationName: RESTAURANT_OP_NAME }
  ),
  updateTable: defineZentroServerMutator(
    updateRestaurantTableArgsSchema,
    restaurantRunner(runUpdateRestaurantTable),
    { operationName: RESTAURANT_OP_NAME }
  ),
  deleteTable: defineZentroServerMutator(
    deleteRestaurantTableArgsSchema,
    restaurantRunner(runDeleteRestaurantTable),
    { operationName: RESTAURANT_OP_NAME }
  ),
};
