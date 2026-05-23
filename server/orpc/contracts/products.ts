import { oc } from "@orpc/contract";
import {
  CategorySchema,
  CreateCategorySchema,
  CreateProductSchema,
  DeleteCategorySchema,
  DeleteProductSchema,
  IdResultSchema,
  InventoryMovementResultSchema,
  ListProductsInputSchema,
  ListProductsResultSchema,
  RegisterInventoryMovementSchema,
  SuccessResultSchema,
  UpdateCategorySchema,
  UpdateProductSchema,
} from "@/schemas/products";

export const productsContract = {
  list: oc
    .route({
      method: "GET",
      path: "/products",
      summary: "Listar productos",
      tags: ["Products"],
    })
    .input(ListProductsInputSchema)
    .output(ListProductsResultSchema),
  categories: oc
    .route({
      method: "GET",
      path: "/products/categories",
      summary: "Listar categorías de productos",
      tags: ["Products"],
    })
    .output(CategorySchema.array()),
  create: oc
    .route({
      method: "POST",
      path: "/products",
      summary: "Crear producto",
      tags: ["Products"],
    })
    .input(CreateProductSchema)
    .output(IdResultSchema),
  update: oc
    .route({
      method: "POST",
      path: "/products/update",
      summary: "Actualizar producto",
      tags: ["Products"],
    })
    .input(UpdateProductSchema)
    .output(SuccessResultSchema),
  delete: oc
    .route({
      method: "POST",
      path: "/products/delete",
      summary: "Eliminar producto",
      tags: ["Products"],
    })
    .input(DeleteProductSchema)
    .output(SuccessResultSchema),
  registerInventoryMovement: oc
    .route({
      method: "POST",
      path: "/products/inventory-movement",
      summary: "Registrar movimiento de inventario",
      tags: ["Products"],
    })
    .input(RegisterInventoryMovementSchema)
    .output(InventoryMovementResultSchema),
  createCategory: oc
    .route({
      method: "POST",
      path: "/products/categories",
      summary: "Crear categoría",
      tags: ["Products"],
    })
    .input(CreateCategorySchema)
    .output(IdResultSchema),
  updateCategory: oc
    .route({
      method: "POST",
      path: "/products/categories/update",
      summary: "Actualizar categoría",
      tags: ["Products"],
    })
    .input(UpdateCategorySchema)
    .output(SuccessResultSchema),
  deleteCategory: oc
    .route({
      method: "POST",
      path: "/products/categories/delete",
      summary: "Eliminar categoría",
      tags: ["Products"],
    })
    .input(DeleteCategorySchema)
    .output(SuccessResultSchema),
};
