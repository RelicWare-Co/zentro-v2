import { Badge, Button, Collapse, Drawer, TextInput } from "@mantine/core";
import { Filter, Search, X } from "lucide-react";
import { type ReactNode, useState } from "react";
import { useIsMobile } from "@/hooks/use-mobile";

export interface ActiveFilterChip {
  key: string;
  label: string;
  onClear: () => void;
}

export function FilterToolbar({
  activeAdvancedFilterCount,
  activeFilterChips,
  hasActiveFilters,
  onClearFilters,
  renderAdvancedFilters,
  searchAriaLabel,
  searchFieldId,
  searchPlaceholder,
  searchQuery,
  setSearchQuery,
}: {
  activeAdvancedFilterCount: number;
  activeFilterChips: ActiveFilterChip[];
  hasActiveFilters: boolean;
  onClearFilters: () => void;
  renderAdvancedFilters: (layout: "mobile" | "desktop") => ReactNode;
  searchAriaLabel: string;
  searchFieldId: string;
  searchPlaceholder: string;
  searchQuery: string;
  setSearchQuery: (value: string) => void;
}) {
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const isMobile = useIsMobile();

  const handleClearFilters = () => {
    setIsPanelOpen(false);
    onClearFilters();
  };

  const filterCountBadge =
    activeAdvancedFilterCount > 0 ? (
      <Badge
        className="ml-2 bg-[var(--color-voltage)]/20 font-mono text-[var(--color-voltage)]"
        size="sm"
        tt="none"
      >
        {activeAdvancedFilterCount}
      </Badge>
    ) : null;

  const filterButton = (
    <Button
      className="w-full sm:w-auto"
      leftSection={<Filter aria-hidden="true" className="size-4" />}
      onClick={() => setIsPanelOpen((open) => !open)}
      type="button"
      variant={isPanelOpen ? "light" : "outline"}
    >
      Filtros
      {filterCountBadge}
    </Button>
  );

  return (
    <div className="shrink-0 border-zinc-800 border-b p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <div className="w-full sm:max-w-xs md:max-w-sm">
          <TextInput
            aria-label={searchAriaLabel}
            autoComplete="off"
            id={searchFieldId}
            leftSection={<Search aria-hidden="true" className="size-4" />}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder={searchPlaceholder}
            value={searchQuery}
          />
        </div>

        {filterButton}

        {hasActiveFilters ? (
          <Button onClick={handleClearFilters} type="button" variant="subtle">
            Limpiar
          </Button>
        ) : null}
      </div>

      {activeFilterChips.length > 0 ? (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {activeFilterChips.map((chip) => (
            <Button
              className="h-7 px-2.5 font-normal text-xs"
              key={chip.key}
              onClick={chip.onClear}
              rightSection={<X aria-hidden="true" className="size-3.5" />}
              size="compact-xs"
              type="button"
              variant="default"
            >
              {chip.label}
            </Button>
          ))}
        </div>
      ) : null}

      {isMobile ? (
        <Drawer
          onClose={() => setIsPanelOpen(false)}
          opened={isPanelOpen}
          position="bottom"
          size="85%"
          title="Filtros"
        >
          <div className="flex h-full flex-col">
            <div className="flex-1 space-y-6 overflow-y-auto p-4">
              {renderAdvancedFilters("mobile")}
            </div>
            <div className="grid grid-cols-2 gap-3 border-zinc-800 border-t p-4">
              <Button
                onClick={handleClearFilters}
                type="button"
                variant="outline"
              >
                Limpiar
              </Button>
              <Button
                c="black"
                color="voltage.5"
                onClick={() => setIsPanelOpen(false)}
                type="button"
              >
                Listo
              </Button>
            </div>
          </div>
        </Drawer>
      ) : (
        <Collapse expanded={isPanelOpen} keepMountedMode="display-none">
          <div className="mt-4 rounded-xl border border-zinc-800 bg-black/20 p-4">
            <h2 className="mb-4 font-semibold text-sm text-zinc-300">
              Filtros avanzados
            </h2>
            {renderAdvancedFilters("desktop")}
            <div className="mt-4 flex items-center justify-between gap-3 border-zinc-800 border-t pt-3">
              <Button
                onClick={handleClearFilters}
                type="button"
                variant="outline"
              >
                Limpiar
              </Button>
              <Button
                c="black"
                color="voltage.5"
                onClick={() => setIsPanelOpen(false)}
                type="button"
              >
                Cerrar
              </Button>
            </div>
          </div>
        </Collapse>
      )}
    </div>
  );
}
