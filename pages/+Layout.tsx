import "./tailwind.css";
import { QueryClientProvider } from "@tanstack/react-query";
import { usePageContext } from "vike-react/usePageContext";
import { AppLayout } from "@/components/app-layout";
import { queryClient } from "@/lib/query-client";

export default function Layout({ children }: { children: React.ReactNode }) {
  const pageContext = usePageContext();
  const isAuthPage =
    pageContext.urlPathname === "/login" || pageContext.urlPathname === "/join";
  const isFullScreenPage =
    pageContext.urlPathname === "/pos" || pageContext.urlPathname === "/posv2";

  if (isAuthPage || isFullScreenPage) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <AppLayout>{children}</AppLayout>
    </QueryClientProvider>
  );
}
