import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { z } from "zod";
import type { CategorySchema, ProductSchema } from "@/schemas/products";
import { orpcQuery } from "@/server/orpc/client/query";

export type Product = z.infer<typeof ProductSchema>;
export type Category = z.infer<typeof CategorySchema>;

export function useProductsQueries(options: {
  page: number;
  pageSize: number;
  query: string;
  categoryId: string | null;
}) {
  const productsQuery = useQuery(
    orpcQuery.products.list.queryOptions({
      input: {
        page: options.page,
        pageSize: options.pageSize,
        query: options.query || null,
        categoryId: options.categoryId || null,
      },
    })
  );
  const categoriesQuery = useQuery(
    orpcQuery.products.categories.queryOptions()
  );

  return {
    products: productsQuery.data?.items ?? [],
    total: productsQuery.data?.total ?? 0,
    categories: categoriesQuery.data ?? [],
    isPending: productsQuery.isPending || categoriesQuery.isPending,
    isError: productsQuery.isError || categoriesQuery.isError,
    error: productsQuery.error ?? categoriesQuery.error,
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
  const queryClient = useQueryClient();
  const invalidateProducts = async () => {
    await queryClient.invalidateQueries({
      queryKey: ["orpc", "products", "list"],
    });
  };
  const invalidateProductsAndCategories = async () => {
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: ["orpc", "products", "list"],
      }),
      queryClient.invalidateQueries({
        queryKey: orpcQuery.products.categories.queryOptions().queryKey,
      }),
    ]);
  };

  const createProductMutation = useMutation({
    ...orpcQuery.products.create.mutationOptions(),
    onSuccess: async () => {
      options?.onCreateProductSuccess?.();
      await invalidateProducts();
    },
  });
  const updateProductMutation = useMutation({
    ...orpcQuery.products.update.mutationOptions(),
    onSuccess: async () => {
      options?.onUpdateProductSuccess?.();
      await invalidateProducts();
    },
  });
  const deleteProductMutation = useMutation({
    ...orpcQuery.products.delete.mutationOptions(),
    onSuccess: async () => {
      options?.onDeleteProductSuccess?.();
      await invalidateProducts();
    },
  });
  const registerInventoryMovementMutation = useMutation({
    ...orpcQuery.products.registerInventoryMovement.mutationOptions(),
    onSuccess: async () => {
      options?.onRegisterInventoryMovementSuccess?.();
      await invalidateProducts();
    },
  });
  const createCategoryMutation = useMutation({
    ...orpcQuery.products.createCategory.mutationOptions(),
    onSuccess: async () => {
      options?.onCreateCategorySuccess?.();
      await invalidateProductsAndCategories();
    },
  });
  const updateCategoryMutation = useMutation({
    ...orpcQuery.products.updateCategory.mutationOptions(),
    onSuccess: async () => {
      options?.onUpdateCategorySuccess?.();
      await invalidateProductsAndCategories();
    },
  });
  const deleteCategoryMutation = useMutation({
    ...orpcQuery.products.deleteCategory.mutationOptions(),
    onSuccess: async () => {
      options?.onDeleteCategorySuccess?.();
      await invalidateProductsAndCategories();
    },
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
