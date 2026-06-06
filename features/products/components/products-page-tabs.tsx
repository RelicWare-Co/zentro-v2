import { History, Package } from "lucide-react";
import type { ReactNode } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  PRODUCTS_TAB_VALUES,
  type ProductsTab,
} from "@/features/products/products-page.constants.shared";
import { useProductsPage } from "@/features/products/products-page-context";

export function ProductsPageTabs({ children }: { children: ReactNode }) {
  const { state, actions } = useProductsPage();

  return (
    <Tabs
      className="space-y-6"
      onValueChange={(value) => {
        if (
          PRODUCTS_TAB_VALUES.includes(
            value as (typeof PRODUCTS_TAB_VALUES)[number]
          )
        ) {
          actions.setActiveTab(value as ProductsTab);
        }
      }}
      value={state.activeTab}
    >
      <div className="mb-6 flex w-full justify-center">
        <TabsList>
          <TabsTrigger className="flex-1 sm:flex-none" value="products">
            <Package className="size-4" />
            Productos
          </TabsTrigger>
          <TabsTrigger className="flex-1 sm:flex-none" value="categories">
            Categorías
          </TabsTrigger>
          <TabsTrigger className="flex-1 sm:flex-none" value="kardex">
            <History className="size-4" />
            Kardex
          </TabsTrigger>
        </TabsList>
      </div>
      {children}
    </Tabs>
  );
}

export function ProductsPageProductsTabContent({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <TabsContent className="space-y-6" value="products">
      {children}
    </TabsContent>
  );
}

export function ProductsPageCategoriesTabContent({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <TabsContent className="space-y-6" value="categories">
      {children}
    </TabsContent>
  );
}

export function ProductsPageKardexTabContent({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <TabsContent className="space-y-6" value="kardex">
      {children}
    </TabsContent>
  );
}
