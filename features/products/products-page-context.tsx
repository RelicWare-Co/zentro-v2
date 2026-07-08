import { useQuery as useZeroQuery } from "@rocicorp/zero/react";
import type { PaginationState, Updater } from "@tanstack/react-table";
import {
  createContext,
  type ReactNode,
  use,
  useCallback,
  useMemo,
  useState,
} from "react";
import type { StockStatus } from "@/features/inventory/stock-status.shared";
import { ALL_FILTER_VALUE } from "@/features/listing/listing.constants.shared";
import {
  type Category,
  type Product,
  type ProductIngredient,
  useProductIngredients,
  useProductsMutations,
  useProductsQueries,
} from "@/features/products/hooks/use-products";
import {
  DEFAULT_PRODUCTS_PAGE_SIZE,
  type ProductStockFilterValue,
  type ProductsTab,
  UNCATEGORIZED_FILTER_VALUE,
} from "@/features/products/products-page.constants.shared";
import {
  getEnabledPaymentMethods,
  parseOrganizationSettingsMetadata,
} from "@/features/settings/settings.shared";
import { queries } from "@/zero/queries";

export type InventoryMovementType = "restock" | "waste" | "adjustment";
export type InventoryRestockMode = "add_to_stock" | "set_as_total";

interface ProductsPageFilters {
  categoryFilter: string;
  query: string;
  stockFilter: ProductStockFilterValue;
}

export interface ProductsPageState {
  activeTab: ProductsTab;
  barcodeCatalogProducts: Product[];
  catalogProducts: Product[];
  categories: Category[];
  editingProduct: Product | null;
  editingProductIngredients: ProductIngredient[];
  enabledPaymentMethods: Array<{ id: string; label: string }>;
  error: unknown;
  filters: ProductsPageFilters;
  inventoryNotes: string;
  inventoryProduct: Product | null;
  inventoryQuantity: string;
  inventoryRestockMode: InventoryRestockMode;
  inventoryType: InventoryMovementType;
  isBarcodeScannerConnected: boolean;
  isCategoryDialogOpen: boolean;
  isError: boolean;
  isPending: boolean;
  isProductSheetOpen: boolean;
  lastCreatedCategoryId: string | null;
  lowStockThreshold: number;
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
    stock?: number;
    minStock: number | null;
    reorderQuantity: number | null;
    trackInventory: boolean;
    isModifier: boolean;
    accountingTreatment?: "revenue" | "passthrough";
    autoPayoutEnabled?: boolean;
    autoPayoutPaymentMethod?: string;
    isIngredient?: boolean;
  }) => Promise<void>;
  saveProductIngredients: (payload: {
    productId: string;
    ingredients: Array<{ ingredientId: string; quantity: number }>;
  }) => Promise<void>;
  setActiveTab: (tab: ProductsTab) => void;
  setCategoryFilter: (value: string) => void;
  setInventoryNotes: (value: string) => void;
  setInventoryProduct: (product: Product | null) => void;
  setInventoryQuantity: (value: string) => void;
  setInventoryRestockMode: (value: InventoryRestockMode) => void;
  setInventoryType: (value: InventoryMovementType) => void;
  setIsBarcodeScannerConnected: (value: boolean) => void;
  setPagination: (updater: Updater<PaginationState>) => void;
  setProductToDelete: (product: Product | null) => void;
  setQuery: (value: string) => void;
  setStockFilter: (value: ProductStockFilterValue) => void;
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
  const [lastCreatedCategoryId, setLastCreatedCategoryId] = useState<
    string | null
  >(null);
  const [inventoryProduct, setInventoryProduct] = useState<Product | null>(
    null
  );
  const [inventoryType, setInventoryType] =
    useState<InventoryMovementType>("restock");
  const [inventoryQuantity, setInventoryQuantity] = useState("");
  const [inventoryNotes, setInventoryNotes] = useState("");
  const [inventoryRestockMode, setInventoryRestockMode] =
    useState<InventoryRestockMode>("add_to_stock");
  const [stockFilter, setStockFilterState] = useState<ProductStockFilterValue>(
    () => {
      if (typeof window === "undefined") {
        return "all";
      }
      const stockParam = new URLSearchParams(window.location.search).get(
        "stock"
      );
      return stockParam === "low" ||
        stockParam === "out" ||
        stockParam === "ok" ||
        stockParam === "debt"
        ? (stockParam as ProductStockFilterValue)
        : "all";
    }
  );
  const [isBarcodeScannerConnected, setIsBarcodeScannerConnected] =
    useState(false);

  const [organizationRows] = useZeroQuery(queries.organization.current());
  const { lowStockThreshold, enabledPaymentMethods } = useMemo(() => {
    const settings = parseOrganizationSettingsMetadata(
      typeof organizationRows[0]?.metadata === "string"
        ? organizationRows[0]?.metadata
        : null
    );
    return {
      lowStockThreshold: settings.inventory.lowStockThreshold,
      enabledPaymentMethods: getEnabledPaymentMethods(settings).map(
        (method) => ({ id: method.id, label: method.label })
      ),
    };
  }, [organizationRows]);

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

  const {
    products,
    catalogProducts,
    total,
    categories,
    isPending,
    isError,
    error,
  } = useProductsQueries({
    page: pagination.pageIndex,
    pageSize: pagination.pageSize,
    query,
    categoryId: resolvedCategoryId,
    stockFilter:
      stockFilter === "all" ? undefined : (stockFilter as StockStatus),
    lowStockThreshold,
  });

  const { catalogProducts: barcodeCatalogProducts } = useProductsQueries({
    page: 0,
    pageSize: DEFAULT_PRODUCTS_PAGE_SIZE,
    query: "",
    categoryId: null,
    lowStockThreshold,
  });

  const { productIngredients: editingProductIngredients } =
    useProductIngredients(
      isProductSheetOpen ? (editingProduct?.id ?? null) : null
    );

  const productsWithInventory = useMemo(
    () => catalogProducts.filter((product) => product.trackInventory),
    [catalogProducts]
  );

  const setQuery = useCallback((value: string) => {
    setQueryState(value);
    setPagination((prev) => ({ ...prev, pageIndex: 0 }));
  }, []);

  const setCategoryFilter = useCallback((value: string) => {
    setCategoryFilterState(value);
    setPagination((prev) => ({ ...prev, pageIndex: 0 }));
  }, []);

  const setStockFilter = useCallback((value: ProductStockFilterValue) => {
    setStockFilterState(value);
    setPagination((prev) => ({ ...prev, pageIndex: 0 }));
  }, []);

  const openCreateProduct = useCallback(() => {
    setLastCreatedCategoryId(null);
    setEditingProduct(null);
    setIsProductSheetOpen(true);
  }, []);

  const openEditProduct = useCallback((product: Product) => {
    setLastCreatedCategoryId(null);
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
      const created =
        await mutations.createCategoryMutation.mutateAsync(payload);
      setLastCreatedCategoryId(created.id);
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
    setInventoryType("restock");
    setInventoryRestockMode("add_to_stock");
    if (
      typeof product.reorderQuantity === "number" &&
      product.reorderQuantity > 0
    ) {
      setInventoryQuantity(String(product.reorderQuantity));
    } else {
      setInventoryQuantity("");
    }
    setInventoryNotes("");
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
    setInventoryRestockMode("add_to_stock");
  }, []);

  const saveInventoryMovement = useCallback(async () => {
    if (!inventoryProduct) {
      return;
    }
    await mutations.registerInventoryMovementMutation.mutateAsync({
      productId: inventoryProduct.id,
      type: inventoryType,
      quantity: Math.round(Number(inventoryQuantity)),
      restockMode:
        inventoryType === "restock" ? inventoryRestockMode : undefined,
      notes: inventoryNotes.trim() || null,
    });
  }, [
    inventoryNotes,
    inventoryProduct,
    inventoryQuantity,
    inventoryRestockMode,
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
      stock?: number;
      minStock: number | null;
      reorderQuantity: number | null;
      trackInventory: boolean;
      isModifier: boolean;
      accountingTreatment?: "revenue" | "passthrough";
      autoPayoutEnabled?: boolean;
      autoPayoutPaymentMethod?: string;
      isIngredient?: boolean;
    }) => {
      if (payload.id) {
        await mutations.updateProductMutation.mutateAsync({
          ...payload,
          id: payload.id,
        });
        return;
      }
      await mutations.createProductMutation.mutateAsync({
        ...payload,
        isIngredient: payload.isIngredient ?? false,
      });
    },
    [mutations.createProductMutation, mutations.updateProductMutation]
  );

  const saveProductIngredients = useCallback(
    async (payload: {
      productId: string;
      ingredients: Array<{ ingredientId: string; quantity: number }>;
    }) => {
      await mutations.setProductIngredientsMutation.mutateAsync(payload);
    },
    [mutations.setProductIngredientsMutation]
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
          stockFilter,
        },
        pagination,
        products,
        barcodeCatalogProducts,
        catalogProducts,
        categories,
        enabledPaymentMethods,
        total,
        productsWithInventory,
        lowStockThreshold,
        isBarcodeScannerConnected,
        isPending,
        isError,
        error,
        isProductSheetOpen,
        editingProduct,
        editingProductIngredients,
        lastCreatedCategoryId,
        productToDelete,
        isCategoryDialogOpen,
        selectedCategory,
        inventoryProduct,
        inventoryType,
        inventoryQuantity,
        inventoryNotes,
        inventoryRestockMode,
      },
      actions: {
        setActiveTab,
        setQuery,
        setCategoryFilter,
        setStockFilter,
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
        setInventoryRestockMode,
        setInventoryQuantity,
        setInventoryNotes,
        setInventoryProduct,
        setIsBarcodeScannerConnected,
        saveProduct,
        saveProductIngredients,
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
      stockFilter,
      pagination,
      products,
      barcodeCatalogProducts,
      catalogProducts,
      categories,
      enabledPaymentMethods,
      lowStockThreshold,
      isBarcodeScannerConnected,
      total,
      productsWithInventory,
      isPending,
      isError,
      error,
      isProductSheetOpen,
      editingProduct,
      editingProductIngredients,
      lastCreatedCategoryId,
      productToDelete,
      isCategoryDialogOpen,
      selectedCategory,
      inventoryProduct,
      inventoryType,
      inventoryQuantity,
      inventoryNotes,
      inventoryRestockMode,
      setQuery,
      setCategoryFilter,
      setStockFilter,
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
      saveProductIngredients,
      mutations,
      resolvedCategoryId,
      productFormError,
      categoryError,
    ]
  );

  return <ProductsPageContext value={value}>{children}</ProductsPageContext>;
}
