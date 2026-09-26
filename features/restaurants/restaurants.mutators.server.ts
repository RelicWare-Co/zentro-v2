import type { RestaurantDbExecutor } from "@/features/restaurants/restaurant-mutations.server";
import {
  runAddRestaurantOrderItem,
  runCancelRestaurantOrder,
  runCloseRestaurantOrder,
  runCreateRestaurantArea,
  runCreateRestaurantTable,
  runDeleteRestaurantArea,
  runDeleteRestaurantOrderItem,
  runDeleteRestaurantTable,
  runDiscardPendingKitchenChanges,
  runEnsureDefaultRestaurantAreas,
  runSendRestaurantOrderToKitchen,
  runUpdateRestaurantArea,
  runUpdateRestaurantOrderItem,
  runUpdateRestaurantOrderItemStatus,
  runUpdateRestaurantOrderMeta,
  runUpdateRestaurantTable,
} from "@/features/restaurants/restaurant-mutations.server";
import {
  runAcknowledgeKitchenTicketPrint,
  runClaimKitchenTicketPrint,
  runFailKitchenTicketPrint,
  runMarkKitchenTicketPrinted,
  runRequeueKitchenTicketPrint,
} from "@/features/restaurants/restaurant-print-operations.server";
import {
  acknowledgeKitchenTicketPrintArgsSchema,
  addRestaurantOrderItemArgsSchema,
  cancelRestaurantOrderArgsSchema,
  claimKitchenTicketPrintArgsSchema,
  closeRestaurantOrderArgsSchema,
  createRestaurantAreaArgsSchema,
  createRestaurantTableArgsSchema,
  deleteRestaurantAreaArgsSchema,
  deleteRestaurantOrderItemArgsSchema,
  deleteRestaurantTableArgsSchema,
  discardPendingKitchenChangesArgsSchema,
  ensureDefaultRestaurantAreasArgsSchema,
  failKitchenTicketPrintArgsSchema,
  markKitchenTicketPrintedArgsSchema,
  requeueKitchenTicketPrintArgsSchema,
  sendRestaurantOrderToKitchenArgsSchema,
  updateRestaurantAreaArgsSchema,
  updateRestaurantOrderItemArgsSchema,
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
  updateOrderItem: defineZentroServerMutator(
    updateRestaurantOrderItemArgsSchema,
    restaurantRunner(runUpdateRestaurantOrderItem),
    { operationName: RESTAURANT_OP_NAME }
  ),
  deleteOrderItem: defineZentroServerMutator(
    deleteRestaurantOrderItemArgsSchema,
    restaurantRunner(runDeleteRestaurantOrderItem),
    { operationName: RESTAURANT_OP_NAME }
  ),
  discardPendingKitchenChanges: defineZentroServerMutator(
    discardPendingKitchenChangesArgsSchema,
    restaurantRunner(runDiscardPendingKitchenChanges),
    { operationName: RESTAURANT_OP_NAME }
  ),
  sendToKitchen: defineZentroServerMutator(
    sendRestaurantOrderToKitchenArgsSchema,
    restaurantRunner(runSendRestaurantOrderToKitchen),
    { operationName: RESTAURANT_OP_NAME }
  ),
  claimKitchenTicketPrint: defineZentroServerMutator(
    claimKitchenTicketPrintArgsSchema,
    restaurantRunner(runClaimKitchenTicketPrint),
    { operationName: RESTAURANT_OP_NAME }
  ),
  markKitchenTicketPrinted: defineZentroServerMutator(
    markKitchenTicketPrintedArgsSchema,
    restaurantRunner(runMarkKitchenTicketPrinted),
    { operationName: RESTAURANT_OP_NAME }
  ),
  failKitchenTicketPrint: defineZentroServerMutator(
    failKitchenTicketPrintArgsSchema,
    restaurantRunner(runFailKitchenTicketPrint),
    { operationName: RESTAURANT_OP_NAME }
  ),
  requeueKitchenTicketPrint: defineZentroServerMutator(
    requeueKitchenTicketPrintArgsSchema,
    restaurantRunner(runRequeueKitchenTicketPrint),
    { operationName: RESTAURANT_OP_NAME }
  ),
  acknowledgeKitchenTicketPrint: defineZentroServerMutator(
    acknowledgeKitchenTicketPrintArgsSchema,
    restaurantRunner(runAcknowledgeKitchenTicketPrint),
    { operationName: RESTAURANT_OP_NAME }
  ),
  cancelOrder: defineZentroServerMutator(
    cancelRestaurantOrderArgsSchema,
    restaurantRunner(runCancelRestaurantOrder),
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
  ensureDefaultAreas: defineZentroServerMutator(
    ensureDefaultRestaurantAreasArgsSchema,
    async ({ drizzleTx, auth }) => {
      await runEnsureDefaultRestaurantAreas(drizzleTx as RestaurantDbExecutor, {
        organizationId: auth.organizationId,
        userId: auth.userId,
      });
    },
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
