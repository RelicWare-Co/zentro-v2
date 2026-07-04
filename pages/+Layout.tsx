// Mantine base styles must load before Tailwind so Tailwind utilities win in
// coexistence mode.
import "@mantine/core/styles.css";
import "@mantine/notifications/styles.css";
import "./tailwind.css";
import { MantineProvider } from "@mantine/core";
import { Notifications } from "@mantine/notifications";
import type { ReactNode } from "react";
import { usePageContext } from "vike-react/usePageContext";
import { AppLayout } from "@/components/app-layout";
import { OrganizationTransitionProvider } from "@/features/organization/organization-transition-context";
import { mantineCssVariablesResolver, mantineTheme } from "@/lib/mantine-theme";
import { TanstackQueryProvider } from "@/lib/query-provider";
import { ZeroProviderGate } from "@/zero/zero-provider-gate.client";

export default function Layout({ children }: { children: React.ReactNode }) {
  const pageContext = usePageContext();
  const isPublicMenuPage = pageContext.urlPathname.startsWith("/o/");
  const isAuthPage =
    pageContext.urlPathname === "/login" || pageContext.urlPathname === "/join";

  let content: ReactNode;

  if (isPublicMenuPage) {
    // /o is SSR with +data — no Zero, TanStack Query, or org context needed.
    content = children;
  } else if (isAuthPage) {
    content = <ZeroProviderGate allowAnonymous>{children}</ZeroProviderGate>;
  } else {
    content = (
      <ZeroProviderGate>
        <AppLayout>{children}</AppLayout>
      </ZeroProviderGate>
    );
  }

  if (isPublicMenuPage) {
    return (
      <MantineProvider
        cssVariablesResolver={mantineCssVariablesResolver}
        forceColorScheme="dark"
        theme={mantineTheme}
      >
        {children}
      </MantineProvider>
    );
  }

  return (
    <MantineProvider
      cssVariablesResolver={mantineCssVariablesResolver}
      forceColorScheme="dark"
      theme={mantineTheme}
    >
      <TanstackQueryProvider>
        <OrganizationTransitionProvider>
          {content}
        </OrganizationTransitionProvider>
        <Notifications position="top-right" />
      </TanstackQueryProvider>
    </MantineProvider>
  );
}
