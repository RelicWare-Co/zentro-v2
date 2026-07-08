// Mantine base styles must load before Tailwind so Tailwind utilities win in
// coexistence mode.
import "@mantine/core/styles.css";
import "@mantine/notifications/styles.css";
import "./tailwind.css";
import { MantineProvider } from "@mantine/core";
import { Notifications } from "@mantine/notifications";
import { type ComponentType, type ReactNode, useEffect, useState } from "react";
import { usePageContext } from "vike-react/usePageContext";
import { AppLayout } from "@/components/app-layout";
import { OrganizationTransitionProvider } from "@/features/organization/organization-transition-context";
import { mantineCssVariablesResolver, mantineTheme } from "@/lib/mantine-theme";
import { TanstackQueryProvider } from "@/lib/query-provider";

interface ZeroProviderGateProps {
  allowAnonymous?: boolean;
  children: ReactNode;
}

function ClientZeroProviderGate(props: ZeroProviderGateProps) {
  const [Component, setComponent] =
    useState<ComponentType<ZeroProviderGateProps> | null>(null);

  useEffect(() => {
    let cancelled = false;

    import("@/zero/zero-provider-gate.client").then((module) => {
      if (!cancelled) {
        setComponent(() => module.ZeroProviderGate);
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  return Component ? <Component {...props} /> : null;
}

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
    content = (
      <ClientZeroProviderGate allowAnonymous>{children}</ClientZeroProviderGate>
    );
  } else {
    content = (
      <ClientZeroProviderGate>
        <AppLayout>{children}</AppLayout>
      </ClientZeroProviderGate>
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
