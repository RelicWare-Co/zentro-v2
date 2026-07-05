import { and, eq } from "drizzle-orm";
import { z } from "zod";
import type { Database } from "@/database/drizzle/db";
import { pedido, pedidoItem } from "@/database/drizzle/schema/orders.schema";
import { shift } from "@/database/drizzle/schema/pos.schema";
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
