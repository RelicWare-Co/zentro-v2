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
      <TabsList className="flex h-auto w-full flex-wrap gap-2 border-0 bg-transparent p-0">
        <TabsTrigger
          className="data-[state=active]:!border-zinc-700 h-10 flex-1 gap-2 rounded-xl border border-transparent px-5 font-medium text-sm text-zinc-400 transition-all hover:text-white data-[state=active]:bg-[var(--color-carbon)] data-[state=active]:text-white sm:flex-none"
          value="products"
        >
          <Package className="size-4" />
          Productos
        </TabsTrigger>
        <TabsTrigger
          className="data-[state=active]:!border-zinc-700 h-10 flex-1 gap-2 rounded-xl border border-transparent px-5 font-medium text-sm text-zinc-400 transition-all hover:text-white data-[state=active]:bg-[var(--color-carbon)] data-[state=active]:text-white sm:flex-none"
          value="categories"
        >
          Categorías
        </TabsTrigger>
        <TabsTrigger
          className="data-[state=active]:!border-zinc-700 h-10 flex-1 gap-2 rounded-xl border border-transparent px-5 font-medium text-sm text-zinc-400 transition-all hover:text-white data-[state=active]:bg-[var(--color-carbon)] data-[state=active]:text-white sm:flex-none"
          value="kardex"
        >
          <History className="size-4" />
          Kardex
        </TabsTrigger>
      </TabsList>
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
