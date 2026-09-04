import { useState } from "react";
import { useCustomersSearch } from "@/features/customers/hooks/use-customers";
import { CustomerPicker } from "@/features/pos/components/customer-picker";
import { usePosCustomer } from "@/features/pos/pos-customer-context";

interface PosCustomerPickerProps {
  buttonClassName?: string;
  contentClassName?: string;
  onCreateCustomer?: () => void;
  searchPlaceholder?: string;
  showIcon?: boolean;
}

/**
 * POS customer picker with server-side search over the full customer table
 * (name, document, phone, email), so customers beyond the first hundred are
 * selectable. The selected customer is resolved independently of the current
 * search results page via `useCustomerById`.
 */
export function PosCustomerPicker({
  buttonClassName,
  contentClassName,
  onCreateCustomer,
  searchPlaceholder,
  showIcon = true,
}: PosCustomerPickerProps) {
  const { selectedCustomer, selectedCustomerId, setSelectedCustomerId } =
    usePosCustomer();
  const [search, setSearch] = useState("");
  const { data: customersData } = useCustomersSearch(search, 100);
  const customers = customersData?.data ?? [];

  return (
    <CustomerPicker
      buttonClassName={buttonClassName}
      contentClassName={contentClassName}
      customers={customers}
      onCreateCustomer={onCreateCustomer}
      onCustomerChange={setSelectedCustomerId}
      onSearchChange={setSearch}
      searchPlaceholder={searchPlaceholder}
      searchValue={search}
      selectedCustomer={selectedCustomer}
      selectedCustomerId={selectedCustomerId}
      showIcon={showIcon}
    />
  );
}
