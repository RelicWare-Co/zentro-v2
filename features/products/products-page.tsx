import type { ReactNode } from "react";
import { CategoriesTab } from "@/features/products/components/categories-tab";
import { CategoryDialog } from "@/features/products/components/category-dialog";
import { InventoryDialog } from "@/features/products/components/inventory-dialog";
import { ProductDeleteDialog } from "@/features/products/components/product-delete-dialog";
import { ProductFormSheet } from "@/features/products/components/product-form-sheet";
import { ProductsPageHeader } from "@/features/products/components/products-page-header";
import {
  ProductsPageError,
  ProductsPageLoading,
} from "@/features/products/components/products-page-states";
import {
  ProductsPageCategoriesTabContent,
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
  const { state } = useProductsPage();

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
