import { useZero, useQuery as useZeroQuery } from "@rocicorp/zero/react";
import { useMutation } from "@tanstack/react-query";
import { useDeferredValue, useMemo, useRef } from "react";
import type { z } from "zod";
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

type ZeroMutationDetails =
  | { readonly type: "success" }
  | {
      readonly error: { readonly message: string };
      readonly type: "error";
    };

interface ZeroMutationResult {
  readonly client: Promise<ZeroMutationDetails>;
  readonly server: Promise<ZeroMutationDetails>;
}

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

function toError(details: Extract<ZeroMutationDetails, { type: "error" }>) {
  return new Error(details.error.message || "La mutación de Zero falló");
}

async function waitForZeroMutation(result: ZeroMutationResult) {
  const clientResult = await result.client;
  if (clientResult.type === "error") {
    throw toError(clientResult);
  }

  const serverResult = await result.server;
  if (serverResult.type === "error") {
    throw toError(serverResult);
  }
}

function getQueryError(status: { type: string; error?: { message?: string } }) {
  return status.type === "error"
    ? new Error(status.error?.message ?? "No se pudo cargar la consulta Zero")
    : null;
}

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

  const productsError = getQueryError(productsStatus);
  const categoriesError = getQueryError(categoriesStatus);
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
  const zero = useZero();

  const createProductMutation = useMutation({
    mutationFn: async (input: CreateProductInput) => {
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
    onSuccess: () => options?.onCreateProductSuccess?.(),
  });
  const updateProductMutation = useMutation({
    mutationFn: async (input: UpdateProductInput) => {
      await waitForZeroMutation(zero.mutate(mutators.products.update(input)));
      return { success: true };
    },
    onSuccess: () => options?.onUpdateProductSuccess?.(),
  });
  const deleteProductMutation = useMutation({
    mutationFn: async (input: DeleteProductInput) => {
      await waitForZeroMutation(zero.mutate(mutators.products.delete(input)));
      return { success: true };
    },
    onSuccess: () => options?.onDeleteProductSuccess?.(),
  });
  const registerInventoryMovementMutation = useMutation({
    mutationFn: async (input: RegisterInventoryMovementInput) => {
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
    onSuccess: () => options?.onRegisterInventoryMovementSuccess?.(),
  });
  const createCategoryMutation = useMutation({
    mutationFn: async (input: CreateCategoryInput) => {
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
    onSuccess: () => options?.onCreateCategorySuccess?.(),
  });
  const updateCategoryMutation = useMutation({
    mutationFn: async (input: UpdateCategoryInput) => {
      await waitForZeroMutation(
        zero.mutate(mutators.products.updateCategory(input))
      );
      return { success: true };
    },
    onSuccess: () => options?.onUpdateCategorySuccess?.(),
  });
  const deleteCategoryMutation = useMutation({
    mutationFn: async (input: DeleteCategoryInput) => {
      await waitForZeroMutation(
        zero.mutate(mutators.products.deleteCategory(input))
      );
      return { success: true };
    },
    onSuccess: () => options?.onDeleteCategorySuccess?.(),
  });

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
