import {
  createContext,
  type ReactNode,
  use,
  useCallback,
  useMemo,
  useState,
} from "react";
import type { z } from "zod";
import { useOrganizationManagement } from "@/features/organization/hooks/use-organization";
import {
  ORGANIZATION_TAB_VALUES,
  type OrganizationTab,
} from "@/features/organization/organization-page.constants.shared";
import { authClient } from "@/lib/auth-client";
import { usePageZeroContext } from "@/lib/use-page-zero-context";
import type { OrganizationManagementSchema } from "@/schemas/organization";

export type OrganizationManagementData = z.infer<
  typeof OrganizationManagementSchema
>;

export type FeedbackType = "success" | "error";

export interface OrganizationPageState {
  activeTab: OrganizationTab;
  data: OrganizationManagementData | undefined;
  error: unknown;
  feedbackMessage: string | null;
  feedbackType: FeedbackType;
  isActiveOrgPending: boolean;
  isError: boolean;
  isPending: boolean;
}

export interface OrganizationPageActions {
  clearFeedback: () => void;
  refetchManagement: () => Promise<unknown>;
  setActiveTab: (tab: OrganizationTab) => void;
  setFeedback: (message: string | null, type?: FeedbackType) => void;
}

export interface OrganizationPageMeta {
  activeOrganization: ReturnType<
    typeof authClient.useActiveOrganization
  >["data"];
}

export interface OrganizationPageContextValue {
  actions: OrganizationPageActions;
  meta: OrganizationPageMeta;
  state: OrganizationPageState;
}

const OrganizationPageContext =
  createContext<OrganizationPageContextValue | null>(null);

export function useOrganizationPage() {
  const context = use(OrganizationPageContext);
  if (!context) {
    throw new Error(
      "useOrganizationPage must be used within OrganizationPageProvider."
    );
  }
  return context;
}

export function OrganizationPageProvider({
  children,
}: {
  children: ReactNode;
}) {
  const { data: activeOrganization, isPending: isActiveOrgPending } =
    authClient.useActiveOrganization();
  const zeroContext = usePageZeroContext();
  const managementQuery = useOrganizationManagement();
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
  const [feedbackType, setFeedbackType] = useState<FeedbackType>("success");
  const [activeTab, setActiveTabState] = useState<OrganizationTab>("general");

  const hasStaleZeroContext =
    Boolean(activeOrganization) && !isActiveOrgPending && !zeroContext?.orgID;

  const setFeedback = useCallback(
    (message: string | null, type: FeedbackType = "success") => {
      setFeedbackMessage(message);
      setFeedbackType(type);
    },
    []
  );

  const clearFeedback = useCallback(() => {
    setFeedbackMessage(null);
  }, []);

  const setActiveTab = useCallback((tab: OrganizationTab) => {
    if (ORGANIZATION_TAB_VALUES.includes(tab)) {
      setActiveTabState(tab);
    }
  }, []);

  const refetchManagement = useCallback(
    () => managementQuery.refetch(),
    [managementQuery]
  );

  const value = useMemo<OrganizationPageContextValue>(
    () => ({
      state: {
        activeTab,
        data: managementQuery.data,
        error: managementQuery.error,
        feedbackMessage,
        feedbackType,
        isActiveOrgPending,
        isError: managementQuery.isError,
        isPending: managementQuery.isPending || hasStaleZeroContext,
      },
      actions: {
        setActiveTab,
        setFeedback,
        clearFeedback,
        refetchManagement,
      },
      meta: {
        activeOrganization,
      },
    }),
    [
      activeTab,
      managementQuery.data,
      managementQuery.error,
      managementQuery.isError,
      managementQuery.isPending,
      feedbackMessage,
      feedbackType,
      isActiveOrgPending,
      hasStaleZeroContext,
      activeOrganization,
      setActiveTab,
      setFeedback,
      clearFeedback,
      refetchManagement,
    ]
  );

  return (
    <OrganizationPageContext value={value}>{children}</OrganizationPageContext>
  );
}
