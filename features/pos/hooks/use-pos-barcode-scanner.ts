import { useCallback, useEffect, useRef } from "react";
import type { Product } from "@/features/pos/types";

const SCANNER_MIN_LENGTH = 6;
const SCANNER_MAX_AVERAGE_INTERVAL_MS = 45;
const SCANNER_IDLE_DELAY_MS = 90;

interface ScanMetrics {
  keyCount: number;
  lastAt: number;
  startedAt: number;
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

function looksLikeScannerInput(metrics: ScanMetrics, value: string) {
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

function updateScanMetrics(metricsRef: React.RefObject<ScanMetrics>) {
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
  metricsRef: React.RefObject<ScanMetrics>
) {
  return (
    value.trim().length >= SCANNER_MIN_LENGTH &&
    looksLikeScannerInput(metricsRef.current, value)
  );
}

function handleScannerEnterKey(
  event: React.KeyboardEvent<HTMLInputElement>,
  scanMetricsRef: React.RefObject<ScanMetrics>,
  submitScannerValue: (value: string) => void,
  submitSingleVisibleProduct: (value: string) => boolean
) {
  const currentValue = event.currentTarget.value;
  if (looksLikeScannerInput(scanMetricsRef.current, currentValue)) {
    event.preventDefault();
    submitScannerValue(currentValue);
    return;
  }
  if (submitSingleVisibleProduct(currentValue)) {
    event.preventDefault();
  }
}

function handleScannerTabKey(
  event: React.KeyboardEvent<HTMLInputElement>,
  scanMetricsRef: React.RefObject<ScanMetrics>,
  submitScannerValue: (value: string) => void
) {
  if (
    looksLikeScannerInput(scanMetricsRef.current, event.currentTarget.value)
  ) {
    event.preventDefault();
    submitScannerValue(event.currentTarget.value);
  }
}

export function usePosBarcodeScanner({
  isActiveShift,
  isLoading,
  onBarcodeScan,
  onClearSearch,
  onProductSelect,
  onSearchChange,
  products,
  searchQuery,
  shouldAutoFocusSearch,
}: {
  isActiveShift: boolean;
  isLoading: boolean;
  onBarcodeScan: (value: string) => Promise<boolean> | boolean;
  onClearSearch: () => void;
  onProductSelect: (product: Product) => void;
  onSearchChange: (query: string) => void;
  products: Product[];
  searchQuery: string;
  shouldAutoFocusSearch: boolean;
}) {
  const regularProducts = products.filter((product) => !product.isModifier);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const scanMetricsRef = useRef<ScanMetrics>({
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
      if (event.key === "Escape" && searchQuery.trim().length > 0) {
        event.preventDefault();
        resetScannerMetrics();
        onClearSearch();
        return;
      }
      if (shouldIgnoreKeyDown(event)) {
        return;
      }
      if (event.key === "Enter") {
        handleScannerEnterKey(
          event,
          scanMetricsRef,
          submitScannerValue,
          submitSingleVisibleProduct
        );
        return;
      }
      if (event.key === "Tab") {
        handleScannerTabKey(event, scanMetricsRef, submitScannerValue);
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

  const clearSearch = useCallback(() => {
    resetScannerMetrics();
    onClearSearch();
    searchInputRef.current?.focus({ preventScroll: true });
  }, [onClearSearch, resetScannerMetrics]);

  return {
    clearSearch,
    handleKeyDown,
    handleSearchChange,
    searchInputRef,
  };
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
