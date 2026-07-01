import { SegmentedControl } from "@mantine/core";
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
    <div className="space-y-6">
      <div className="mb-6 flex w-full justify-center">
        <SegmentedControl
          className="w-full sm:w-auto!"
          data={[
            {
              label: (
                <span className="inline-flex items-center gap-1.5">
                  <Package className="size-4" /> Productos
                </span>
              ),
              value: "products",
            },
            { label: "Categorías", value: "categories" },
            {
              label: (
                <span className="inline-flex items-center gap-1.5">
                  <History className="size-4" /> Kardex
                </span>
              ),
              value: "kardex",
            },
          ]}
          fullWidth
          onChange={(value) => {
            if (
              PRODUCTS_TAB_VALUES.includes(
                value as (typeof PRODUCTS_TAB_VALUES)[number]
              )
            ) {
              actions.setActiveTab(value as ProductsTab);
            }
          }}
          value={state.activeTab}
        />
      </div>
      {children}
    </div>
  );
}

export function ProductsPageProductsTabContent({
  children,
}: {
  children: ReactNode;
}) {
  const { state } = useProductsPage();
  return (
    <div className="space-y-6" hidden={state.activeTab !== "products"}>
      {children}
    </div>
  );
}

export function ProductsPageCategoriesTabContent({
  children,
}: {
  children: ReactNode;
}) {
  const { state } = useProductsPage();
  return (
    <div className="space-y-6" hidden={state.activeTab !== "categories"}>
      {children}
    </div>
  );
}

export function ProductsPageKardexTabContent({
  children,
}: {
  children: ReactNode;
}) {
  const { state } = useProductsPage();
  return (
    <div className="space-y-6" hidden={state.activeTab !== "kardex"}>
      {children}
    </div>
  );
}
