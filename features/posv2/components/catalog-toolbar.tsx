import { Barcode, LayoutGrid, List, Search, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import type { Category } from "@/features/pos/types";
import { cn } from "@/lib/utils";

interface CatalogToolbarProps {
  activeCategoryId: string;
  categories: Category[];
  onCategoryChange: (id: string) => void;
  onClearSearch: () => void;
  onSearchChange: (query: string) => void;
  onViewModeChange: (mode: "grid" | "list") => void;
  searchQuery: string;
  viewMode: "grid" | "list";
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
  const scrollRef = useRef<HTMLDivElement>(null);
  const [hasOverflow, setHasOverflow] = useState(false);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) {
      return;
    }

    const check = () => {
      setHasOverflow(el.scrollWidth > el.clientWidth);
    };

    check();

    const ro = new ResizeObserver(check);
    ro.observe(el);
    window.addEventListener("resize", check);

    return () => {
      ro.disconnect();
      window.removeEventListener("resize", check);
    };
  }, []);

  const handleWheel = useCallback((e: React.WheelEvent<HTMLDivElement>) => {
    const el = scrollRef.current;
    if (!el) {
      return;
    }
    if (el.scrollWidth <= el.clientWidth) {
      return;
    }
    if (Math.abs(e.deltaY) < Math.abs(e.deltaX)) {
      return;
    }

    e.preventDefault();
    el.scrollLeft += e.deltaY;
  }, []);

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

  const maskStyle: React.CSSProperties = hasOverflow
    ? {
        maskImage:
          "linear-gradient(to right, black calc(100% - 48px), transparent 100%)",
        WebkitMaskImage:
          "linear-gradient(to right, black calc(100% - 48px), transparent 100%)",
      }
    : {};

  return (
    <div className="shrink-0 space-y-3 px-4 pb-2 md:px-6">
      {/* Search */}
      <div className="relative">
        <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-[#6b6b6b]" />
        <Input
          className="h-11 rounded-xl border-[rgba(255,255,255,0.08)] bg-[#111111] pr-10 pl-10 text-sm text-white placeholder:text-[#6b6b6b] focus-visible:border-[#dfff06]/30 focus-visible:ring-1 focus-visible:ring-[#dfff06]/20 md:h-12"
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Buscar producto por nombre, SKU o código... (/)"
          ref={searchInputRef}
          value={searchQuery}
        />
        {searchQuery ? (
          <button
            className="absolute top-1/2 right-10 inline-flex size-7 -translate-y-1/2 items-center justify-center rounded-md text-[#6b6b6b] transition-colors hover:bg-[rgba(255,255,255,0.06)] hover:text-white"
            onClick={() => {
              onClearSearch();
              searchInputRef.current?.focus();
            }}
            type="button"
          >
            <X className="size-4" />
          </button>
        ) : null}
        <button
          className="absolute top-1/2 right-2.5 inline-flex size-7 -translate-y-1/2 items-center justify-center rounded-md text-[#6b6b6b]"
          type="button"
        >
          <Barcode className="size-4" />
        </button>
      </div>

      {/* Categories + View Toggle */}
      <div className="flex items-center gap-2">
        <div
          className="no-scrollbar flex items-center gap-1.5 overflow-x-auto"
          onWheel={handleWheel}
          ref={scrollRef}
          style={maskStyle}
        >
          {allCategories.map((cat) => {
            const isActive = activeCategoryId === cat.id;
            return (
              <button
                className={cn(
                  "shrink-0 rounded-full border px-3.5 py-1.5 font-medium text-xs transition-all md:text-sm",
                  isActive
                    ? "border-[#dfff06] bg-[#dfff06] text-black"
                    : "border-[rgba(255,255,255,0.12)] bg-transparent text-[#6b6b6b] hover:border-[rgba(255,255,255,0.25)] hover:text-white"
                )}
                key={cat.id}
                onClick={() => onCategoryChange(cat.id)}
              >
                {cat.name}
              </button>
            );
          })}
        </div>

        <div className="ml-auto flex shrink-0 items-center overflow-hidden rounded-xl border border-[rgba(255,255,255,0.12)]">
          <button
            className={cn(
              "flex items-center gap-2 px-4 py-2 font-medium text-sm transition-all",
              viewMode === "grid"
                ? "bg-[#dfff06] text-black"
                : "text-[#6b6b6b] hover:text-white"
            )}
            onClick={() => onViewModeChange("grid")}
          >
            <LayoutGrid className="size-4" />
            <span className="hidden sm:inline">Cuadrícula</span>
          </button>
          <button
            className={cn(
              "flex items-center gap-2 border-[rgba(255,255,255,0.12)] border-l px-4 py-2 font-medium text-sm transition-all",
              viewMode === "list"
                ? "bg-[#dfff06] text-black"
                : "text-[#6b6b6b] hover:text-white"
            )}
            onClick={() => onViewModeChange("list")}
          >
            <List className="size-4" />
            <span className="hidden sm:inline">Lista</span>
          </button>
        </div>
      </div>
    </div>
  );
}
