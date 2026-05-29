import type { ReactNode } from "react";
import { useCallback, useEffect } from "react";
import { useKeyboardBarcodeScanner } from "@/features/posv2/hooks/use-keyboard-barcode-scanner.client";
import {
  buildPosV2BarcodeScanPayload,
  isPosV2ScannerBlocked,
} from "@/features/posv2/posv2-barcode.shared";
import { findCatalogProductByBarcodeScan } from "@/features/products/barcode.shared";
import { CategoriesTab } from "@/features/products/components/categories-tab";
import { CategoryDialog } from "@/features/products/components/category-dialog";
import { InventoryDialog } from "@/features/products/components/inventory-dialog";
import { KardexTab } from "@/features/products/components/kardex-tab";
import { ProductDeleteDialog } from "@/features/products/components/product-delete-dialog";
import { ProductFormSheet } from "@/features/products/components/product-form-sheet";
import { ProductsPageHeader } from "@/features/products/components/products-page-header";
import {
  ProductsPageError,
  ProductsPageLoading,
} from "@/features/products/components/products-page-states";
import {
  ProductsPageCategoriesTabContent,
  ProductsPageKardexTabContent,
  ProductsPageProductsTabContent,
  ProductsPageTabs,
} from "@/features/products/components/products-page-tabs";
import { ProductsTab } from "@/features/products/components/products-tab";
import {
  ProductsPageProvider,
  useProductsPage,
} from "@/features/products/products-page-context";

function ProductsPageRoot({ children }: { children: ReactNode }) {
  return (
    <main className="space-y-6 bg-[var(--color-void)] p-6 text-[var(--color-photon)] md:p-8 lg:p-12">
      {children}
    </main>
  );
}

function ProductsPageLayout() {
  const { state, actions } = useProductsPage();
  const scannerEnabled = !(
    state.isProductSheetOpen ||
    state.isCategoryDialogOpen ||
    state.inventoryProduct ||
    state.productToDelete
  );

  const handleBarcodeScan = useCallback(
    (event: Parameters<typeof buildPosV2BarcodeScanPayload>[0]) => {
      if (isPosV2ScannerBlocked()) {
        return;
      }
      const payload = buildPosV2BarcodeScanPayload(event);
      const match = findCatalogProductByBarcodeScan(
        state.catalogProducts,
        payload.lookupValues
      );
      if (match) {
        actions.openEditProduct(match);
        return;
      }
      actions.setQuery(payload.value);
      actions.setActiveTab("products");
    },
    [actions, state.catalogProducts]
  );

  const { isConnected: isBarcodeScannerConnected } = useKeyboardBarcodeScanner({
    enabled: scannerEnabled,
    onScan: handleBarcodeScan,
  });

  useEffect(() => {
    actions.setIsBarcodeScannerConnected(isBarcodeScannerConnected);
  }, [actions, isBarcodeScannerConnected]);

  if (state.isPending) {
    return <ProductsPageLoading />;
  }

  if (state.isError) {
    return <ProductsPageError />;
  }

  return (
    <>
      <ProductsPageRoot>
        <ProductsPageHeader />
        <ProductsPageTabs>
          <ProductsPageProductsTabContent>
            <ProductsTab />
          </ProductsPageProductsTabContent>
          <ProductsPageCategoriesTabContent>
            <CategoriesTab />
          </ProductsPageCategoriesTabContent>
          <ProductsPageKardexTabContent>
            <KardexTab />
          </ProductsPageKardexTabContent>
        </ProductsPageTabs>
      </ProductsPageRoot>
      <ProductFormSheet />
      <CategoryDialog />
      <InventoryDialog />
      <ProductDeleteDialog />
    </>
  );
}

export function ProductsPage() {
  return (
    <ProductsPageProvider>
      <ProductsPageLayout />
    </ProductsPageProvider>
  );
}

export const ProductsPageCompound = {
  Provider: ProductsPageProvider,
  Root: ProductsPageRoot,
  Header: ProductsPageHeader,
  Tabs: ProductsPageTabs,
  ProductsTab,
  CategoriesTab,
  ProductFormSheet,
  CategoryDialog,
  InventoryDialog,
  ProductDeleteDialog,
};
