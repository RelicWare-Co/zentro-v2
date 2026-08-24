import { TextInput } from "@mantine/core";
import { FilterField } from "@/features/listing/filters/filter-field";

export function FilterDateField({
  id,
  label,
  onChange,
  size = "sm",
  value,
}: {
  id: string;
  label: string;
  onChange: (value: string) => void;
  size?: "sm" | "md";
  value: string;
}) {
  return (
    <FilterField htmlFor={id} label={label}>
      <TextInput
        autoComplete="off"
        id={id}
        onChange={(event) => onChange(event.target.value)}
        size={size}
        type="date"
        value={value}
      />
    </FilterField>
  );
}
