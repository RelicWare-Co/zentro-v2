import {
  createContext,
  type ReactNode,
  use,
  useCallback,
  useMemo,
  useState,
} from "react";
import {
  usePosBarcodeCatalog,
  usePosCategories,
  usePosModifierProducts,
  usePosProducts,
  usePosSettings,
  useToggleProductFavoriteMutation,
} from "@/features/pos/hooks/use-pos-catalog";
import type { PosPaymentMethodOption } from "@/features/pos/sale-modes/types";
import type { Category, Product } from "@/features/pos/types";
import { useActiveOrganization } from "@/lib/auth-client";

export interface PosCatalogContextValue {
  activeCategoryId: string;
  activeOrganizationId: string | null;
  activeOrganizationName: string | null;
  allowCreditSales: boolean;
  /** Unfiltered catalog used for barcode/sku scan lookups. */
  barcodeScanProducts: Product[];
  /** Catalog filtered by the current category/search UI filters. */
  categories: Category[];
  defaultTerminalName: string;
  fetchNextProductsPage: () => void;
  hasNextPage: boolean;
  isBootstrapLoading: boolean;
  isFetchingNextPage: boolean;
  isProductsLoading: boolean;
  isTogglingFavorite: boolean;
  modifierProducts: Product[];
  paymentMethodOptions: PosPaymentMethodOption[];
  paymentMethodsForReceipt: PosPaymentMethodOption[];
  products: Product[];
  searchQuery: string;
  setActiveCategoryId: (id: string) => void;
  setSearchQuery: (query: string) => void;
  toggleProductFavorite: (productId: string) => void;
}

const PosCatalogContext = createContext<PosCatalogContextValue | null>(null);

export function usePosCatalog() {
  const context = use(PosCatalogContext);
  if (!context) {
    throw new Error("usePosCatalog must be used within PosCatalogProvider.");
  }
  return context;
}

export function PosCatalogProvider({ children }: { children: ReactNode }) {
  const [activeCategoryId, setActiveCategoryId] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  const { data: activeOrganization } = useActiveOrganization();
  const activeOrganizationId = activeOrganization?.id ?? null;
  const activeOrganizationName = activeOrganization?.name ?? null;

  const { data: settings, isLoading: isSettingsLoading } = usePosSettings();
  const { data: categories, isLoading: isCategoriesLoading } =
    usePosCategories();
  const { data: modifierProducts, isLoading: isModifiersLoading } =
    usePosModifierProducts();
  const isBootstrapLoading =
    isSettingsLoading || isCategoriesLoading || isModifiersLoading;

  const {
    data: productsData,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading: isProductsLoading,
  } = usePosProducts(activeCategoryId, searchQuery);
  const barcodeScanProducts = usePosBarcodeCatalog();

  const toggleFavoriteMutation = useToggleProductFavoriteMutation();

  const paymentMethodOptions = useMemo<PosPaymentMethodOption[]>(
    () =>
      settings?.paymentMethods.map((method) => ({
        id: method.id,
        label: method.label,
        requiresReference: method.requiresReference,
      })) ?? [],
    [settings?.paymentMethods]
  );
  const allowCreditSales = settings?.allowCreditSales ?? false;
  const defaultTerminalName = settings?.defaultTerminalName ?? "Caja Principal";
  const paymentMethodsForReceipt = settings?.paymentMethods ?? [];

  const products = productsData?.pages.flatMap((page) => page.data) ?? [];

  const toggleProductFavorite = useCallback(
    (productId: string) => {
      toggleFavoriteMutation.mutate({ productId });
    },
    [toggleFavoriteMutation]
  );

  const value: PosCatalogContextValue = {
    activeCategoryId,
    activeOrganizationId,
    activeOrganizationName,
    allowCreditSales,
    barcodeScanProducts,
    categories: categories ?? [],
    defaultTerminalName,
    fetchNextProductsPage: fetchNextPage,
    hasNextPage: !!hasNextPage,
    isBootstrapLoading,
    isFetchingNextPage,
    isProductsLoading,
    isTogglingFavorite: toggleFavoriteMutation.isPending,
    modifierProducts: modifierProducts ?? [],
    paymentMethodOptions,
    paymentMethodsForReceipt,
    products,
    searchQuery,
    setActiveCategoryId,
    setSearchQuery,
    toggleProductFavorite,
  };

  return <PosCatalogContext value={value}>{children}</PosCatalogContext>;
}
