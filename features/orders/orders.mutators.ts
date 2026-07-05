import { z } from "zod";
import { zql } from "@/zero/schema";
import { assertOrgZeroContext, defineZentroMutator } from "@/zero/sdk";

const acceptPedidoArgsSchema = z.object({
  pedidoId: z.string().trim().min(1),
});

const cancelPedidoArgsSchema = z.object({
  pedidoId: z.string().trim().min(1),
});

const payPedidoArgsSchema = z.object({
  pedidoId: z.string().trim().min(1),
  paymentMethod: z.string().trim().min(1),
  reference: z.string().trim().optional().nullable(),
});

export const ordersMutators = {
  orders: {
    accept: defineZentroMutator(
      acceptPedidoArgsSchema,
      async ({ args, ctx, tx }) => {
        const zeroContext = assertOrgZeroContext(ctx);

        const existing = await tx.run(
          zql.pedido
            .where("id", args.pedidoId)
            .where("organizationId", zeroContext.orgID)
            .limit(1)
        );

        const pedido = existing[0];
        if (!pedido) {
          throw new Error("Pedido no encontrado");
        }
        if (pedido.status !== "pending") {
          throw new Error("Solo se pueden aceptar pedidos pendientes");
        }

        await tx.mutate.pedido.update({
          id: args.pedidoId,
          status: "accepted",
          acceptedByUserId: zeroContext.id,
          updatedAt: Date.now(),
        });
      }
    ),
    cancel: defineZentroMutator(
      cancelPedidoArgsSchema,
      async ({ args, ctx, tx }) => {
        const zeroContext = assertOrgZeroContext(ctx);

        const existing = await tx.run(
          zql.pedido
            .where("id", args.pedidoId)
            .where("organizationId", zeroContext.orgID)
            .limit(1)
        );

        const pedido = existing[0];
        if (!pedido) {
          throw new Error("Pedido no encontrado");
        }
        if (pedido.status === "delivered" || pedido.status === "cancelled") {
          throw new Error(
            "No se puede cancelar un pedido ya entregado o cancelado"
          );
        }

        await tx.mutate.pedido.update({
          id: args.pedidoId,
          status: "cancelled",
          updatedAt: Date.now(),
        });
      }
    ),
    pay: defineZentroMutator(payPedidoArgsSchema, async () => {
      // Server-only transaction; client completes without optimistic writes.
    }),
  },
};
