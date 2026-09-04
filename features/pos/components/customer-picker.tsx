import { Combobox, useCombobox } from "@mantine/core";
import { Check, ChevronsUpDown, Plus, Search, Store, User } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PosCustomer } from "../types";

interface CustomerPickerProps {
  buttonClassName?: string;
  contentClassName?: string;
  customers: PosCustomer[];
  onCreateCustomer?: () => void;
  onCustomerChange: (customerId: string) => void;
  /** Server-side search: typing and dropdown close are forwarded to the owner. */
  onSearchChange: (value: string) => void;
  searchPlaceholder?: string;
  searchValue: string;
  /** Resolved selected customer (may be absent from the current results page). */
  selectedCustomer: PosCustomer | null;
  selectedCustomerId: string;
  showIcon?: boolean;
}

export function CustomerPicker({
  customers,
  selectedCustomer,
  selectedCustomerId,
  onCreateCustomer,
  onCustomerChange,
  onSearchChange,
  searchValue,
  buttonClassName,
  contentClassName,
  searchPlaceholder = "Buscar por nombre, documento o teléfono...",
  showIcon = true,
}: CustomerPickerProps) {
  const combobox = useCombobox({
    onDropdownClose: () => onSearchChange(""),
  });
  const selectedCustomerLabel = selectedCustomer?.name ?? "Cliente Mostrador";

  const isOpen = combobox.dropdownOpened;

  return (
    <Combobox
      classNames={{
        dropdown: cn(
          "w-[min(380px,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900 p-0 shadow-2xl shadow-black/50",
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
          aria-expanded={isOpen}
          aria-haspopup="listbox"
          aria-label="Seleccionar cliente"
          className={cn(
            "group flex h-9 min-w-0 cursor-pointer items-center gap-2 rounded-full border bg-zinc-900 p-1 pr-3 text-left font-medium text-sm text-white shadow-sm transition-all hover:bg-zinc-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-voltage)]/30",
            isOpen
              ? "border-[var(--color-voltage)] bg-zinc-800 shadow-[0_0_0_3px_rgba(212,255,0,0.12)]"
              : "border-zinc-700 hover:border-zinc-600",
            buttonClassName
          )}
          onClick={() => combobox.toggleDropdown()}
          type="button"
        >
          {showIcon ? (
            <span
              className={cn(
                "flex size-7 shrink-0 items-center justify-center rounded-full transition-colors",
                selectedCustomer
                  ? "bg-[var(--color-voltage)] text-black"
                  : "bg-zinc-800 text-zinc-400 group-hover:bg-zinc-700 group-hover:text-zinc-200",
                isOpen && !selectedCustomer && "bg-zinc-700 text-zinc-200"
              )}
            >
              {selectedCustomer ? (
                <User className="size-4" />
              ) : (
                <Store className="size-3.5" />
              )}
            </span>
          ) : null}
          <span className="min-w-0 flex-1 truncate">
            {selectedCustomerLabel}
          </span>
          <ChevronsUpDown
            aria-hidden="true"
            className={cn(
              "size-4 shrink-0 text-zinc-500 transition-all group-hover:text-zinc-300",
              isOpen && "rotate-180 text-[var(--color-voltage)]"
            )}
          />
        </button>
      </Combobox.Target>

      <Combobox.Dropdown>
        <div className="border-zinc-800 border-b p-2">
          <Combobox.Search
            classNames={{
              input:
                "h-9 rounded-xl border-zinc-700 bg-zinc-800 text-sm text-white placeholder:text-zinc-500 focus:border-[var(--color-voltage)] focus:ring-1 focus:ring-[var(--color-voltage)]/20",
            }}
            leftSection={<Search className="size-4 text-zinc-500" />}
            onChange={(event) => onSearchChange(event.currentTarget.value)}
            placeholder={searchPlaceholder}
            value={searchValue}
          />
        </div>
        <Combobox.Options className="max-h-[320px] overflow-y-auto p-1.5">
          <Combobox.Option
            className="rounded-xl px-2 py-2.5 text-white transition-colors hover:bg-zinc-800 data-[combobox-active]:bg-zinc-800"
            value="__mostrador__"
          >
            <div className="flex items-center gap-3">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-zinc-800 text-zinc-400">
                <Store className="size-4" />
              </span>
              <div className="min-w-0 flex-1 space-y-0.5">
                <p className="truncate font-medium text-sm">
                  Cliente Mostrador
                </p>
                <p className="truncate text-xs text-zinc-400">
                  Venta rápida sin cliente asociado
                </p>
              </div>
              <Check
                className={cn(
                  "size-4 shrink-0 text-[var(--color-voltage)]",
                  selectedCustomerId === "" ? "opacity-100" : "opacity-0"
                )}
              />
            </div>
          </Combobox.Option>
          {customers.map((customer) => (
            <Combobox.Option
              className="rounded-xl px-2 py-2.5 text-white transition-colors hover:bg-zinc-800 data-[combobox-active]:bg-zinc-800"
              key={customer.id}
              value={customer.id}
            >
              <div className="flex items-center gap-3">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[var(--color-voltage)]/15 text-[var(--color-voltage)]">
                  <User className="size-4" />
                </span>
                <div className="min-w-0 flex-1 space-y-0.5">
                  <p className="truncate font-medium text-sm">
                    {customer.name}
                  </p>
                  <p className="truncate text-xs text-zinc-400">
                    {[customer.documentNumber, customer.phone, customer.email]
                      .filter(Boolean)
                      .join(" · ") || "Sin datos adicionales"}
                  </p>
                </div>
                <Check
                  className={cn(
                    "size-4 shrink-0 text-[var(--color-voltage)]",
                    selectedCustomerId === customer.id
                      ? "opacity-100"
                      : "opacity-0"
                  )}
                />
              </div>
            </Combobox.Option>
          ))}
          {customers.length === 0 ? (
            <Combobox.Empty className="py-6 text-center text-sm text-zinc-500">
              No se encontraron clientes.
            </Combobox.Empty>
          ) : null}
        </Combobox.Options>
        {onCreateCustomer ? (
          <div className="border-zinc-800 border-t p-1.5">
            <button
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left font-medium text-[var(--color-voltage)] text-sm transition-colors hover:bg-[var(--color-voltage)]/10"
              onClick={() => {
                combobox.closeDropdown();
                onCreateCustomer();
              }}
              type="button"
            >
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[var(--color-voltage)]/15">
                <Plus className="size-4" />
              </span>
              Crear nuevo cliente
            </button>
          </div>
        ) : null}
      </Combobox.Dropdown>
    </Combobox>
  );
}
