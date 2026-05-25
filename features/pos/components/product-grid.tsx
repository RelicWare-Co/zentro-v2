import { Search, X } from "lucide-react";
import { useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { CategoryTabs } from "@/features/pos/components/category-tabs";
import { ProductCard } from "@/features/pos/components/product-card";
import { usePosBarcodeScanner } from "@/features/pos/hooks/use-pos-barcode-scanner";
import { usePosPage } from "@/features/pos/pos-page-context";
import { cn } from "@/lib/utils";

export function ProductGrid({
  className,
  shouldAutoFocusSearch,
}: {
  className?: string;
  shouldAutoFocusSearch: boolean;
}) {
  const { state, actions } = usePosPage();
  const regularProducts = state.products.filter(
    (product) => !product.isModifier
  );
  const isLoading =
    state.isBootstrapLoading ||
    state.isActiveShiftLoading ||
    state.isProductsLoading;
  const loadMoreRef = useRef<HTMLDivElement | null>(null);

  const { clearSearch, handleKeyDown, handleSearchChange, searchInputRef } =
    usePosBarcodeScanner({
      isActiveShift: state.isActiveShift,
      isLoading,
      onBarcodeScan: actions.handleBarcodeScanV1,
      onClearSearch: () => actions.setSearchQuery(""),
      onProductSelect: actions.handleProductSelect,
      onSearchChange: actions.setSearchQuery,
      products: state.products,
      searchQuery: state.searchQuery,
      shouldAutoFocusSearch,
    });

  useEffect(() => {
    if (!state.hasNextPage) {
      return;
    }
    const element = loadMoreRef.current;
    if (!element) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          actions.fetchNextProductsPage();
        }
      },
      { rootMargin: "200px" }
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [actions.fetchNextProductsPage, state.hasNextPage]);

  return (
    <div
      className={cn(
        "flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden border-zinc-800 border-r",
        className
      )}
    >
      <div className="shrink-0 space-y-4 border-zinc-800/50 border-b bg-[#0a0a0a] p-4">
        <div className="flex items-center gap-4">
          <div className="relative max-w-md flex-1">
            <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-zinc-500" />
            <Input
              className="h-10 rounded-lg border-zinc-800 bg-black/40 pr-10 pl-9 text-white transition-all placeholder:text-zinc-600 focus-visible:border-[var(--color-voltage)] focus-visible:ring-1 focus-visible:ring-[var(--color-voltage)]"
              onChange={handleSearchChange}
              onKeyDown={handleKeyDown}
              placeholder="Buscar productos, código de barras..."
              ref={searchInputRef}
              value={state.searchQuery}
            />
            {state.searchQuery.trim().length > 0 ? (
              <button
                aria-label="Limpiar búsqueda"
                className="absolute top-1/2 right-2 inline-flex size-7 -translate-y-1/2 items-center justify-center rounded-md text-zinc-500 transition-colors hover:bg-white/5 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-voltage)]"
                data-search-clear-button
                onClick={clearSearch}
                onMouseDown={(event) => {
                  event.preventDefault();
                }}
                type="button"
              >
                <X className="size-4" />
              </button>
            ) : null}
          </div>
        </div>

        <CategoryTabs
          activeCategoryId={state.activeCategoryId}
          categories={state.categories}
          onCategoryChange={actions.setActiveCategoryId}
        />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto bg-[#0a0a0a] p-4">
        <div className="h-fit space-y-6 pb-24 md:pb-6">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 [&>*]:h-fit">
            {regularProducts.map((product) => (
              <ProductCard
                key={product.id}
                onSelect={() => actions.handleProductSelect(product)}
                product={product}
                quantity={actions.getProductQuantity(product.id)}
              />
            ))}
          </div>

          {isLoading ? (
            <div className="flex h-16 flex-col items-center justify-center text-zinc-500">
              <p>Cargando productos…</p>
            </div>
          ) : null}

          {!isLoading && regularProducts.length === 0 ? (
            <div className="flex h-48 flex-col items-center justify-center text-zinc-500">
              <p>No se encontraron productos.</p>
            </div>
          ) : null}

          {state.hasNextPage ? (
            <div
              className="flex h-16 items-center justify-center text-zinc-500"
              ref={loadMoreRef}
            >
              {state.isFetchingNextPage ? <p>Cargando más…</p> : null}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
