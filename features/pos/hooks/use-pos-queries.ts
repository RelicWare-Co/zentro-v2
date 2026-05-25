import {
  useCustomersSearch,
  useCreateCustomerMutation as useZeroCreateCustomerMutation,
} from "@/features/customers/hooks/use-customers";

export function usePosCustomers() {
  return useCustomersSearch("", 100);
}

export function useCreateCustomerMutation() {
  return useZeroCreateCustomerMutation();
}
