import "./Layout.css";

import "./tailwind.css";
import logoUrl from "../assets/logo.svg";
import { Link } from "../components/Link";
import { usePageContext } from "vike-react/usePageContext";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "../lib/query-client";

export default function Layout({ children }: { children: React.ReactNode }) {
  const pageContext = usePageContext();
  const isAuthPage = pageContext.urlPathname === "/login" || pageContext.urlPathname === "/join";

  if (isAuthPage) {
    return (
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <div className={"flex max-w-5xl m-auto"}>
        <Sidebar>
          <Logo />
          <Link href="/">Welcome</Link>
          <Link href="/star-wars">Data Fetching</Link>
          {pageContext.user ? (
            <>
              <Link href="/dashboard">Dashboard</Link>
            </>
          ) : (
            <Link href="/login">Iniciar sesión</Link>
          )}
        </Sidebar>
        <Content>{children}</Content>
      </div>
    </QueryClientProvider>
  );
}

function Sidebar({ children }: { children: React.ReactNode }) {
  return (
    <div id="sidebar" className={"p-5 flex flex-col shrink-0 border-r-2 border-r-gray-200"}>
      {children}
    </div>
  );
}

function Content({ children }: { children: React.ReactNode }) {
  return (
    <div id="page-container">
      <div id="page-content" className={"p-5 pb-12 min-h-screen"}>
        {children}
      </div>
    </div>
  );
}

function Logo() {
  return (
    <div className={"p-5 mb-2"}>
      <a href="/">
        <img src={logoUrl} height={64} width={64} alt="logo" />
      </a>
    </div>
  );
}
