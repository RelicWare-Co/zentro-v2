import { createContext, type ReactNode, use, useMemo } from "react";
import {
  type DashboardOverview,
  useDashboardOverview,
} from "@/features/dashboard/hooks/use-dashboard-overview";

export interface DashboardPageState {
  data: DashboardOverview | undefined;
  isError: boolean;
  isPending: boolean;
}

export interface DashboardPageContextValue {
  state: DashboardPageState;
}

const DashboardPageContext = createContext<DashboardPageContextValue | null>(
  null
);

export function useDashboardPage() {
  const context = use(DashboardPageContext);
  if (!context) {
    throw new Error(
      "useDashboardPage must be used within DashboardPageProvider."
    );
  }
  return context;
}

export function useDashboardData() {
  const { state } = useDashboardPage();
  if (!state.data) {
    throw new Error("Dashboard data is not available.");
  }
  return state.data;
}

export function DashboardPageProvider({ children }: { children: ReactNode }) {
  const overviewQuery = useDashboardOverview();

  const value = useMemo<DashboardPageContextValue>(
    () => ({
      state: {
        data: overviewQuery.data,
        isPending: overviewQuery.isPending,
        isError: overviewQuery.isError,
      },
    }),
    [overviewQuery.data, overviewQuery.isError, overviewQuery.isPending]
  );

  return <DashboardPageContext value={value}>{children}</DashboardPageContext>;
}
