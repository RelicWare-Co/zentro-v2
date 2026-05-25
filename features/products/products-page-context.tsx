import type { PaginationState, Updater } from "@tanstack/react-table";
import {
  createContext,
  type ReactNode,
  use,
  useCallback,
  useMemo,
  useState,
} from "react";
import { ALL_FILTER_VALUE } from "@/features/listing/listing.constants.shared";
import {
  type Category,
  type Product,
  useProductsMutations,
  useProductsQueries,
} from "@/features/products/hooks/use-products";
import {
  DEFAULT_PRODUCTS_PAGE_SIZE,
  type ProductsTab,
  UNCATEGORIZED_FILTER_VALUE,
} from "@/features/products/products-page.constants.shared";

export type InventoryMovementType = "restock" | "waste" | "adjustment";

interface ProductsPageFilters {
  categoryFilter: string;
  query: string;
}

export interface ProductsPageState {
  activeTab: ProductsTab;
  categories: Category[];
  editingProduct: Product | null;
  error: unknown;
  filters: ProductsPageFilters;
  inventoryNotes: string;
  inventoryProduct: Product | null;
  inventoryQuantity: string;
  inventoryType: InventoryMovementType;
  isCategoryDialogOpen: boolean;
  isError: boolean;
  isPending: boolean;
  isProductSheetOpen: boolean;
  pagination: PaginationState;
  products: Product[];
  productsWithInventory: Product[];
  productToDelete: Product | null;
  selectedCategory: Category | null;
  total: number;
}

export interface ProductsPageActions {
  closeCategoryDialog: () => void;
  closeInventoryDialog: () => void;
  closeProductSheet: () => void;
  confirmDeleteProduct: () => Promise<void>;
  deleteCategory: () => Promise<void>;
  openCreateCategory: () => void;
  openCreateProduct: () => void;
  openEditCategory: (category: Category) => void;
  openEditProduct: (product: Product) => void;
  openInventoryForProduct: (product: Product) => void;
  openInventoryMovement: () => void;
  requestDeleteProduct: (product: Product) => void;
  saveCategory: (payload: {
    name: string;
    description: string | null;
  }) => Promise<void>;
  saveInventoryMovement: () => Promise<void>;
  saveProduct: (payload: {
    id?: string;
    name: string;
    categoryId: string | null;
    sku: string | null;
    barcode: string | null;
    price: number;
    cost: number;
    taxRate: number;
    stock: number;
    trackInventory: boolean;
    isModifier: boolean;
  }) => Promise<void>;
  setActiveTab: (tab: ProductsTab) => void;
  setCategoryFilter: (value: string) => void;
  setInventoryNotes: (value: string) => void;
  setInventoryProduct: (product: Product | null) => void;
  setInventoryQuantity: (value: string) => void;
  setInventoryType: (value: InventoryMovementType) => void;
  setPagination: (updater: Updater<PaginationState>) => void;
  setProductToDelete: (product: Product | null) => void;
  setQuery: (value: string) => void;
}

export interface ProductsPageMeta {
  categoryError: unknown;
  mutations: ReturnType<typeof useProductsMutations>;
  productFormError: unknown;
  resolvedCategoryId: string | null;
}

export interface ProductsPageContextValue {
  actions: ProductsPageActions;
  meta: ProductsPageMeta;
  state: ProductsPageState;
}

const ProductsPageContext = createContext<ProductsPageContextValue | null>(
  null
);

export function useProductsPage() {
  const context = use(ProductsPageContext);
  if (!context) {
    throw new Error(
      "useProductsPage must be used within ProductsPageProvider."
    );
  }
  return context;
}

export function ProductsPageProvider({ children }: { children: ReactNode }) {
  const [activeTab, setActiveTab] = useState<ProductsTab>("products");
  const [query, setQueryState] = useState("");
  const [categoryFilter, setCategoryFilterState] = useState(ALL_FILTER_VALUE);
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: DEFAULT_PRODUCTS_PAGE_SIZE,
  });
  const [isProductSheetOpen, setIsProductSheetOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);
  const [isCategoryDialogOpen, setIsCategoryDialogOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(
    null
  );
  const [inventoryProduct, setInventoryProduct] = useState<Product | null>(
    null
  );
  const [inventoryType, setInventoryType] =
    useState<InventoryMovementType>("restock");
  const [inventoryQuantity, setInventoryQuantity] = useState("");
  const [inventoryNotes, setInventoryNotes] = useState("");

  const mutations = useProductsMutations({
    onCreateProductSuccess: () => {
      setIsProductSheetOpen(false);
      setEditingProduct(null);
    },
    onUpdateProductSuccess: () => {
      setIsProductSheetOpen(false);
      setEditingProduct(null);
    },
    onDeleteProductSuccess: () => setProductToDelete(null),
    onCreateCategorySuccess: () => {
      setIsCategoryDialogOpen(false);
      setSelectedCategory(null);
    },
    onUpdateCategorySuccess: () => {
      setIsCategoryDialogOpen(false);
      setSelectedCategory(null);
    },
    onDeleteCategorySuccess: () => {
      setIsCategoryDialogOpen(false);
      setSelectedCategory(null);
    },
    onRegisterInventoryMovementSuccess: () => {
      setInventoryProduct(null);
      setInventoryQuantity("");
      setInventoryNotes("");
      setInventoryType("restock");
    },
  });

  const resolvedCategoryId = useMemo(() => {
    if (categoryFilter === ALL_FILTER_VALUE) {
      return null;
    }
    if (categoryFilter === UNCATEGORIZED_FILTER_VALUE) {
      return "uncategorized";
    }
    return categoryFilter;
  }, [categoryFilter]);

  const { products, total, categories, isPending, isError, error } =
    useProductsQueries({
      page: pagination.pageIndex,
      pageSize: pagination.pageSize,
      query,
      categoryId: resolvedCategoryId,
    });

  const productsWithInventory = useMemo(
    () => products.filter((product) => product.trackInventory),
    [products]
  );

  const setQuery = useCallback((value: string) => {
    setQueryState(value);
    setPagination((prev) => ({ ...prev, pageIndex: 0 }));
  }, []);

  const setCategoryFilter = useCallback((value: string) => {
    setCategoryFilterState(value);
    setPagination((prev) => ({ ...prev, pageIndex: 0 }));
  }, []);

  const openCreateProduct = useCallback(() => {
    setEditingProduct(null);
    setIsProductSheetOpen(true);
  }, []);

  const openEditProduct = useCallback((product: Product) => {
    setEditingProduct(product);
    setIsProductSheetOpen(true);
  }, []);

  const closeProductSheet = useCallback(() => {
    setIsProductSheetOpen(false);
    setEditingProduct(null);
  }, []);

  const requestDeleteProduct = useCallback((product: Product) => {
    setProductToDelete(product);
  }, []);

  const confirmDeleteProduct = useCallback(async () => {
    if (!productToDelete) {
      return;
    }
    await mutations.deleteProductMutation.mutateAsync({
      id: productToDelete.id,
    });
  }, [mutations.deleteProductMutation, productToDelete]);

  const openCreateCategory = useCallback(() => {
    setSelectedCategory(null);
    setIsCategoryDialogOpen(true);
  }, []);

  const openEditCategory = useCallback((category: Category) => {
    setSelectedCategory(category);
    setIsCategoryDialogOpen(true);
  }, []);

  const closeCategoryDialog = useCallback(() => {
    setIsCategoryDialogOpen(false);
    setSelectedCategory(null);
  }, []);

  const saveCategory = useCallback(
    async (payload: { name: string; description: string | null }) => {
      if (selectedCategory) {
        await mutations.updateCategoryMutation.mutateAsync({
          id: selectedCategory.id,
          ...payload,
        });
        return;
      }
      await mutations.createCategoryMutation.mutateAsync(payload);
    },
    [
      mutations.createCategoryMutation,
      mutations.updateCategoryMutation,
      selectedCategory,
    ]
  );

  const deleteCategory = useCallback(async () => {
    if (!selectedCategory) {
      return;
    }
    await mutations.deleteCategoryMutation.mutateAsync({
      id: selectedCategory.id,
    });
  }, [mutations.deleteCategoryMutation, selectedCategory]);

  const openInventoryForProduct = useCallback((product: Product) => {
    setInventoryProduct(product);
  }, []);

  const openInventoryMovement = useCallback(() => {
    const firstTrackedProduct = products.find(
      (product) => product.trackInventory
    );
    setInventoryProduct(firstTrackedProduct ?? null);
  }, [products]);

  const closeInventoryDialog = useCallback(() => {
    setInventoryProduct(null);
    setInventoryQuantity("");
    setInventoryNotes("");
    setInventoryType("restock");
  }, []);

  const saveInventoryMovement = useCallback(async () => {
    if (!inventoryProduct) {
      return;
    }
    await mutations.registerInventoryMovementMutation.mutateAsync({
      productId: inventoryProduct.id,
      type: inventoryType,
      quantity: Math.round(Number(inventoryQuantity)),
      notes: inventoryNotes.trim() || null,
    });
  }, [
    inventoryNotes,
    inventoryProduct,
    inventoryQuantity,
    inventoryType,
    mutations.registerInventoryMovementMutation,
  ]);

  const saveProduct = useCallback(
    async (payload: {
      id?: string;
      name: string;
      categoryId: string | null;
      sku: string | null;
      barcode: string | null;
      price: number;
      cost: number;
      taxRate: number;
      stock: number;
      trackInventory: boolean;
      isModifier: boolean;
    }) => {
      if (payload.id) {
        await mutations.updateProductMutation.mutateAsync({
          ...payload,
          id: payload.id,
        });
        return;
      }
      await mutations.createProductMutation.mutateAsync(payload);
    },
    [mutations.createProductMutation, mutations.updateProductMutation]
  );

  const productFormError =
    mutations.createProductMutation.error ??
    mutations.updateProductMutation.error;
  const categoryError =
    mutations.createCategoryMutation.error ??
    mutations.updateCategoryMutation.error ??
    mutations.deleteCategoryMutation.error;

  const value = useMemo<ProductsPageContextValue>(
    () => ({
      state: {
        activeTab,
        filters: {
          query,
          categoryFilter,
        },
        pagination,
        products,
        categories,
        total,
        productsWithInventory,
        isPending,
        isError,
        error,
        isProductSheetOpen,
        editingProduct,
        productToDelete,
        isCategoryDialogOpen,
        selectedCategory,
        inventoryProduct,
        inventoryType,
        inventoryQuantity,
        inventoryNotes,
      },
      actions: {
        setActiveTab,
        setQuery,
        setCategoryFilter,
        setPagination,
        openCreateProduct,
        openEditProduct,
        closeProductSheet,
        requestDeleteProduct,
        confirmDeleteProduct,
        openCreateCategory,
        openEditCategory,
        closeCategoryDialog,
        saveCategory,
        deleteCategory,
        openInventoryForProduct,
        openInventoryMovement,
        closeInventoryDialog,
        saveInventoryMovement,
        setInventoryType,
        setInventoryQuantity,
        setInventoryNotes,
        setInventoryProduct,
        saveProduct,
        setProductToDelete,
      },
      meta: {
        mutations,
        resolvedCategoryId,
        productFormError,
        categoryError,
      },
    }),
    [
      activeTab,
      query,
      categoryFilter,
      pagination,
      products,
      categories,
      total,
      productsWithInventory,
      isPending,
      isError,
      error,
      isProductSheetOpen,
      editingProduct,
      productToDelete,
      isCategoryDialogOpen,
      selectedCategory,
      inventoryProduct,
      inventoryType,
      inventoryQuantity,
      inventoryNotes,
      setQuery,
      setCategoryFilter,
      openCreateProduct,
      openEditProduct,
      closeProductSheet,
      requestDeleteProduct,
      confirmDeleteProduct,
      openCreateCategory,
      openEditCategory,
      closeCategoryDialog,
      saveCategory,
      deleteCategory,
      openInventoryForProduct,
      openInventoryMovement,
      closeInventoryDialog,
      saveInventoryMovement,
      saveProduct,
      mutations,
      resolvedCategoryId,
      productFormError,
      categoryError,
    ]
  );

  return <ProductsPageContext value={value}>{children}</ProductsPageContext>;
}
