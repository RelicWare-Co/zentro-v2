import { Select, TextInput } from "@mantine/core";
import { Search } from "lucide-react";
import { useState } from "react";
import { useKardexProductPickerOptions } from "@/features/products/hooks/use-products";
import type { InventoryMovementType } from "@/features/products/inventory-movements.shared";
import { INVENTORY_MOVEMENT_TYPE_LABELS } from "@/features/products/inventory-movements.shared";

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
  const [productPickerSearch, setProductPickerSearch] = useState("");
  const { products: productOptions } = useKardexProductPickerOptions({
    searchQuery: productPickerSearch,
    selectedProductId: filters.productId,
  });

  const productData = [
    { value: "all", label: "Todos los productos" },
    ...productOptions.map((product) => ({
      value: product.id,
      label: product.name,
    })),
  ];

  return (
    <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-5">
      <div className="xl:col-span-2">
        <TextInput
          leftSection={<Search className="size-4 text-zinc-500" />}
          onChange={(event) => onChange({ searchQuery: event.target.value })}
          placeholder="Buscar producto, notas o usuario..."
          value={filters.searchQuery}
        />
      </div>
      <Select
        // Server-side search: show returned options without client filtering.
        data={productData}
        filter={({ options }) => options}
        onChange={(value) => onChange({ productId: value ?? "all" })}
        onSearchChange={setProductPickerSearch}
        placeholder="Producto"
        searchable
        searchValue={productPickerSearch}
        value={filters.productId}
      />
      <Select
        data={[
          { value: "all", label: "Todos los tipos" },
          ...(
            Object.keys(
              INVENTORY_MOVEMENT_TYPE_LABELS
            ) as InventoryMovementType[]
          ).map((movementType) => ({
            value: movementType,
            label: INVENTORY_MOVEMENT_TYPE_LABELS[movementType],
          })),
        ]}
        onChange={(value) => onChange({ type: value ?? "all" })}
        placeholder="Tipo"
        value={filters.type}
      />
      <div className="grid grid-cols-2 gap-3">
        <TextInput
          onChange={(event) => onChange({ startDate: event.target.value })}
          type="date"
          value={filters.startDate}
        />
        <TextInput
          onChange={(event) => onChange({ endDate: event.target.value })}
          type="date"
          value={filters.endDate}
        />
      </div>
    </div>
  );
}
