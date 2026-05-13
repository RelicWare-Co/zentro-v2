import { oc } from "@orpc/contract";
import {
  CancelSaleInputSchema,
  CancelSaleResultSchema,
  CreateSaleInputSchema,
  CreateSaleResultSchema,
  GetSaleByIdInputSchema,
  ListSalesInputSchema,
  SaleDetailSchema,
  SaleListResultSchema,
} from "../../../schemas/sales";

export const salesContract = {
  list: oc
    .route({
      method: "POST",
      path: "/sales/list",
      summary: "Listar ventas",
      tags: ["Sales"],
    })
    .input(ListSalesInputSchema)
    .output(SaleListResultSchema),
  detail: oc
    .route({
      method: "POST",
      path: "/sales/detail",
      summary: "Detalle de venta",
      tags: ["Sales"],
    })
    .input(GetSaleByIdInputSchema)
    .output(SaleDetailSchema.nullable()),
  create: oc
    .route({
      method: "POST",
      path: "/sales/create",
      summary: "Crear venta",
      tags: ["Sales"],
    })
    .input(CreateSaleInputSchema)
    .output(CreateSaleResultSchema),
  cancel: oc
    .route({
      method: "POST",
      path: "/sales/cancel",
      summary: "Anular venta",
      tags: ["Sales"],
    })
    .input(CancelSaleInputSchema)
    .output(CancelSaleResultSchema),
};
