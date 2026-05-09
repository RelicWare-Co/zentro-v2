import { useCallback, useEffect, useRef } from "react";
import { Barcode, LayoutGrid, List, Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { Category } from "@/features/pos/types";

interface CatalogToolbarProps {
  categories: Category[];
  activeCategoryId: string;
  searchQuery: string;
  viewMode: "grid" | "list";
  onCategoryChange: (id: string) => void;
  onSearchChange: (query: string) => void;
  onClearSearch: () => void;
  onViewModeChange: (mode: "grid" | "list") => void;
}

export function CatalogToolbar({
  categories,
  activeCategoryId,
  searchQuery,
  viewMode,
  onCategoryChange,
  onSearchChange,
  onClearSearch,
  onViewModeChange,
}: CatalogToolbarProps) {
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "/" && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const target = e.target as HTMLElement;
        if (
          target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable
        ) {
          return;
        }
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  const allCategories = [{ id: "all", name: "Todos" }, ...categories];

  return (
    <div className="shrink-0 px-4 md:px-6 space-y-3 pb-2">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--color-muted-foreground)]" />
        <Input
          ref={searchInputRef}
          placeholder="Buscar producto por nombre, SKU o código... (/)"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="h-11 md:h-12 rounded-xl border-[var(--color-border)] bg-[var(--color-background)] pl-10 pr-10 text-sm text-[var(--color-foreground)] placeholder:text-[var(--color-muted-foreground)] focus-visible:border-[var(--color-voltage)] focus-visible:ring-1 focus-visible:ring-[var(--color-voltage)]/30"
        />
        {searchQuery ? (
          <button
            type="button"
            onClick={() => {
              onClearSearch();
              searchInputRef.current?.focus();
            }}
            className="absolute right-10 top-1/2 -translate-y-1/2 inline-flex h-7 w-7 items-center justify-center rounded-md text-[var(--color-muted-foreground)] transition-colors hover:bg-[var(--color-muted)] hover:text-[var(--color-foreground)]"
          >
            <X className="h-4 w-4" />
          </button>
        ) : null}
        <button
          type="button"
          className="absolute right-2.5 top-1/2 -translate-y-1/2 inline-flex h-7 w-7 items-center justify-center rounded-md text-[var(--color-muted-foreground)]"
        >
          <Barcode className="h-4 w-4" />
        </button>
      </div>

      {/* Categories + View Toggle */}
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
          {allCategories.map((cat) => {
            const isActive = activeCategoryId === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => onCategoryChange(cat.id)}
                className={cn(
                  "shrink-0 rounded-full px-3.5 py-1.5 text-xs md:text-sm font-medium transition-all border",
                  isActive
                    ? "bg-black text-white border-black dark:bg-[var(--color-voltage)] dark:text-black dark:border-[var(--color-voltage)]"
                    : "bg-transparent text-[var(--color-muted-foreground)] border-[var(--color-border)] hover:text-[var(--color-foreground)] hover:border-[var(--color-foreground)]/40"
                )}
              >
                {cat.name}
              </button>
            );
          })}
        </div>

        <div className="ml-auto flex items-center rounded-lg border border-[var(--color-border)] overflow-hidden shrink-0">
          <button
            onClick={() => onViewModeChange("grid")}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-all",
              viewMode === "grid"
                ? "bg-black text-white dark:bg-[var(--color-voltage)] dark:text-black"
                : "text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]"
            )}
          >
            <LayoutGrid className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Cuadrícula</span>
          </button>
          <button
            onClick={() => onViewModeChange("list")}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-all border-l border-[var(--color-border)]",
              viewMode === "list"
                ? "bg-black text-white dark:bg-[var(--color-voltage)] dark:text-black"
                : "text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]"
            )}
          >
            <List className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Lista</span>
          </button>
        </div>
      </div>
    </div>
  );
}
