import { Package } from "lucide-react";
import { type ReactNode, useEffect, useRef } from "react";
import type { Category, Product } from "@/features/pos/types";
import { CatalogToolbar } from "./catalog-toolbar";
import { ProductGridCard } from "./product-grid-card";
import { ProductListItem } from "./product-list-item";

interface ProductCatalogProps {
  activeCategoryId: string;
  categories: Category[];
  getProductQuantity: (productId: string) => number;
  hasMore?: boolean;
  isActiveShift: boolean;
  isLoading: boolean;
  isLoadingMore?: boolean;
  isTogglingFavorite?: boolean;
  onCategoryChange: (id: string) => void;
  onClearSearch: () => void;
  onLoadMore?: () => void;
  onProductSelect: (product: Product) => void;
  onSearchChange: (query: string) => void;
  onToggleFavorite?: (productId: string) => void;
  onViewModeChange: (mode: "grid" | "list") => void;
  products: Product[];
  searchQuery: string;
  viewMode: "grid" | "list";
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
  onLoadMore,
  hasMore,
  isLoadingMore,
}: ProductCatalogProps) {
  const regularProducts = products.filter((p) => !p.isModifier);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!(hasMore && onLoadMore)) {
      return;
    }
    const el = loadMoreRef.current;
    if (!el) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          onLoadMore();
        }
      },
      { rootMargin: "200px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasMore, onLoadMore]);

  let productContent: ReactNode;
  if (isLoading) {
    productContent = (
      <div className="flex h-40 flex-col items-center justify-center text-[#6b6b6b]">
        <Package className="mb-3 size-8 animate-pulse" />
        <p className="text-sm">Cargando productos…</p>
      </div>
    );
  } else if (regularProducts.length === 0) {
    productContent = (
      <div className="flex h-40 flex-col items-center justify-center text-[#6b6b6b]">
        <Package className="mb-3 size-8" />
        <p className="text-sm">No se encontraron productos.</p>
      </div>
    );
  } else if (viewMode === "grid") {
    productContent = (
      <div className="grid grid-cols-2 gap-3 pb-4 sm:grid-cols-3 md:gap-4 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
        {regularProducts.map((product) => (
          <ProductGridCard
            isActiveShift={isActiveShift}
            isOutOfStock={product.trackInventory && product.stock <= 0}
            isTogglingFavorite={isTogglingFavorite}
            key={product.id}
            onSelect={() => onProductSelect(product)}
            onToggleFavorite={onToggleFavorite}
            product={product}
            quantity={getProductQuantity(product.id)}
          />
        ))}
      </div>
    );
  } else {
    productContent = (
      <div className="flex flex-col gap-2 pb-4 md:gap-3">
        {regularProducts.map((product) => (
          <ProductListItem
            isActiveShift={isActiveShift}
            isOutOfStock={product.trackInventory && product.stock <= 0}
            isTogglingFavorite={isTogglingFavorite}
            key={product.id}
            onSelect={() => onProductSelect(product)}
            onToggleFavorite={onToggleFavorite}
            product={product}
            quantity={getProductQuantity(product.id)}
          />
        ))}
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <CatalogToolbar
        activeCategoryId={activeCategoryId}
        categories={categories}
        onCategoryChange={onCategoryChange}
        onClearSearch={onClearSearch}
        onSearchChange={onSearchChange}
        onViewModeChange={onViewModeChange}
        searchQuery={searchQuery}
        viewMode={viewMode}
      />

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3 md:px-6">
        {productContent}

        {hasMore && (
          <div
            className="flex h-16 items-center justify-center text-[#6b6b6b]"
            ref={loadMoreRef}
          >
            {isLoadingMore ? <p className="text-sm">Cargando más…</p> : null}
          </div>
        )}
      </div>
    </div>
  );
}
