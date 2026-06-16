import "./tailwind.css";
import type { ReactNode } from "react";
import { usePageContext } from "vike-react/usePageContext";
import { AppLayout } from "@/components/app-layout";
import { Toaster } from "@/components/ui/sonner";
import { OrganizationTransitionProvider } from "@/features/organization/organization-transition-context";
import { TanstackQueryProvider } from "@/lib/query-provider";
import { ZeroProviderGate } from "@/zero/zero-provider-gate.client";

export default function Layout({ children }: { children: React.ReactNode }) {
  const pageContext = usePageContext();
  const isAuthPage =
    pageContext.urlPathname === "/login" || pageContext.urlPathname === "/join";

  let content: ReactNode;

  if (isAuthPage) {
    content = <ZeroProviderGate allowAnonymous>{children}</ZeroProviderGate>;
  } else {
    content = (
      <ZeroProviderGate>
        <AppLayout>{children}</AppLayout>
      </ZeroProviderGate>
    );
  }

  return (
    <TanstackQueryProvider>
      <OrganizationTransitionProvider>{content}</OrganizationTransitionProvider>
      <Toaster richColors />
    </TanstackQueryProvider>
  );
}
