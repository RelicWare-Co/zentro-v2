import { Search, X } from "lucide-react";
import { useCallback, useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";

import { cn } from "@/lib/utils";
import type { Category, Product } from "../types";
import { CategoryTabs } from "./category-tabs";
import { ProductCard } from "./product-card";

const SCANNER_MIN_LENGTH = 6;
const SCANNER_MAX_AVERAGE_INTERVAL_MS = 45;
const SCANNER_IDLE_DELAY_MS = 90;

interface ProductGridProps {
  activeCategoryId: string;
  categories: Category[];
  className?: string;
  getProductQuantity: (productId: string) => number;
  hasMore?: boolean;
  isActiveShift: boolean;
  isLoading: boolean;
  isLoadingMore?: boolean;
  isTogglingFavorite?: boolean;
  onBarcodeScan: (value: string) => Promise<boolean> | boolean;
  onCategoryChange: (categoryId: string) => void;
  onClearSearch: () => void;
  onLoadMore?: () => void;
  onProductSelect: (product: Product) => void;
  onSearchChange: (query: string) => void;
  onToggleFavorite?: (productId: string) => void;
  products: Product[];
  searchQuery: string;
  shouldAutoFocusSearch: boolean;
}

function shouldIgnoreKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
  return (
    event.ctrlKey ||
    event.metaKey ||
    event.altKey ||
    event.nativeEvent.isComposing
  );
}

function isDeletionKey(key: string) {
  return key === "Backspace" || key === "Delete";
}

function tryHandleEscape(
  event: React.KeyboardEvent<HTMLInputElement>,
  searchQuery: string,
  resetScannerMetrics: () => void,
  onClearSearch: () => void
) {
  if (event.key === "Escape" && searchQuery.trim().length > 0) {
    event.preventDefault();
    resetScannerMetrics();
    onClearSearch();
    return true;
  }
  return false;
}

function tryHandleEnter(
  event: React.KeyboardEvent<HTMLInputElement>,
  metricsRef: React.RefObject<{
    startedAt: number;
    lastAt: number;
    keyCount: number;
  }>,
  submitScannerValue: (value: string) => Promise<void> | void,
  submitSingleVisibleProduct: (value: string) => boolean
) {
  if (event.key !== "Enter") {
    return false;
  }
  const currentValue = event.currentTarget.value;
  if (looksLikeScannerInput(metricsRef.current, currentValue)) {
    event.preventDefault();
    submitScannerValue(currentValue);
    return true;
  }
  if (submitSingleVisibleProduct(currentValue)) {
    event.preventDefault();
  }
  return true;
}

function tryHandleTab(
  event: React.KeyboardEvent<HTMLInputElement>,
  metricsRef: React.RefObject<{
    startedAt: number;
    lastAt: number;
    keyCount: number;
  }>,
  submitScannerValue: (value: string) => Promise<void> | void
) {
  if (event.key !== "Tab") {
    return false;
  }
  if (looksLikeScannerInput(metricsRef.current, event.currentTarget.value)) {
    event.preventDefault();
    submitScannerValue(event.currentTarget.value);
  }
  return true;
}

function updateScanMetrics(
  metricsRef: React.RefObject<{
    startedAt: number;
    lastAt: number;
    keyCount: number;
  }>
) {
  const now = performance.now();
  const previousTimestamp = metricsRef.current.lastAt;
  const isNewSequence =
    previousTimestamp === 0 || now - previousTimestamp > SCANNER_IDLE_DELAY_MS;

  metricsRef.current = {
    startedAt: isNewSequence ? now : metricsRef.current.startedAt,
    lastAt: now,
    keyCount: isNewSequence ? 1 : metricsRef.current.keyCount + 1,
  };
}

function shouldScheduleScanner(
  value: string,
  metricsRef: React.RefObject<{
    startedAt: number;
    lastAt: number;
    keyCount: number;
  }>
) {
  return (
    value.trim().length >= SCANNER_MIN_LENGTH &&
    looksLikeScannerInput(metricsRef.current, value)
  );
}

export function ProductGrid({
  categories,
  activeCategoryId,
  searchQuery,
  products,
  isLoading,
  isActiveShift,
  shouldAutoFocusSearch,
  getProductQuantity,
  onCategoryChange,
  onSearchChange,
  onClearSearch,
  onBarcodeScan,
  onProductSelect,
  onToggleFavorite,
  isTogglingFavorite,
  onLoadMore,
  hasMore,
  isLoadingMore,
  className,
}: ProductGridProps) {
  const regularProducts = products.filter((product) => !product.isModifier);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const scanMetricsRef = useRef({
    startedAt: 0,
    lastAt: 0,
    keyCount: 0,
  });
  const scanTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const resetScannerMetrics = useCallback(() => {
    scanMetricsRef.current = {
      startedAt: 0,
      lastAt: 0,
      keyCount: 0,
    };
    if (scanTimeoutRef.current) {
      clearTimeout(scanTimeoutRef.current);
      scanTimeoutRef.current = null;
    }
  }, []);

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

  const focusSearchInput = useCallback(() => {
    if (
      !shouldAutoFocusSearch ||
      typeof document === "undefined" ||
      hasBlockingLayer()
    ) {
      return;
    }

    const input = searchInputRef.current;
    if (!input) {
      return;
    }

    const activeElement = document.activeElement;
    if (activeElement === input || isEditableElement(activeElement)) {
      return;
    }

    input.focus({ preventScroll: true });
    if (input.value.length > 0) {
      input.select();
    }
  }, [shouldAutoFocusSearch]);

  const submitScannerValue = useCallback(
    async (rawValue: string) => {
      const value = rawValue.trim();
      if (!(value && looksLikeScannerInput(scanMetricsRef.current, value))) {
        return;
      }

      resetScannerMetrics();
      await onBarcodeScan(value);
    },
    [onBarcodeScan, resetScannerMetrics]
  );

  const submitSingleVisibleProduct = useCallback(
    (rawValue: string) => {
      if (
        isLoading ||
        rawValue.trim().length === 0 ||
        regularProducts.length !== 1
      ) {
        return false;
      }

      resetScannerMetrics();
      onProductSelect(regularProducts[0]);
      if (isActiveShift) {
        onClearSearch();
      }
      return true;
    },
    [
      isActiveShift,
      isLoading,
      onClearSearch,
      onProductSelect,
      regularProducts,
      resetScannerMetrics,
    ]
  );

  const scheduleScannerAttempt = useCallback(
    (value: string) => {
      if (scanTimeoutRef.current) {
        clearTimeout(scanTimeoutRef.current);
      }

      scanTimeoutRef.current = setTimeout(() => {
        submitScannerValue(value);
      }, SCANNER_IDLE_DELAY_MS);
    },
    [submitScannerValue]
  );

  useEffect(() => {
    if (!shouldAutoFocusSearch) {
      return;
    }

    const rafId = window.requestAnimationFrame(() => {
      focusSearchInput();
    });

    const handleFocusIn = (event: FocusEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) {
        return;
      }
      if (target === searchInputRef.current) {
        return;
      }
      if (isEditableElement(target) || hasBlockingLayer()) {
        return;
      }

      window.requestAnimationFrame(() => {
        focusSearchInput();
      });
    };

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) {
        return;
      }
      if (
        target === searchInputRef.current ||
        isEditableElement(target) ||
        target.closest("[data-search-clear-button]") ||
        hasBlockingLayer()
      ) {
        return;
      }

      window.requestAnimationFrame(() => {
        focusSearchInput();
      });
    };

    const handleWindowFocus = () => {
      window.requestAnimationFrame(() => {
        focusSearchInput();
      });
    };

    document.addEventListener("focusin", handleFocusIn);
    document.addEventListener("pointerdown", handlePointerDown, true);
    window.addEventListener("focus", handleWindowFocus);

    return () => {
      window.cancelAnimationFrame(rafId);
      document.removeEventListener("focusin", handleFocusIn);
      document.removeEventListener("pointerdown", handlePointerDown, true);
      window.removeEventListener("focus", handleWindowFocus);
    };
  }, [focusSearchInput, shouldAutoFocusSearch]);

  useEffect(
    () => () => {
      resetScannerMetrics();
    },
    [resetScannerMetrics]
  );

  const handleSearchChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const nextValue = event.target.value;
      onSearchChange(nextValue);
      if (nextValue.trim().length === 0) {
        resetScannerMetrics();
        return;
      }
      if (shouldScheduleScanner(nextValue, scanMetricsRef)) {
        scheduleScannerAttempt(nextValue);
        return;
      }
      if (scanTimeoutRef.current) {
        clearTimeout(scanTimeoutRef.current);
        scanTimeoutRef.current = null;
      }
    },
    [onSearchChange, resetScannerMetrics, scheduleScannerAttempt]
  );

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (
        tryHandleEscape(event, searchQuery, resetScannerMetrics, onClearSearch)
      ) {
        return;
      }
      if (shouldIgnoreKeyDown(event)) {
        return;
      }
      if (
        tryHandleEnter(
          event,
          scanMetricsRef,
          submitScannerValue,
          submitSingleVisibleProduct
        )
      ) {
        return;
      }
      if (tryHandleTab(event, scanMetricsRef, submitScannerValue)) {
        return;
      }
      if (isDeletionKey(event.key)) {
        resetScannerMetrics();
        return;
      }
      if (event.key.length !== 1) {
        return;
      }
      updateScanMetrics(scanMetricsRef);
    },
    [
      searchQuery,
      resetScannerMetrics,
      onClearSearch,
      submitScannerValue,
      submitSingleVisibleProduct,
    ]
  );

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
              value={searchQuery}
            />
            {searchQuery.trim().length > 0 ? (
              <button
                aria-label="Limpiar búsqueda"
                className="absolute top-1/2 right-2 inline-flex size-7 -translate-y-1/2 items-center justify-center rounded-md text-zinc-500 transition-colors hover:bg-white/5 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-voltage)]"
                data-search-clear-button
                onClick={() => {
                  resetScannerMetrics();
                  onClearSearch();
                  searchInputRef.current?.focus({ preventScroll: true });
                }}
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
          activeCategoryId={activeCategoryId}
          categories={categories}
          onCategoryChange={onCategoryChange}
        />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto bg-[#0a0a0a] p-4">
        <div className="h-fit space-y-6 pb-24 md:pb-6">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 [&>*]:h-fit">
            {regularProducts.map((product) => {
              const qty = getProductQuantity(product.id);
              const isOutOfStock = product.trackInventory && product.stock <= 0;

              return (
                <ProductCard
                  isActiveShift={isActiveShift}
                  isOutOfStock={isOutOfStock}
                  isTogglingFavorite={isTogglingFavorite}
                  key={product.id}
                  onSelect={() => onProductSelect(product)}
                  onToggleFavorite={onToggleFavorite}
                  product={product}
                  quantity={qty}
                />
              );
            })}
          </div>

          {isLoading && (
            <div className="flex h-16 flex-col items-center justify-center text-zinc-500">
              <p>Cargando productos…</p>
            </div>
          )}

          {!isLoading && regularProducts.length === 0 && (
            <div className="flex h-48 flex-col items-center justify-center text-zinc-500">
              <p>No se encontraron productos.</p>
            </div>
          )}

          {hasMore && (
            <div
              className="flex h-16 items-center justify-center text-zinc-500"
              ref={loadMoreRef}
            >
              {isLoadingMore ? <p>Cargando más…</p> : null}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function hasBlockingLayer() {
  if (typeof document === "undefined") {
    return false;
  }

  return Boolean(
    document.querySelector(
      [
        "[data-slot='dialog-content']",
        "[data-slot='drawer-content']",
        "[data-slot='popover-content']",
        "[data-slot='alert-dialog-content']",
      ].join(", ")
    )
  );
}

function isEditableElement(target: EventTarget | null) {
  if (!(target instanceof Element)) {
    return false;
  }

  return Boolean(
    target.closest(
      [
        "input",
        "textarea",
        "select",
        "[contenteditable='true']",
        "[role='textbox']",
        "[data-slot='input']",
        "[cmdk-input]",
      ].join(", ")
    )
  );
}

function looksLikeScannerInput(
  metrics: { startedAt: number; lastAt: number; keyCount: number },
  value: string
) {
  const trimmedValue = value.trim();
  if (
    trimmedValue.length < SCANNER_MIN_LENGTH ||
    metrics.keyCount < SCANNER_MIN_LENGTH ||
    metrics.startedAt === 0 ||
    metrics.lastAt === 0
  ) {
    return false;
  }

  const elapsed = metrics.lastAt - metrics.startedAt;
  const averageInterval =
    metrics.keyCount > 1 ? elapsed / (metrics.keyCount - 1) : elapsed;

  return averageInterval <= SCANNER_MAX_AVERAGE_INTERVAL_MS;
}
