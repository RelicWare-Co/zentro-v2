import { TextInput } from "@mantine/core";
import { Barcode, LayoutGrid, List, Search, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { usePosPage } from "@/features/pos/pos-page-context";
import { cn } from "@/lib/utils";

export function CatalogToolbar({
  isBarcodeScannerConnected,
}: {
  isBarcodeScannerConnected?: boolean;
}) {
  const { state, actions } = usePosPage();
  const searchInputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [hasOverflow, setHasOverflow] = useState(false);

  useEffect(() => {
    const element = scrollRef.current;
    if (!element) {
      return;
    }

    const check = () => {
      setHasOverflow(element.scrollWidth > element.clientWidth);
    };

    check();

    const resizeObserver = new ResizeObserver(check);
    resizeObserver.observe(element);
    window.addEventListener("resize", check);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("resize", check);
    };
  }, []);

  const handleWheel = useCallback((event: React.WheelEvent<HTMLDivElement>) => {
    const element = scrollRef.current;
    if (!element) {
      return;
    }
    if (element.scrollWidth <= element.clientWidth) {
      return;
    }
    if (Math.abs(event.deltaY) < Math.abs(event.deltaX)) {
      return;
    }

    event.preventDefault();
    element.scrollLeft += event.deltaY;
  }, []);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (
        event.key === "/" &&
        !event.ctrlKey &&
        !event.metaKey &&
        !event.altKey
      ) {
        const target = event.target as HTMLElement;
        if (
          target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable
        ) {
          return;
        }
        event.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  const allCategories = [{ id: "all", name: "Todos" }, ...state.categories];

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
      <TextInput
        classNames={{
          input:
            "h-11 rounded-xl border-[rgba(255,255,255,0.08)] bg-[#111111] text-sm text-white placeholder:text-[#6b6b6b] focus-visible:border-[#dfff06]/30 md:h-12",
        }}
        leftSection={<Search className="size-4 text-[#6b6b6b]" />}
        onChange={(event) => actions.setSearchQuery(event.target.value)}
        placeholder="Buscar producto por nombre, SKU o código... (/)"
        ref={searchInputRef}
        rightSection={
          <div className="flex items-center">
            {state.searchQuery ? (
              <button
                className="inline-flex size-7 items-center justify-center rounded-md text-[#6b6b6b] transition-colors hover:bg-[rgba(255,255,255,0.06)] hover:text-white"
                onClick={() => {
                  actions.setSearchQuery("");
                  searchInputRef.current?.focus();
                }}
                type="button"
              >
                <X className="size-4" />
              </button>
            ) : null}
            <span
              className={cn(
                "inline-flex size-7 items-center justify-center rounded-md",
                isBarcodeScannerConnected ? "text-[#dfff06]" : "text-[#6b6b6b]"
              )}
              role="img"
              title={
                isBarcodeScannerConnected
                  ? "Escáner de código de barras conectado · listo"
                  : "Escáner de código de barras desconectado · no disponible"
              }
            >
              <Barcode className="size-4" />
            </span>
          </div>
        }
        rightSectionWidth={state.searchQuery ? 64 : 36}
        value={state.searchQuery}
      />

      <div className="flex items-center gap-2">
        <div
          className="no-scrollbar flex items-center gap-1.5 overflow-x-auto"
          onWheel={handleWheel}
          ref={scrollRef}
          style={maskStyle}
        >
          {allCategories.map((category) => {
            const isActive = state.activeCategoryId === category.id;
            return (
              <button
                className={cn(
                  "shrink-0 rounded-full border px-3.5 py-1.5 font-medium text-xs transition-all md:text-sm",
                  isActive
                    ? "border-[#dfff06] bg-[#dfff06] text-black"
                    : "border-[rgba(255,255,255,0.12)] bg-transparent text-[#6b6b6b] hover:border-[rgba(255,255,255,0.25)] hover:text-white"
                )}
                key={category.id}
                onClick={() => actions.setActiveCategoryId(category.id)}
                type="button"
              >
                {category.name}
              </button>
            );
          })}
        </div>

        <div className="ml-auto flex shrink-0 items-center overflow-hidden rounded-xl border border-[rgba(255,255,255,0.12)]">
          <button
            className={cn(
              "flex items-center gap-2 px-4 py-2 font-medium text-sm transition-all",
              state.viewMode === "grid"
                ? "bg-[#dfff06] text-black"
                : "text-[#6b6b6b] hover:text-white"
            )}
            onClick={() => actions.setViewMode("grid")}
            type="button"
          >
            <LayoutGrid className="size-4" />
            <span className="hidden sm:inline">Cuadrícula</span>
          </button>
          <button
            className={cn(
              "flex items-center gap-2 border-[rgba(255,255,255,0.12)] border-l px-4 py-2 font-medium text-sm transition-all",
              state.viewMode === "list"
                ? "bg-[#dfff06] text-black"
                : "text-[#6b6b6b] hover:text-white"
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
  );
}
