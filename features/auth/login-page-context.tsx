import {
  createContext,
  type ReactNode,
  use,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { usePageContext } from "vike-react/usePageContext";
import type {
  JoinLinkPreview,
  LoginPageMode,
} from "@/features/auth/login-page.constants.shared";
import {
  useJoinLinkPreview,
  useJoinLinkRedeemMutation,
} from "@/features/organization/hooks/use-organization";
import { authClient } from "@/lib/auth-client";
import { queryClient } from "@/lib/query-client";
import { getErrorMessage } from "@/lib/utils";

function useJoinToken() {
  if (typeof window !== "undefined") {
    return new URLSearchParams(window.location.search).get("token");
  }
  return null;
}

export interface LoginPageState {
  hasSession: boolean;
  isCompletingJoin: boolean;
  isSessionPending: boolean;
  joinError: string | null;
  joinPreview: JoinLinkPreview | null;
  joinToken: string | null;
  mode: LoginPageMode;
  sessionEmail: string | null;
  sessionName: string | null;
}

export interface LoginPageActions {
  finishJoinFlow: () => Promise<boolean>;
  handleJoinWithCurrentAccount: () => Promise<void>;
  setMode: (mode: LoginPageMode) => void;
  signOutAndReload: () => Promise<void>;
}

export interface LoginPageMeta {
  canJoin: boolean;
}

export interface LoginPageContextValue {
  actions: LoginPageActions;
  meta: LoginPageMeta;
  state: LoginPageState;
}

const LoginPageContext = createContext<LoginPageContextValue | null>(null);

export function useLoginPage() {
  const context = use(LoginPageContext);
  if (!context) {
    throw new Error("useLoginPage must be used within LoginPageProvider.");
  }
  return context;
}

export function LoginPageProvider({ children }: { children: ReactNode }) {
  const pageContext = usePageContext();
  const joinToken = useJoinToken();
  const { data: sessionData, isPending: isSessionPending } =
    authClient.useSession();

  const [mode, setMode] = useState<LoginPageMode>("login");
  const [joinError, setJoinError] = useState<string | null>(null);
  const [isCompletingJoin, setIsCompletingJoin] = useState(false);

  const previewQuery = useJoinLinkPreview(joinToken);
  const redeemMutation = useJoinLinkRedeemMutation();
  const joinPreview = previewQuery.data ?? null;

  const finishJoinFlow = useCallback(async (): Promise<boolean> => {
    if (!joinToken) {
      return true;
    }

    const organizationId = joinPreview?.organization?.id;
    if (!organizationId) {
      setJoinError("No se pudo identificar la organización del enlace.");
      return false;
    }

    setJoinError(null);
    setIsCompletingJoin(true);

    try {
      await redeemMutation.mutateAsync({ token: joinToken });
      await authClient.organization.setActive({
        organizationId,
      });
      queryClient.clear();
      return true;
    } catch (error: unknown) {
      setJoinError(
        getErrorMessage(
          error,
          "No se pudo completar el acceso con este enlace."
        )
      );
      return false;
    } finally {
      setIsCompletingJoin(false);
    }
  }, [joinPreview?.organization?.id, joinToken, redeemMutation]);

  const handleJoinWithCurrentAccount = useCallback(async () => {
    const shouldContinue = await finishJoinFlow();
    if (shouldContinue) {
      window.location.href = "/dashboard";
    }
  }, [finishJoinFlow]);

  const signOutAndReload = useCallback(async () => {
    await authClient.signOut();
    window.location.reload();
  }, []);

  useEffect(() => {
    const user = pageContext.user ?? sessionData?.user;
    if (user && !joinToken && typeof window !== "undefined") {
      window.location.href = "/dashboard";
    }
  }, [pageContext.user, sessionData, joinToken]);

  const value = useMemo<LoginPageContextValue>(
    () => ({
      state: {
        isCompletingJoin,
        isSessionPending,
        joinError,
        joinPreview,
        joinToken,
        mode,
        sessionEmail: sessionData?.user.email ?? null,
        sessionName: sessionData?.user.name ?? null,
        hasSession: Boolean(sessionData),
      },
      actions: {
        finishJoinFlow,
        handleJoinWithCurrentAccount,
        setMode,
        signOutAndReload,
      },
      meta: {
        canJoin: Boolean(joinPreview?.canJoin),
      },
    }),
    [
      finishJoinFlow,
      handleJoinWithCurrentAccount,
      isCompletingJoin,
      isSessionPending,
      joinError,
      joinPreview,
      joinToken,
      mode,
      sessionData,
      signOutAndReload,
    ]
  );

  return <LoginPageContext value={value}>{children}</LoginPageContext>;
}
