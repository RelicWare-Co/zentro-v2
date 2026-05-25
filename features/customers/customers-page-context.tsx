import {
  createContext,
  type ReactNode,
  use,
  useCallback,
  useMemo,
  useState,
} from "react";
import type { CustomerSavePayload } from "@/features/customers/customers-form.shared";
import {
  type Customer,
  useCreateCustomerMutation,
  useCustomersSearch,
  useDeleteCustomerMutation,
  useUpdateCustomerMutation,
} from "@/features/customers/hooks/use-customers";

export type CustomersPageOverlay =
  | { type: "form"; customerId?: string }
  | { type: "delete"; customerId: string };

export interface CustomersPageState {
  activeOverlay: CustomersPageOverlay | null;
  customers: Customer[];
  customerToDelete: Customer | null;
  editingCustomer: Customer | null;
  isError: boolean;
  isPending: boolean;
  isSearching: boolean;
  searchQuery: string;
  total: number;
}

export interface CustomersPageActions {
  closeOverlay: () => void;
  confirmDelete: () => Promise<void>;
  openCreate: () => void;
  openDelete: (customer: Customer) => void;
  openEdit: (customer: Customer) => void;
  refetch: () => void;
  saveCustomer: (payload: CustomerSavePayload) => Promise<void>;
  setSearchQuery: (value: string) => void;
}

export interface CustomersPageMeta {
  customersError: unknown;
  formError: unknown;
  isDeletePending: boolean;
  isFormPending: boolean;
}

export interface CustomersPageContextValue {
  actions: CustomersPageActions;
  meta: CustomersPageMeta;
  state: CustomersPageState;
}

const CustomersPageContext = createContext<CustomersPageContextValue | null>(
  null
);

export function useCustomersPage() {
  const context = use(CustomersPageContext);
  if (!context) {
    throw new Error(
      "useCustomersPage must be used within CustomersPageProvider."
    );
  }
  return context;
}

function findCustomerById(
  customers: Customer[],
  customerId: string | undefined
) {
  if (!customerId) {
    return null;
  }
  return customers.find((customer) => customer.id === customerId) ?? null;
}

export function CustomersPageProvider({ children }: { children: ReactNode }) {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeOverlay, setActiveOverlay] =
    useState<CustomersPageOverlay | null>(null);

  const customersQuery = useCustomersSearch(searchQuery);
  const customers = customersQuery.data?.data ?? [];
  const total = customersQuery.data?.total ?? 0;

  const createMutation = useCreateCustomerMutation();
  const updateMutation = useUpdateCustomerMutation();
  const deleteMutation = useDeleteCustomerMutation();

  const editingCustomer =
    activeOverlay?.type === "form"
      ? findCustomerById(customers, activeOverlay.customerId)
      : null;

  const customerToDelete =
    activeOverlay?.type === "delete"
      ? findCustomerById(customers, activeOverlay.customerId)
      : null;

  const openCreate = useCallback(() => {
    setActiveOverlay({ type: "form" });
  }, []);

  const openEdit = useCallback((customer: Customer) => {
    setActiveOverlay({ type: "form", customerId: customer.id });
  }, []);

  const openDelete = useCallback((customer: Customer) => {
    setActiveOverlay({ type: "delete", customerId: customer.id });
  }, []);

  const closeOverlay = useCallback(() => {
    setActiveOverlay(null);
  }, []);

  const saveCustomer = useCallback(
    async (payload: CustomerSavePayload) => {
      if (payload.id) {
        await updateMutation.mutateAsync({
          id: payload.id,
          ...payload,
        });
      } else {
        await createMutation.mutateAsync(payload);
      }
      setActiveOverlay(null);
    },
    [createMutation, updateMutation]
  );

  const confirmDelete = useCallback(async () => {
    if (!customerToDelete) {
      return;
    }
    await deleteMutation.mutateAsync({ id: customerToDelete.id });
    setActiveOverlay(null);
  }, [customerToDelete, deleteMutation]);

  const refetch = useCallback(() => {
    customersQuery.refetch().catch(() => undefined);
  }, [customersQuery]);

  const value = useMemo<CustomersPageContextValue>(
    () => ({
      state: {
        activeOverlay,
        customers,
        editingCustomer,
        customerToDelete,
        isError: customersQuery.isError,
        isPending: customersQuery.isPending,
        isSearching: customersQuery.isSearching,
        searchQuery,
        total,
      },
      actions: {
        closeOverlay,
        confirmDelete,
        openCreate,
        openDelete,
        openEdit,
        refetch,
        saveCustomer,
        setSearchQuery,
      },
      meta: {
        customersError: customersQuery.error,
        formError: createMutation.error ?? updateMutation.error,
        isDeletePending: deleteMutation.isPending,
        isFormPending: createMutation.isPending || updateMutation.isPending,
      },
    }),
    [
      activeOverlay,
      closeOverlay,
      confirmDelete,
      createMutation.error,
      createMutation.isPending,
      customerToDelete,
      customers,
      customersQuery.error,
      customersQuery.isError,
      customersQuery.isPending,
      customersQuery.isSearching,
      deleteMutation.isPending,
      editingCustomer,
      openCreate,
      openDelete,
      openEdit,
      refetch,
      saveCustomer,
      searchQuery,
      total,
      updateMutation.error,
      updateMutation.isPending,
    ]
  );

  return <CustomersPageContext value={value}>{children}</CustomersPageContext>;
}
