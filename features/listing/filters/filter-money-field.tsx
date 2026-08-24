import { TextInput } from "@mantine/core";
import { FilterField } from "@/features/listing/filters/filter-field";
import { formatMoneyInput, sanitizeMoneyInput } from "@/lib/utils";

export function FilterMoneyField({
  id,
  label,
  onChange,
  placeholder,
  size = "sm",
  value,
}: {
  id: string;
  label: string;
  onChange: (value: string) => void;
  placeholder?: string;
  size?: "sm" | "md";
  value: string;
}) {
  return (
    <FilterField htmlFor={id} label={label}>
      <TextInput
        autoComplete="off"
        id={id}
        inputMode="numeric"
        onChange={(event) => onChange(sanitizeMoneyInput(event.target.value))}
        placeholder={placeholder}
        size={size}
        type="text"
        value={formatMoneyInput(value)}
      />
    </FilterField>
  );
}
