import { QueryClient } from "@tanstack/react-query";

/** Shared cache for REST reads (dashboard, join-link preview) and Zero mutation hooks. */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
    },
  },
});
