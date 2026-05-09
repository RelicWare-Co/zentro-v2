import { Package } from "lucide-react";
import type { Category, Product } from "@/features/pos/types";
import { ProductGridCard } from "./ProductGridCard";
import { ProductListItem } from "./ProductListItem";
import { CatalogToolbar } from "./CatalogToolbar";

interface ProductCatalogProps {
  categories: Category[];
  activeCategoryId: string;
  searchQuery: string;
  products: Product[];
  isLoading: boolean;
  isActiveShift: boolean;
  viewMode: "grid" | "list";
  getProductQuantity: (productId: string) => number;
  onCategoryChange: (id: string) => void;
  onSearchChange: (query: string) => void;
  onClearSearch: () => void;
  onViewModeChange: (mode: "grid" | "list") => void;
  onProductSelect: (product: Product) => void;
  onToggleFavorite?: (productId: string) => void;
  isTogglingFavorite?: boolean;
}

export function ProductCatalog({
  categories,
  activeCategoryId,
  searchQuery,
  products,
  isLoading,
  isActiveShift,
  viewMode,
  getProductQuantity,
  onCategoryChange,
  onSearchChange,
  onClearSearch,
  onViewModeChange,
  onProductSelect,
  onToggleFavorite,
  isTogglingFavorite,
}: ProductCatalogProps) {
  const regularProducts = products.filter((p) => !p.isModifier);

  return (
    <div className="flex flex-col min-h-0 flex-1 overflow-hidden">
      <CatalogToolbar
        categories={categories}
        activeCategoryId={activeCategoryId}
        searchQuery={searchQuery}
        viewMode={viewMode}
        onCategoryChange={onCategoryChange}
        onSearchChange={onSearchChange}
        onClearSearch={onClearSearch}
        onViewModeChange={onViewModeChange}
      />

      <div className="flex-1 min-h-0 overflow-y-auto px-4 md:px-6 py-3">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center h-40 text-[var(--color-muted-foreground)]">
            <Package className="h-8 w-8 mb-3 animate-pulse" />
            <p className="text-sm">Cargando productos...</p>
          </div>
        ) : regularProducts.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-[var(--color-muted-foreground)]">
            <Package className="h-8 w-8 mb-3" />
            <p className="text-sm">No se encontraron productos.</p>
          </div>
        ) : viewMode === "grid" ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3 md:gap-4 pb-4">
            {regularProducts.map((product) => (
              <ProductGridCard
                key={product.id}
                product={product}
                quantity={getProductQuantity(product.id)}
                isOutOfStock={product.trackInventory && product.stock <= 0}
                isActiveShift={isActiveShift}
                onSelect={() => onProductSelect(product)}
                onToggleFavorite={onToggleFavorite}
                isTogglingFavorite={isTogglingFavorite}
              />
            ))}
          </div>
        ) : (
          <div className="flex flex-col gap-2 md:gap-3 pb-4">
            {regularProducts.map((product) => (
              <ProductListItem
                key={product.id}
                product={product}
                quantity={getProductQuantity(product.id)}
                isOutOfStock={product.trackInventory && product.stock <= 0}
                isActiveShift={isActiveShift}
                onSelect={() => onProductSelect(product)}
                onToggleFavorite={onToggleFavorite}
                isTogglingFavorite={isTogglingFavorite}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
