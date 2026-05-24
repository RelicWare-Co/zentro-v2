import type { ReactNode } from "react";
import { CreditAccountsPanel } from "@/features/credit/components/credit-accounts-panel";
import { CreditLedgerSheet } from "@/features/credit/components/credit-ledger-sheet";
import { CreditPageHeader } from "@/features/credit/components/credit-page-header";
import {
  CreditPageError,
  CreditPageLoading,
} from "@/features/credit/components/credit-page-states";
import { CreditPaymentSheet } from "@/features/credit/components/credit-payment-sheet";
import {
  CreditPageProvider,
  useCreditPage,
} from "@/features/credit/credit-page-context";

function CreditPageRoot({ children }: { children: ReactNode }) {
  return (
    <main className="space-y-6 bg-[var(--color-void)] p-6 text-[var(--color-photon)] md:p-8 lg:p-12">
      {children}
    </main>
  );
}

function CreditPageLayout() {
  const { state } = useCreditPage();

  if (state.isPending) {
    return <CreditPageLoading />;
  }

  if (state.isError) {
    return <CreditPageError />;
  }

  return (
    <>
      <CreditPageRoot>
        <CreditPageHeader />
        <CreditAccountsPanel />
      </CreditPageRoot>
      <CreditLedgerSheet />
      <CreditPaymentSheet />
    </>
  );
}

export function CreditPage() {
  return (
    <CreditPageProvider>
      <CreditPageLayout />
    </CreditPageProvider>
  );
}

export const CreditPageCompound = {
  Provider: CreditPageProvider,
  Root: CreditPageRoot,
  Header: CreditPageHeader,
  AccountsPanel: CreditAccountsPanel,
  LedgerSheet: CreditLedgerSheet,
  PaymentSheet: CreditPaymentSheet,
  Loading: CreditPageLoading,
  Error: CreditPageError,
};
