import type { ReactNode } from "react";
import { CustomerDeleteDialog } from "@/features/customers/components/customer-delete-dialog";
import { CustomerFormSheet } from "@/features/customers/components/customer-form-sheet";
import { CustomersListPanel } from "@/features/customers/components/customers-list-panel";
import { CustomersPageHeader } from "@/features/customers/components/customers-page-header";
import {
  CustomersPageError,
  CustomersPageLoading,
} from "@/features/customers/components/customers-page-states";
import {
  CustomersPageProvider,
  useCustomersPage,
} from "@/features/customers/customers-page-context";

function CustomersPageRoot({ children }: { children: ReactNode }) {
  return (
    <main className="space-y-6 bg-[var(--color-void)] p-6 text-[var(--color-photon)] md:p-8 lg:p-12">
      {children}
    </main>
  );
}

function CustomersPageLayout() {
  const { state } = useCustomersPage();

  if (state.isPending) {
    return <CustomersPageLoading />;
  }

  if (state.isError) {
    return <CustomersPageError />;
  }

  return (
    <>
      <CustomersPageRoot>
        <CustomersPageHeader />
        <CustomersListPanel />
      </CustomersPageRoot>
      <CustomerFormSheet />
      <CustomerDeleteDialog />
    </>
  );
}

export function CustomersPage() {
  return (
    <CustomersPageProvider>
      <CustomersPageLayout />
    </CustomersPageProvider>
  );
}
