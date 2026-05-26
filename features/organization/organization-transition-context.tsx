import { Loader2 } from "lucide-react";
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
import { queryClient } from "@/lib/query-client";
import type { ZeroContext } from "@/src/zero/context";

export interface OrganizationTransitionOptions {
  destination?: string;
  message?: string;
  prepare: () => Promise<void>;
}

export interface OrganizationTransitionContextValue {
  isTransitioning: boolean;
  runOrganizationTransition: (
    options: OrganizationTransitionOptions
  ) => Promise<void>;
  zeroContext: ZeroContext | null;
}

const OrganizationTransitionContext =
  createContext<OrganizationTransitionContextValue | null>(null);

function OrganizationTransitionOverlay({ message }: { message: string }) {
  return (
    <div
      aria-live="polite"
      className="fixed inset-0 z-[100] flex items-center justify-center bg-[var(--color-void)]/95 text-[var(--color-photon)] backdrop-blur-[2px]"
    >
      <div className="flex flex-col items-center gap-3 px-6 text-center">
        <Loader2 className="size-8 animate-spin text-[var(--color-voltage)]" />
        <p className="max-w-sm text-sm text-zinc-400">{message}</p>
      </div>
    </div>
  );
}

export function useOrganizationTransition() {
  const context = use(OrganizationTransitionContext);
  if (!context) {
    throw new Error(
      "useOrganizationTransition must be used within OrganizationTransitionProvider."
    );
  }
  return context;
}

export function OrganizationTransitionProvider({
  children,
}: {
  children: ReactNode;
}) {
  const pageContext = usePageContext();
  const [zeroContext, setZeroContext] = useState<ZeroContext | null>(
    pageContext.zeroContext ?? null
  );
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [message, setMessage] = useState("Cambiando organización...");

  useEffect(() => {
    if (!pageContext.user) {
      setZeroContext(null);
      return;
    }

    if (pageContext.zeroContext) {
      setZeroContext(pageContext.zeroContext);
    }
  }, [pageContext.user, pageContext.zeroContext]);

  const refreshZeroContext = useCallback(async () => {
    const response = await fetch("/api/zero/context", {
      headers: {
        accept: "application/json",
      },
    });

    if (!response.ok) {
      throw new Error("No se pudo actualizar el contexto de Zero.");
    }

    const data = (await response.json()) as {
      zeroContext?: ZeroContext | null;
    };
    const nextContext = data.zeroContext ?? null;
    setZeroContext(nextContext);
    return nextContext;
  }, []);

  const runOrganizationTransition = useCallback(
    async ({
      destination = "/dashboard",
      message: transitionMessage = "Cambiando organización...",
      prepare,
    }: OrganizationTransitionOptions) => {
      setMessage(transitionMessage);
      setIsTransitioning(true);

      try {
        await prepare();
        queryClient.clear();
        const nextContext = await refreshZeroContext();

        if (window.location.pathname !== destination) {
          const { navigate } = await import("vike/client/router");
          await navigate(destination, {
            pageContext: {
              zeroContext: nextContext,
            },
          });
        }

        setIsTransitioning(false);
      } catch (error) {
        setIsTransitioning(false);
        throw error;
      }
    },
    [refreshZeroContext]
  );

  const value = useMemo(
    () => ({
      isTransitioning,
      runOrganizationTransition,
      zeroContext,
    }),
    [isTransitioning, runOrganizationTransition, zeroContext]
  );

  return (
    <OrganizationTransitionContext value={value}>
      {children}
      {isTransitioning ? (
        <OrganizationTransitionOverlay message={message} />
      ) : null}
    </OrganizationTransitionContext>
  );
}
