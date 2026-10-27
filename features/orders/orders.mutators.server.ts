import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import type { Database } from "@/database/drizzle/db";
import { pedido, pedidoItem } from "@/database/drizzle/schema/orders.schema";
import { shift } from "@/database/drizzle/schema/pos.schema";
import { getPedidoChargeBlocker } from "@/features/orders/orders.shared";
import type { CreateSaleDbExecutor } from "@/features/sales/create-sale.server";
import { runCreateSale } from "@/features/sales/create-sale.server";
import { defineZentroServerMutator } from "@/zero/sdk.server";

const payPedidoArgsSchema = z.object({
  pedidoId: z.string().trim().min(1),
  paymentMethod: z.string().trim().min(1),
  reference: z.string().trim().optional().nullable(),
});

async function findOpenShiftForUser(
  tx: Pick<Database, "select">,
  organizationId: string,
  userId: string
): Promise<{ id: string } | null> {
  const [openShift] = await tx
    .select({ id: shift.id })
    .from(shift)
    .where(
      and(
        eq(shift.organizationId, organizationId),
        eq(shift.userId, userId),
        eq(shift.status, "open")
      )
    )
    .limit(1);
  return openShift ?? null;
}

export const ordersServerMutators = {
  pay: defineZentroServerMutator(
    payPedidoArgsSchema,
    async ({ drizzleTx, args, auth }) => {
      const tx = drizzleTx as unknown as CreateSaleDbExecutor;

      const [existingPedido] = await tx
        .select()
        .from(pedido)
        .where(
          and(
            eq(pedido.id, args.pedidoId),
            eq(pedido.organizationId, auth.organizationId)
          )
        )
        .limit(1);

      if (!existingPedido) {
        throw new Error("Pedido no encontrado");
      }
      if (existingPedido.status !== "accepted") {
        throw new Error("Solo se pueden cobrar pedidos aceptados");
      }
      if (existingPedido.saleId) {
        throw new Error("Este pedido ya fue cobrado");
      }

      const openShift = await findOpenShiftForUser(
        tx,
        auth.organizationId,
        auth.userId
      );
      if (!openShift) {
        throw new Error(
          "No tienes un turno abierto. Abre un turno antes de cobrar."
        );
      }

      const items = await (drizzleTx as Database)
        .select()
        .from(pedidoItem)
        .where(eq(pedidoItem.orderId, args.pedidoId));

      // `delivery_fee` and `pedido_item.modifiers` are shared columns owned by
      // the new app. They are not in v2's Drizzle schema, so read them with a
      // raw projection instead of widening this schema/Zero contract.
      const [chargeMeta] = await tx
        .select({
          deliveryFee: sql<number>`"pedido"."delivery_fee"`,
          modifiersCount: sql<number>`(
            select count(*)::int
            from "pedido_item"
            where "pedido_item"."order_id" = "pedido"."id"
              and jsonb_array_length("pedido_item"."modifiers") > 0
          )`,
        })
        .from(pedido)
        .where(eq(pedido.id, args.pedidoId))
        .limit(1);

      const chargeBlocker = getPedidoChargeBlocker({
        deliveryFee: Number(chargeMeta?.deliveryFee ?? 0),
        modifiersCount: Number(chargeMeta?.modifiersCount ?? 0),
      });
      if (chargeBlocker === "delivery") {
        throw new Error(
          "Este pedido tiene un costo de domicilio. Cóbralo desde la app nueva o ajusta la venta manualmente."
        );
      }
      if (chargeBlocker === "modifiers") {
        throw new Error(
          "Este pedido tiene adiciones. Cóbralo desde la app nueva o ajusta la venta manualmente."
        );
      }

      const saleItems = items.map((item) => ({
        productId: item.productId,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        taxRate: item.taxRate,
      }));

      const saleId = crypto.randomUUID();
      await runCreateSale(
        tx,
        {
          saleId,
          shiftId: openShift.id,
          customerId: existingPedido.customerId,
          items: saleItems,
          payments: [
            {
              method: args.paymentMethod,
              amount: existingPedido.totalAmount,
              reference: args.reference,
            },
          ],
          createdAt: Date.now(),
        },
        {
          organizationId: auth.organizationId,
          userId: auth.userId,
        }
      );

      await (drizzleTx as Database)
        .update(pedido)
        .set({
          saleId,
          status: "delivered",
          closedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(pedido.id, args.pedidoId));
    },
    { operationName: "El cobro de pedidos" }
  ),
};
