import { useQuery as useZeroQuery } from "@rocicorp/zero/react";
import { useDeferredValue, useMemo, useRef } from "react";
import type { z } from "zod";
import {
  getZeroQueryError,
  useZeroMutation,
  waitForZeroMutation,
} from "@/lib/use-zero-mutation";
import type {
  CategorySchema,
  CreateCategorySchema,
  CreateProductSchema,
  DeleteCategorySchema,
  DeleteProductSchema,
  ProductSchema,
  RegisterInventoryMovementSchema,
  UpdateCategorySchema,
  UpdateProductSchema,
} from "@/schemas/products";
import { mutators } from "@/src/zero/mutators";
import { queries } from "@/src/zero/queries";
import type {
  Category as ZeroCategory,
  Product as ZeroProduct,
} from "@/src/zero/schema";

type ZeroProductWithCategory = ZeroProduct & {
  readonly category?: ZeroCategory | null;
};

export type Product = z.infer<typeof ProductSchema>;
export type Category = z.infer<typeof CategorySchema>;
type CreateProductInput = z.infer<typeof CreateProductSchema>;
type UpdateProductInput = z.infer<typeof UpdateProductSchema>;
type DeleteProductInput = z.infer<typeof DeleteProductSchema>;
type RegisterInventoryMovementInput = z.infer<
  typeof RegisterInventoryMovementSchema
>;
type CreateCategoryInput = z.infer<typeof CreateCategorySchema>;
type UpdateCategoryInput = z.infer<typeof UpdateCategorySchema>;
type DeleteCategoryInput = z.infer<typeof DeleteCategorySchema>;

function normalizeProduct(product: ZeroProductWithCategory): Product {
  return {
    id: product.id,
    name: product.name,
    categoryId: product.categoryId ?? null,
    categoryName: product.category?.name ?? null,
    sku: product.sku ?? null,
    barcode: product.barcode ?? null,
    price: product.price,
    cost: product.cost ?? 0,
    taxRate: product.taxRate ?? 0,
    stock: product.stock ?? 0,
    trackInventory: product.trackInventory ?? true,
    isModifier: product.isModifier ?? false,
    isFavorite: product.isFavorite ?? false,
    createdAt: product.createdAt,
  };
}

function normalizeCategory(category: ZeroCategory): Category {
  return {
    id: category.id,
    name: category.name,
    description: category.description ?? null,
  };
}

export function useProductsQueries(options: {
  page: number;
  pageSize: number;
  query: string;
  categoryId: string | null;
}) {
  const deferredSearchQuery = useDeferredValue(options.query);
  const [productRows, productsStatus] = useZeroQuery(
    queries.products.search({
      categoryId: options.categoryId,
      limit: 1000,
      searchQuery: deferredSearchQuery.trim() || null,
    })
  );
  const [categoryRows, categoriesStatus] = useZeroQuery(
    queries.products.categories()
  );

  const productsError = getZeroQueryError(productsStatus);
  const categoriesError = getZeroQueryError(categoriesStatus);
  const products = useMemo(
    () => productRows.map((product) => normalizeProduct(product)),
    [productRows]
  );
  const categories = useMemo(
    () => categoryRows.map(normalizeCategory),
    [categoryRows]
  );
  const pagedProducts = useMemo(() => {
    const start = options.page * options.pageSize;
    return products.slice(start, start + options.pageSize);
  }, [options.page, options.pageSize, products]);

  const hasLoadedRef = useRef(false);
  const staleDataRef = useRef({
    categories: [] as Category[],
    products: [] as Product[],
    total: 0,
  });
  const isLoading =
    (productsStatus.type === "unknown" && products.length === 0) ||
    (categoriesStatus.type === "unknown" && categories.length === 0);

  const currentData = {
    categories,
    products: pagedProducts,
    total: products.length,
  };

  if (!isLoading) {
    staleDataRef.current = currentData;
    hasLoadedRef.current = true;
  }

  const displayData = isLoading ? staleDataRef.current : currentData;

  return {
    products: displayData.products,
    total: displayData.total,
    categories: displayData.categories,
    isPending: isLoading && !hasLoadedRef.current,
    isError: Boolean(productsError ?? categoriesError),
    error: productsError ?? categoriesError,
  };
}

export function useProductsMutations(options?: {
  onCreateProductSuccess?: () => void;
  onUpdateProductSuccess?: () => void;
  onDeleteProductSuccess?: () => void;
  onCreateCategorySuccess?: () => void;
  onUpdateCategorySuccess?: () => void;
  onDeleteCategorySuccess?: () => void;
  onRegisterInventoryMovementSuccess?: () => void;
}) {
  const createProductMutation = useZeroMutation(
    async (input: CreateProductInput, zero) => {
      const id = crypto.randomUUID();
      await waitForZeroMutation(
        zero.mutate(
          mutators.products.create({
            ...input,
            id,
          })
        )
      );
      return { id };
    },
    { onSuccess: () => options?.onCreateProductSuccess?.() }
  );
  const updateProductMutation = useZeroMutation(
    async (input: UpdateProductInput, zero) => {
      await waitForZeroMutation(zero.mutate(mutators.products.update(input)));
      return { success: true };
    },
    { onSuccess: () => options?.onUpdateProductSuccess?.() }
  );
  const deleteProductMutation = useZeroMutation(
    async (input: DeleteProductInput, zero) => {
      await waitForZeroMutation(zero.mutate(mutators.products.delete(input)));
      return { success: true };
    },
    { onSuccess: () => options?.onDeleteProductSuccess?.() }
  );
  const registerInventoryMovementMutation = useZeroMutation(
    async (input: RegisterInventoryMovementInput, zero) => {
      const id = crypto.randomUUID();
      await waitForZeroMutation(
        zero.mutate(
          mutators.products.registerInventoryMovement({
            ...input,
            id,
          })
        )
      );
      return { id, productId: input.productId, quantity: input.quantity };
    },
    { onSuccess: () => options?.onRegisterInventoryMovementSuccess?.() }
  );
  const createCategoryMutation = useZeroMutation(
    async (input: CreateCategoryInput, zero) => {
      const id = crypto.randomUUID();
      await waitForZeroMutation(
        zero.mutate(
          mutators.products.createCategory({
            ...input,
            id,
          })
        )
      );
      return { id };
    },
    { onSuccess: () => options?.onCreateCategorySuccess?.() }
  );
  const updateCategoryMutation = useZeroMutation(
    async (input: UpdateCategoryInput, zero) => {
      await waitForZeroMutation(
        zero.mutate(mutators.products.updateCategory(input))
      );
      return { success: true };
    },
    { onSuccess: () => options?.onUpdateCategorySuccess?.() }
  );
  const deleteCategoryMutation = useZeroMutation(
    async (input: DeleteCategoryInput, zero) => {
      await waitForZeroMutation(
        zero.mutate(mutators.products.deleteCategory(input))
      );
      return { success: true };
    },
    { onSuccess: () => options?.onDeleteCategorySuccess?.() }
  );

  return {
    createProductMutation,
    updateProductMutation,
    deleteProductMutation,
    registerInventoryMovementMutation,
    createCategoryMutation,
    updateCategoryMutation,
    deleteCategoryMutation,
  };
}
