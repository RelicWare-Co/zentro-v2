import { TextInput } from "@mantine/core";
import { Barcode, LayoutGrid, List, Search, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { usePosPage } from "@/features/pos/pos-page-context";
import {
  posV2AccentBg,
  posV2AccentBorder,
  posV2AccentText,
  posV2MutedPlaceholderText,
  posV2MutedText,
  posV2OrderBorderStrong,
  posV2OrderHoverSurface,
  posV2OrderInputClassName,
} from "@/features/posv2/components/pos-v2-order-styles";
import { cn } from "@/lib/utils";

export function CatalogToolbar({
  isBarcodeScannerConnected,
}: {
  isBarcodeScannerConnected?: boolean;
}) {
  const { state, actions } = usePosPage();
  const searchInputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [hasOverflow, setHasOverflow] = useState(() => {
    // Initialize with false, will be measured after mount
    return false;
  });
  const hasInitializedRef = useRef(false);

  useEffect(() => {
    const element = scrollRef.current;
    if (!element || hasInitializedRef.current) {
      return;
    }

    const check = () => {
      setHasOverflow(element.scrollWidth > element.clientWidth);
    };

    check();
    hasInitializedRef.current = true;

    const resizeObserver = new ResizeObserver(check);
    resizeObserver.observe(element);
    window.addEventListener("resize", check);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("resize", check);
    };
  }, []);

  const handleWheel = (event: React.WheelEvent<HTMLDivElement>) => {
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
  };

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
        aria-label="Buscar producto"
        classNames={{
          input: cn(
            "h-11 rounded-xl md:h-12",
            posV2MutedPlaceholderText,
            posV2OrderInputClassName
          ),
        }}
        leftSection={
          <Search aria-hidden="true" className={cn("size-4", posV2MutedText)} />
        }
        onChange={(event) => actions.setSearchQuery(event.target.value)}
        placeholder="Buscar producto por nombre, SKU o código... (/)"
        ref={searchInputRef}
        rightSection={
          <div className="flex items-center">
            {state.searchQuery ? (
              <button
                aria-label="Limpiar búsqueda"
                className={cn(
                  "inline-flex size-7 items-center justify-center rounded-md transition-colors hover:text-white",
                  posV2MutedText,
                  posV2OrderHoverSurface
                )}
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
                isBarcodeScannerConnected ? posV2AccentText : posV2MutedText
              )}
              role="img"
              title={
                isBarcodeScannerConnected
                  ? "Escáner de código de barras conectado · listo"
                  : "Escáner de código de barras desconectado · no disponible"
              }
            >
              <Barcode aria-hidden="true" className="size-4" />
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
                    ? `${posV2AccentBorder} ${posV2AccentBg} text-black`
                    : `${posV2OrderBorderStrong} bg-transparent ${posV2MutedText} hover:border-[color-mix(in_srgb,white_25%,transparent)] hover:text-white`
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

        <div
          className={cn(
            "ml-auto flex shrink-0 items-center overflow-hidden rounded-xl border",
            posV2OrderBorderStrong
          )}
        >
          <button
            aria-label="Vista de cuadrícula"
            className={cn(
              "flex items-center gap-2 px-4 py-2 font-medium text-sm transition-all",
              state.viewMode === "grid"
                ? `${posV2AccentBg} text-black`
                : `${posV2MutedText} hover:text-white`
            )}
            onClick={() => actions.setViewMode("grid")}
            type="button"
          >
            <LayoutGrid aria-hidden="true" className="size-4" />
            <span className="hidden sm:inline">Cuadrícula</span>
          </button>
          <button
            aria-label="Vista de lista"
            className={cn(
              "flex items-center gap-2 border-l px-4 py-2 font-medium text-sm transition-all",
              posV2OrderBorderStrong,
              state.viewMode === "list"
                ? `${posV2AccentBg} text-black`
                : `${posV2MutedText} hover:text-white`
            )}
            onClick={() => actions.setViewMode("list")}
            type="button"
          >
            <List aria-hidden="true" className="size-4" />
            <span className="hidden sm:inline">Lista</span>
          </button>
        </div>
      </div>
    </div>
  );
}
