import { Tabs } from "@mantine/core";
import { History, Package } from "lucide-react";
import type { ReactNode } from "react";
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
      onChange={(value) => {
        if (
          value &&
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
        <Tabs.List>
          <Tabs.Tab
            className="flex-1 sm:flex-none"
            leftSection={<Package className="size-4" />}
            value="products"
          >
            Productos
          </Tabs.Tab>
          <Tabs.Tab className="flex-1 sm:flex-none" value="categories">
            Categorías
          </Tabs.Tab>
          <Tabs.Tab
            className="flex-1 sm:flex-none"
            leftSection={<History className="size-4" />}
            value="kardex"
          >
            Kardex
          </Tabs.Tab>
        </Tabs.List>
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
    <Tabs.Panel className="space-y-6" value="products">
      {children}
    </Tabs.Panel>
  );
}

export function ProductsPageCategoriesTabContent({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <Tabs.Panel className="space-y-6" value="categories">
      {children}
    </Tabs.Panel>
  );
}

export function ProductsPageKardexTabContent({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <Tabs.Panel className="space-y-6" value="kardex">
      {children}
    </Tabs.Panel>
  );
}
