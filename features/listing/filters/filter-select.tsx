import { Select } from "@mantine/core";
import { FilterField } from "@/features/listing/filters/filter-field";
import { ALL_FILTER_VALUE } from "@/features/listing/listing.constants.shared";

export interface FilterSelectOption {
  label: string;
  value: string;
}

export function FilterSelect({
  allLabel = "Todos",
  id,
  label,
  onChange,
  options,
  placeholder,
  size = "sm",
  value,
}: {
  allLabel?: string;
  id: string;
  label: string;
  onChange: (value: string) => void;
  options: FilterSelectOption[];
  placeholder?: string;
  size?: "sm" | "md";
  value: string;
}) {
  return (
    <FilterField htmlFor={id} label={label}>
      <Select
        data={[{ value: ALL_FILTER_VALUE, label: allLabel }, ...options]}
        id={id}
        onChange={(nextValue) =>
          onChange(
            !nextValue || nextValue === ALL_FILTER_VALUE ? "" : nextValue
          )
        }
        placeholder={placeholder ?? allLabel}
        size={size}
        value={value || ALL_FILTER_VALUE}
      />
    </FilterField>
  );
}
