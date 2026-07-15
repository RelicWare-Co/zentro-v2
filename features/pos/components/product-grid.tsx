import { TextInput } from "@mantine/core";
import { LayoutGrid, List, Search, X } from "lucide-react";
import { useEffect, useId, useRef } from "react";
import { CategoryTabs } from "@/features/pos/components/category-tabs";
import { ProductGridCard } from "@/features/pos/components/product-grid-card";
import { ProductListItem } from "@/features/pos/components/product-list-item";
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

  const searchInputId = useId();
  const { clearSearch, handleKeyDown, handleSearchChange, searchInputRef } =
    usePosBarcodeScanner({
      isActiveShift: state.isActiveShift,
      isLoading,
      onBarcodeScan: actions.handleBarcodeScan,
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
      <div className="shrink-0 space-y-4 border-zinc-800/50 p-4">
        <div className="flex items-center gap-4">
          <TextInput
            className="max-w-md flex-1"
            classNames={{
              input:
                "h-10 rounded-lg border-zinc-800! bg-black/40! text-white! placeholder:text-zinc-600! focus-visible:border-[var(--color-voltage)]!",
            }}
            id={searchInputId}
            leftSection={<Search className="size-4 text-zinc-500" />}
            onChange={handleSearchChange}
            onKeyDown={handleKeyDown}
            placeholder="Buscar productos, código de barras..."
            ref={searchInputRef}
            rightSection={
              state.searchQuery.trim().length > 0 ? (
                <button
                  aria-label="Limpiar búsqueda"
                  className="inline-flex size-7 items-center justify-center rounded-md text-zinc-500 transition-colors hover:bg-white/5 hover:text-white"
                  data-search-clear-button
                  onClick={clearSearch}
                  onMouseDown={(event) => {
                    event.preventDefault();
                  }}
                  type="button"
                >
                  <X className="size-4" />
                </button>
              ) : null
            }
            value={state.searchQuery}
          />
        </div>

        <div className="flex items-center gap-2">
          <div className="min-w-0 flex-1">
            <CategoryTabs
              activeCategoryId={state.activeCategoryId}
              categories={state.categories}
              onCategoryChange={actions.setActiveCategoryId}
            />
          </div>
          <div className="flex shrink-0 items-center overflow-hidden rounded-xl border border-zinc-800">
            <button
              className={cn(
                "flex items-center gap-2 px-3 py-2 font-medium text-sm transition-all",
                state.viewMode === "grid"
                  ? "bg-[var(--color-voltage)] text-black"
                  : "text-zinc-500 hover:text-white"
              )}
              onClick={() => actions.setViewMode("grid")}
              type="button"
            >
              <LayoutGrid className="size-4" />
              <span className="hidden sm:inline">Cuadrícula</span>
            </button>
            <button
              className={cn(
                "flex items-center gap-2 border-zinc-800 border-l px-3 py-2 font-medium text-sm transition-all",
                state.viewMode === "list"
                  ? "bg-[var(--color-voltage)] text-black"
                  : "text-zinc-500 hover:text-white"
              )}
              onClick={() => actions.setViewMode("list")}
              type="button"
            >
              <List className="size-4" />
              <span className="hidden sm:inline">Lista</span>
            </button>
          </div>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto border-zinc-800/50 border-t p-4">
        <div className="h-fit space-y-6 pb-24 md:pb-6">
          {state.viewMode === "grid" ? (
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 [&>*]:h-fit">
              {regularProducts.map((product) => (
                <ProductGridCard
                  key={product.id}
                  onSelect={() => actions.handleProductSelect(product)}
                  product={product}
                  quantity={actions.getProductQuantity(product.id)}
                />
              ))}
            </div>
          ) : (
            <div className="flex flex-col gap-2 md:gap-3">
              {regularProducts.map((product) => (
                <ProductListItem
                  key={product.id}
                  onSelect={() => actions.handleProductSelect(product)}
                  product={product}
                  quantity={actions.getProductQuantity(product.id)}
                />
              ))}
            </div>
          )}

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
