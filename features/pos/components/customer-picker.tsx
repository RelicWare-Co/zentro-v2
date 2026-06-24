import { Combobox, useCombobox } from "@mantine/core";
import { Check, ChevronsUpDown } from "lucide-react";
import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import type { PosCustomer } from "../types";

interface CustomerPickerProps {
  buttonClassName?: string;
  contentClassName?: string;
  customers: PosCustomer[];
  onCustomerChange: (customerId: string) => void;
  searchPlaceholder?: string;
  selectedCustomerId: string;
}

export function CustomerPicker({
  customers,
  selectedCustomerId,
  onCustomerChange,
  buttonClassName,
  contentClassName,
  searchPlaceholder = "Buscar por nombre, documento o teléfono...",
}: CustomerPickerProps) {
  const combobox = useCombobox({
    onDropdownClose: () => setSearch(""),
  });
  const [search, setSearch] = useState("");
  const selectedCustomer = useMemo(
    () =>
      customers.find((customer) => customer.id === selectedCustomerId) ?? null,
    [customers, selectedCustomerId]
  );
  const selectedCustomerLabel = selectedCustomer?.name ?? "Cliente Mostrador";
  const selectedCustomerMeta = selectedCustomer
    ? [
        selectedCustomer.documentNumber,
        selectedCustomer.phone,
        selectedCustomer.email,
      ]
        .filter(Boolean)
        .join(" · ")
    : "Venta rápida sin cliente asociado";

  const normalizedSearch = search.trim().toLowerCase();
  const filteredCustomers = customers.filter((customer) =>
    `${customer.name} ${customer.documentNumber ?? ""} ${customer.phone ?? ""} ${customer.email ?? ""}`
      .toLowerCase()
      .includes(normalizedSearch)
  );

  return (
    <Combobox
      classNames={{
        dropdown: cn(
          "w-[min(360px,calc(100vw-2rem))] border-zinc-800 bg-[var(--color-carbon)] p-0 text-white",
          contentClassName
        ),
      }}
      onOptionSubmit={(value) => {
        onCustomerChange(value === "__mostrador__" ? "" : value);
        combobox.closeDropdown();
      }}
      position="bottom-start"
      store={combobox}
    >
      <Combobox.Target>
        <button
          aria-expanded={combobox.dropdownOpened}
          className={cn(
            "flex h-11 min-w-0 items-center justify-between rounded-lg border border-zinc-800 bg-[#101010] px-3 py-2 text-left text-sm text-white hover:bg-[#151515]",
            buttonClassName
          )}
          onClick={() => combobox.toggleDropdown()}
          type="button"
        >
          <span className="min-w-0">
            <span className="block truncate">{selectedCustomerLabel}</span>
            <span className="block truncate text-xs text-zinc-500">
              {selectedCustomerMeta}
            </span>
          </span>
          <ChevronsUpDown
            aria-hidden="true"
            className="ml-2 size-4 shrink-0 text-zinc-500"
          />
        </button>
      </Combobox.Target>

      <Combobox.Dropdown>
        <Combobox.Search
          onChange={(event) => setSearch(event.currentTarget.value)}
          placeholder={searchPlaceholder}
          value={search}
        />
        <Combobox.Options className="p-1.5">
          <Combobox.Option
            className="gap-3 rounded-lg py-3 text-white"
            value="__mostrador__"
          >
            <div className="flex items-center gap-3">
              <div className="min-w-0 flex-1 space-y-1">
                <p className="truncate font-medium">Cliente Mostrador</p>
                <p className="truncate text-xs text-zinc-400">
                  Venta rápida sin cliente asociado
                </p>
              </div>
              <Check
                className={cn(
                  "size-4 shrink-0",
                  selectedCustomerId === "" ? "opacity-100" : "opacity-0"
                )}
              />
            </div>
          </Combobox.Option>
          {filteredCustomers.map((customer) => (
            <Combobox.Option
              className="gap-3 rounded-lg py-3 text-white"
              key={customer.id}
              value={customer.id}
            >
              <div className="flex items-center gap-3">
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="truncate font-medium">{customer.name}</p>
                  <p className="truncate text-xs text-zinc-400">
                    {[customer.documentNumber, customer.phone, customer.email]
                      .filter(Boolean)
                      .join(" · ") || "Sin datos adicionales"}
                  </p>
                </div>
                <Check
                  className={cn(
                    "size-4 shrink-0",
                    selectedCustomerId === customer.id
                      ? "opacity-100"
                      : "opacity-0"
                  )}
                />
              </div>
            </Combobox.Option>
          ))}
          {filteredCustomers.length === 0 ? (
            <Combobox.Empty>No se encontraron clientes.</Combobox.Empty>
          ) : null}
        </Combobox.Options>
      </Combobox.Dropdown>
    </Combobox>
  );
}
