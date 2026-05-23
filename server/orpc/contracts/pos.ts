import { oc } from "@orpc/contract";
import {
  PosBootstrapResultSchema,
  SearchPosProductsInputSchema,
  SearchPosProductsResultSchema,
  ToggleProductFavoriteInputSchema,
  ToggleProductFavoriteResultSchema,
} from "@/schemas/pos";

export const posContract = {
  bootstrap: oc
    .route({
      method: "GET",
      path: "/pos/bootstrap",
      summary: "Datos iniciales del POS",
      tags: ["POS"],
    })
    .output(PosBootstrapResultSchema),
  searchProducts: oc
    .route({
      method: "GET",
      path: "/pos/products",
      summary: "Buscar productos para POS",
      tags: ["POS"],
    })
    .input(SearchPosProductsInputSchema)
    .output(SearchPosProductsResultSchema),
  toggleFavorite: oc
    .route({
      method: "POST",
      path: "/pos/products/toggle-favorite",
      summary: "Alternar favorito de producto",
      tags: ["POS"],
    })
    .input(ToggleProductFavoriteInputSchema)
    .output(ToggleProductFavoriteResultSchema),
};
