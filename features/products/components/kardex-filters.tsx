import { Check, ChevronsUpDown, Search } from "lucide-react";
import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
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
import { useKardexProductPickerOptions } from "@/features/products/hooks/use-products";
import type { InventoryMovementType } from "@/features/products/inventory-movements.shared";
import { INVENTORY_MOVEMENT_TYPE_LABELS } from "@/features/products/inventory-movements.shared";
import { cn } from "@/lib/utils";

export interface KardexFiltersState {
  endDate: string;
  productId: string;
  searchQuery: string;
  startDate: string;
  type: string;
}

export function KardexFilters({
  filters,
  onChange,
}: {
  filters: KardexFiltersState;
  onChange: (patch: Partial<KardexFiltersState>) => void;
}) {
  const productPickerListId = useId();
  const [productPickerOpen, setProductPickerOpen] = useState(false);
  const [productPickerSearch, setProductPickerSearch] = useState("");
  const { products: productOptions } = useKardexProductPickerOptions({
    searchQuery: productPickerSearch,
    selectedProductId: filters.productId,
  });
  const selectedProductLabel =
    filters.productId === "all"
      ? "Todos los productos"
      : (productOptions.find((product) => product.id === filters.productId)
          ?.name ?? "Producto");

  return (
    <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-5">
      <div className="relative xl:col-span-2">
        <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-zinc-500" />
        <Input
          className="border-zinc-800 bg-black/20 pl-9"
          onChange={(event) => onChange({ searchQuery: event.target.value })}
          placeholder="Buscar producto, notas o usuario..."
          value={filters.searchQuery}
        />
      </div>
      <Popover onOpenChange={setProductPickerOpen} open={productPickerOpen}>
        <PopoverTrigger asChild>
          <Button
            aria-controls={productPickerListId}
            aria-expanded={productPickerOpen}
            className="justify-between border-zinc-800 bg-black/20 text-white hover:bg-white/5"
            role="combobox"
            type="button"
            variant="outline"
          >
            <span className="truncate">{selectedProductLabel}</span>
            <ChevronsUpDown className="ml-2 size-4 shrink-0 text-zinc-500" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[min(360px,calc(100vw-2rem))] border-zinc-800 bg-[var(--color-carbon)] p-0 text-white">
          <Command className="bg-transparent">
            <CommandInput
              className="text-white placeholder:text-zinc-500"
              onValueChange={setProductPickerSearch}
              placeholder="Buscar producto..."
              value={productPickerSearch}
            />
            <CommandList className="p-1.5" id={productPickerListId}>
              <CommandEmpty className="text-zinc-400">
                No se encontraron productos.
              </CommandEmpty>
              <CommandItem
                className="gap-3 rounded-lg py-2 text-white"
                onSelect={() => {
                  onChange({ productId: "all" });
                  setProductPickerOpen(false);
                }}
                value="all-products"
              >
                Todos los productos
                <Check
                  className={cn(
                    "ml-auto size-4 shrink-0",
                    filters.productId === "all" ? "opacity-100" : "opacity-0"
                  )}
                />
              </CommandItem>
              {productOptions.map((product) => (
                <CommandItem
                  className="gap-3 rounded-lg py-2 text-white"
                  key={product.id}
                  onSelect={() => {
                    onChange({ productId: product.id });
                    setProductPickerOpen(false);
                  }}
                  value={`${product.name} ${product.id}`}
                >
                  <span className="truncate">{product.name}</span>
                  <Check
                    className={cn(
                      "ml-auto size-4 shrink-0",
                      filters.productId === product.id
                        ? "opacity-100"
                        : "opacity-0"
                    )}
                  />
                </CommandItem>
              ))}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      <Select
        onValueChange={(value) => onChange({ type: value })}
        value={filters.type}
      >
        <SelectTrigger className="border-zinc-800 bg-black/20 text-white">
          <SelectValue placeholder="Tipo" />
        </SelectTrigger>
        <SelectContent className="border-zinc-800 bg-[var(--color-carbon)] text-white">
          <SelectItem value="all">Todos los tipos</SelectItem>
          {(
            Object.keys(
              INVENTORY_MOVEMENT_TYPE_LABELS
            ) as InventoryMovementType[]
          ).map((movementType) => (
            <SelectItem key={movementType} value={movementType}>
              {INVENTORY_MOVEMENT_TYPE_LABELS[movementType]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <div className="grid grid-cols-2 gap-3">
        <Input
          className="border-zinc-800 bg-black/20"
          onChange={(event) => onChange({ startDate: event.target.value })}
          type="date"
          value={filters.startDate}
        />
        <Input
          className="border-zinc-800 bg-black/20"
          onChange={(event) => onChange({ endDate: event.target.value })}
          type="date"
          value={filters.endDate}
        />
      </div>
    </div>
  );
}
