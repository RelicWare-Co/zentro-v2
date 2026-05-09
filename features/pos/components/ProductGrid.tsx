import { Search, X } from "lucide-react";
import { useCallback, useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";

import { cn } from "@/lib/utils";
import type { Category, Product } from "../types";
import { CategoryTabs } from "./CategoryTabs";
import { ProductCard } from "./ProductCard";

const SCANNER_MIN_LENGTH = 6;
const SCANNER_MAX_AVERAGE_INTERVAL_MS = 45;
const SCANNER_IDLE_DELAY_MS = 90;

interface ProductGridProps {
	categories: Category[];
	activeCategoryId: string;
	searchQuery: string;
	products: Product[];
	isLoading: boolean;
	isActiveShift: boolean;
	shouldAutoFocusSearch: boolean;
	getProductQuantity: (productId: string) => number;
	onCategoryChange: (categoryId: string) => void;
	onSearchChange: (query: string) => void;
	onClearSearch: () => void;
	onBarcodeScan: (value: string) => Promise<boolean> | boolean;
	onProductSelect: (product: Product) => void;
	onToggleFavorite?: (productId: string) => void;
	isTogglingFavorite?: boolean;
	className?: string;
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
			if (!value || !looksLikeScannerInput(scanMetricsRef.current, value)) {
				return;
			}

			resetScannerMetrics();
			await onBarcodeScan(value);
		},
		[onBarcodeScan, resetScannerMetrics],
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
		],
	);

	const scheduleScannerAttempt = useCallback(
		(value: string) => {
			if (scanTimeoutRef.current) {
				clearTimeout(scanTimeoutRef.current);
			}

			scanTimeoutRef.current = setTimeout(() => {
				void submitScannerValue(value);
			}, SCANNER_IDLE_DELAY_MS);
		},
		[submitScannerValue],
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

	useEffect(() => {
		return () => {
			resetScannerMetrics();
		};
	}, [resetScannerMetrics]);

	return (
		<div
			className={cn(
				"flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden border-r border-gray-800",
				className,
			)}
		>
			<div className="p-4 space-y-4 shrink-0 border-b border-gray-800/50 bg-[#0a0a0a]">
				<div className="flex items-center gap-4">
					<div className="relative flex-1 max-w-md">
						<Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
						<Input
							ref={searchInputRef}
							placeholder="Buscar productos, código de barras..."
							value={searchQuery}
							onChange={(event) => {
								const nextValue = event.target.value;
								onSearchChange(nextValue);
								if (nextValue.trim().length === 0) {
									resetScannerMetrics();
									return;
								}

								if (
									nextValue.trim().length >= SCANNER_MIN_LENGTH &&
									looksLikeScannerInput(scanMetricsRef.current, nextValue)
								) {
									scheduleScannerAttempt(nextValue);
									return;
								}

								if (scanTimeoutRef.current) {
									clearTimeout(scanTimeoutRef.current);
									scanTimeoutRef.current = null;
								}
							}}
							onKeyDown={(event) => {
								if (event.key === "Escape" && searchQuery.trim().length > 0) {
									event.preventDefault();
									resetScannerMetrics();
									onClearSearch();
									return;
								}

								if (
									event.ctrlKey ||
									event.metaKey ||
									event.altKey ||
									event.nativeEvent.isComposing
								) {
									return;
								}

								if (event.key === "Enter") {
									const currentValue = event.currentTarget.value;
									if (
										looksLikeScannerInput(scanMetricsRef.current, currentValue)
									) {
										event.preventDefault();
										void submitScannerValue(currentValue);
										return;
									}

									if (submitSingleVisibleProduct(currentValue)) {
										event.preventDefault();
									}
									return;
								}

								if (event.key === "Tab") {
									if (
										looksLikeScannerInput(
											scanMetricsRef.current,
											event.currentTarget.value,
										)
									) {
										event.preventDefault();
										void submitScannerValue(event.currentTarget.value);
									}
									return;
								}

								if (event.key === "Backspace" || event.key === "Delete") {
									resetScannerMetrics();
									return;
								}

								if (event.key.length !== 1) {
									return;
								}

								const now = performance.now();
								const previousTimestamp = scanMetricsRef.current.lastAt;
								const isNewSequence =
									previousTimestamp === 0 ||
									now - previousTimestamp > SCANNER_IDLE_DELAY_MS;

								scanMetricsRef.current = {
									startedAt: isNewSequence
										? now
										: scanMetricsRef.current.startedAt,
									lastAt: now,
									keyCount: isNewSequence
										? 1
										: scanMetricsRef.current.keyCount + 1,
								};
							}}
							className="h-10 rounded-lg border-gray-800 bg-black/40 pl-9 pr-10 text-white placeholder:text-gray-600 transition-all focus-visible:border-[var(--color-voltage)] focus-visible:ring-1 focus-visible:ring-[var(--color-voltage)]"
						/>
						{searchQuery.trim().length > 0 ? (
							<button
								type="button"
								data-search-clear-button
								aria-label="Limpiar búsqueda"
								onMouseDown={(event) => {
									event.preventDefault();
								}}
								onClick={() => {
									resetScannerMetrics();
									onClearSearch();
									searchInputRef.current?.focus({ preventScroll: true });
								}}
								className="absolute right-2 top-1/2 inline-flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-gray-500 transition-colors hover:bg-white/5 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-voltage)]"
							>
								<X className="h-4 w-4" />
							</button>
						) : null}
					</div>
				</div>

				<CategoryTabs
					categories={categories}
					activeCategoryId={activeCategoryId}
					onCategoryChange={onCategoryChange}
				/>
			</div>

			<div className="flex-1 min-h-0 overflow-y-auto bg-[#0a0a0a] p-4">
				<div className="space-y-6 pb-24 md:pb-6 h-fit">
					<div className="grid grid-cols-2 gap-3 [&>*]:h-fit md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
						{regularProducts.map((product) => {
							const qty = getProductQuantity(product.id);
							const isOutOfStock = product.trackInventory && product.stock <= 0;

							return (
								<ProductCard
									key={product.id}
									product={product}
									quantity={qty}
									isOutOfStock={isOutOfStock}
									isActiveShift={isActiveShift}
									onSelect={() => onProductSelect(product)}
									onToggleFavorite={onToggleFavorite}
									isTogglingFavorite={isTogglingFavorite}
								/>
							);
						})}
					</div>

					{isLoading && (
						<div className="flex h-16 flex-col items-center justify-center text-gray-500">
							<p>Cargando productos...</p>
						</div>
					)}

					{!isLoading && regularProducts.length === 0 && (
						<div className="flex h-48 flex-col items-center justify-center text-gray-500">
							<p>No se encontraron productos.</p>
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
			].join(", "),
		),
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
			].join(", "),
		),
	);
}

function looksLikeScannerInput(
	metrics: { startedAt: number; lastAt: number; keyCount: number },
	value: string,
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
