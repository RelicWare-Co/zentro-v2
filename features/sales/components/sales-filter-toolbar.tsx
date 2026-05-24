import { Filter, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  SalesAdvancedFiltersDesktop,
  SalesAdvancedFiltersMobile,
} from "@/features/sales/components/sales-advanced-filters";
import { ALL_FILTER_VALUE } from "@/features/sales/sales-page.constants.shared";
import { useSalesPage } from "@/features/sales/sales-page-context";

export function SalesFilterToolbar() {
  const { state, actions, meta } = useSalesPage();
  const { filters } = state;

  return (
    <div className="flex flex-col gap-4 border-zinc-800 border-b p-4 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex w-full flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <div className="relative w-full sm:max-w-xs md:max-w-sm">
          <Search
            aria-hidden="true"
            className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-zinc-500"
          />
          <Input
            autoComplete="off"
            className="h-10 rounded-lg border-zinc-800 bg-black/20 pl-9 focus-visible:border-[var(--color-voltage)] focus-visible:ring-[var(--color-voltage)]/20"
            id={meta.fieldIds.search}
            onChange={(event) => actions.setSearchQuery(event.target.value)}
            placeholder="Cliente, cajero o id…"
            value={filters.searchQuery}
          />
        </div>

        <div className="w-full sm:w-[200px]">
          <Select
            onValueChange={(value) =>
              actions.setStatus(value === ALL_FILTER_VALUE ? "" : value)
            }
            value={filters.status || ALL_FILTER_VALUE}
          >
            <SelectTrigger
              className="h-10 w-full rounded-lg border-zinc-800 bg-black/20 text-white"
              id={meta.fieldIds.status}
            >
              <SelectValue placeholder="Estado" />
            </SelectTrigger>
            <SelectContent className="border-zinc-800 bg-[var(--color-carbon)] text-white">
              <SelectItem value={ALL_FILTER_VALUE}>Todos</SelectItem>
              <SelectItem value="completed">Pagada</SelectItem>
              <SelectItem value="credit">Crédito</SelectItem>
              <SelectItem value="cancelled">Cancelada</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Sheet
          onOpenChange={actions.setMobileFilterOpen}
          open={state.isMobileFilterOpen}
        >
          <SheetTrigger asChild>
            <Button
              className="h-10 w-full rounded-lg border-zinc-800 bg-black/20 text-zinc-300 hover:bg-white/5 hover:text-white sm:hidden"
              type="button"
              variant="outline"
            >
              <Filter aria-hidden="true" className="mr-2 size-4" />
              Filtros
              {state.activeAdvancedFilterCount > 0 ? (
                <Badge className="ml-2 rounded-sm bg-[var(--color-voltage)]/20 px-1.5 py-0.5 font-mono text-[10px] text-[var(--color-voltage)] hover:bg-[var(--color-voltage)]/30">
                  {state.activeAdvancedFilterCount}
                </Badge>
              ) : null}
            </Button>
          </SheetTrigger>
          <SheetContent
            className="h-[85vh] rounded-t-xl border-zinc-800 bg-[var(--color-carbon)] text-white"
            showCloseButton={false}
            side="bottom"
          >
            <SheetHeader className="border-zinc-800 border-b pb-4">
              <SheetTitle className="text-zinc-200">
                Filtros avanzados
              </SheetTitle>
            </SheetHeader>
            <div className="flex-1 overflow-y-auto p-4">
              <SalesAdvancedFiltersMobile />
            </div>
          </SheetContent>
        </Sheet>

        <Popover>
          <PopoverTrigger asChild>
            <Button
              className="hidden h-10 rounded-lg border-zinc-800 bg-black/20 text-zinc-300 hover:bg-white/5 hover:text-white sm:inline-flex"
              type="button"
              variant="outline"
            >
              <Filter aria-hidden="true" className="mr-2 size-4" />
              Filtros
              {state.activeAdvancedFilterCount > 0 ? (
                <Badge className="ml-2 rounded-sm bg-[var(--color-voltage)]/20 px-1.5 py-0.5 font-mono text-[10px] text-[var(--color-voltage)] hover:bg-[var(--color-voltage)]/30">
                  {state.activeAdvancedFilterCount}
                </Badge>
              ) : null}
            </Button>
          </PopoverTrigger>
          <PopoverContent
            align="start"
            className="z-50 w-[600px] rounded-xl border-zinc-800 bg-[var(--color-carbon)] p-4 text-white shadow-xl"
          >
            <div className="space-y-4">
              <h4 className="font-medium text-sm text-zinc-200">
                Filtros avanzados
              </h4>
              <SalesAdvancedFiltersDesktop />
            </div>
          </PopoverContent>
        </Popover>

        {state.activeFilterCount > 0 ? (
          <Button
            className="h-10 text-zinc-400 hover:text-white"
            onClick={actions.clearFilters}
            type="button"
            variant="ghost"
          >
            Limpiar
          </Button>
        ) : null}
      </div>
    </div>
  );
}
