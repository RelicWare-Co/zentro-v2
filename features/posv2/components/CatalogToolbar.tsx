import { useCallback, useEffect, useRef, useState } from "react";
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
  const scrollRef = useRef<HTMLDivElement>(null);
  const [hasOverflow, setHasOverflow] = useState(false);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

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
  }, [categories]);

  const handleWheel = useCallback((e: React.WheelEvent<HTMLDivElement>) => {
    const el = scrollRef.current;
    if (!el) return;
    if (el.scrollWidth <= el.clientWidth) return;
    if (Math.abs(e.deltaY) < Math.abs(e.deltaX)) return;

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
    <div className="shrink-0 px-4 md:px-6 space-y-3 pb-2">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-[#6b6b6b]" />
        <Input
          ref={searchInputRef}
          placeholder="Buscar producto por nombre, SKU o código... (/)"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="h-11 md:h-12 rounded-xl border-[rgba(255,255,255,0.08)] bg-[#111111] pl-10 pr-10 text-sm text-white placeholder:text-[#6b6b6b] focus-visible:border-[#dfff06]/30 focus-visible:ring-1 focus-visible:ring-[#dfff06]/20"
        />
        {searchQuery ? (
          <button
            type="button"
            onClick={() => {
              onClearSearch();
              searchInputRef.current?.focus();
            }}
            className="absolute right-10 top-1/2 -translate-y-1/2 inline-flex size-7 items-center justify-center rounded-md text-[#6b6b6b] transition-colors hover:bg-[rgba(255,255,255,0.06)] hover:text-white"
          >
            <X className="size-4" />
          </button>
        ) : null}
        <button
          type="button"
          className="absolute right-2.5 top-1/2 -translate-y-1/2 inline-flex size-7 items-center justify-center rounded-md text-[#6b6b6b]"
        >
          <Barcode className="size-4" />
        </button>
      </div>

      {/* Categories + View Toggle */}
      <div className="flex items-center gap-2">
        <div
          ref={scrollRef}
          onWheel={handleWheel}
          style={maskStyle}
          className="flex items-center gap-1.5 overflow-x-auto no-scrollbar"
        >
          {allCategories.map((cat) => {
            const isActive = activeCategoryId === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => onCategoryChange(cat.id)}
                className={cn(
                  "shrink-0 rounded-full px-3.5 py-1.5 text-xs md:text-sm font-medium transition-all border",
                  isActive
                    ? "bg-[#dfff06] text-black border-[#dfff06]"
                    : "bg-transparent text-[#6b6b6b] border-[rgba(255,255,255,0.12)] hover:text-white hover:border-[rgba(255,255,255,0.25)]"
                )}
              >
                {cat.name}
              </button>
            );
          })}
        </div>

        <div className="ml-auto flex items-center rounded-xl border border-[rgba(255,255,255,0.12)] overflow-hidden shrink-0">
          <button
            onClick={() => onViewModeChange("grid")}
            className={cn(
              "flex items-center gap-2 px-4 py-2 text-sm font-medium transition-all",
              viewMode === "grid"
                ? "bg-[#dfff06] text-black"
                : "text-[#6b6b6b] hover:text-white"
            )}
          >
            <LayoutGrid className="size-4" />
            <span className="hidden sm:inline">Cuadrícula</span>
          </button>
          <button
            onClick={() => onViewModeChange("list")}
            className={cn(
              "flex items-center gap-2 px-4 py-2 text-sm font-medium transition-all border-l border-[rgba(255,255,255,0.12)]",
              viewMode === "list"
                ? "bg-[#dfff06] text-black"
                : "text-[#6b6b6b] hover:text-white"
            )}
          >
            <List className="size-4" />
            <span className="hidden sm:inline">Lista</span>
          </button>
        </div>
      </div>
    </div>
  );
}
