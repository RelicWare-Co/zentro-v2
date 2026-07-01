import {
  createContext,
  type ReactNode,
  use,
  useCallback,
  useMemo,
  useState,
} from "react";
import {
  usePosCategories,
  usePosModifierProducts,
  usePosProducts,
  usePosSettings,
  useToggleProductFavoriteMutation,
} from "@/features/pos/hooks/use-pos-catalog";
import type { PosPaymentMethodOption } from "@/features/pos/sale-modes/types";
import type { Category, Product } from "@/features/pos/types";
import { findProductByBarcodeScan } from "@/features/posv2/posv2-barcode.shared";
import { useActiveOrganization } from "@/lib/auth-client";

export interface PosCatalogContextValue {
  activeCategoryId: string;
  activeOrganizationId: string | null;
  activeOrganizationName: string | null;
  allowCreditSales: boolean;
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
  resolveBarcodeProduct: (lookupValues: string[]) => Product | undefined;
  searchQuery: string;
  setActiveCategoryId: (id: string) => void;
  setSearchQuery: (query: string) => void;
  setViewMode: (mode: "grid" | "list") => void;
  toggleProductFavorite: (productId: string) => void;
  viewMode: "grid" | "list";
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
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

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

  const resolveBarcodeProduct = useCallback(
    (lookupValues: string[]) =>
      findProductByBarcodeScan(products, lookupValues),
    [products]
  );

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
    resolveBarcodeProduct,
    searchQuery,
    setActiveCategoryId,
    setSearchQuery,
    setViewMode,
    toggleProductFavorite,
    viewMode,
  };

  return <PosCatalogContext value={value}>{children}</PosCatalogContext>;
}
