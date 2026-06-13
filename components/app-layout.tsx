import {
  Building2,
  ChefHat,
  ChevronLeft,
  ChevronRight,
  Clock3,
  LayoutDashboard,
  Loader2,
  LogOut,
  Menu,
  Package,
  Receipt,
  Settings,
  Shield,
  Store,
  Users,
  UtensilsCrossed,
  VenetianMask,
  Wallet,
} from "lucide-react";
import { useState } from "react";
import { usePageContext } from "vike-react/usePageContext";
import { OrganizationSelection } from "@/components/organization-selection";
import { getImpersonatedBy } from "@/features/admin/admin.shared";
import { useModuleCapabilities } from "@/features/modules/hooks/use-module-capabilities";
import { useOrganizationTransition } from "@/features/organization/organization-transition-context";
import { authClient } from "@/lib/auth-client";
import { queryClient } from "@/lib/query-client";
import { usePageZeroContext } from "@/lib/use-page-zero-context";
import { cn } from "@/lib/utils";

const moduleIconMap = {
  "chef-hat": ChefHat,
  "utensils-crossed": UtensilsCrossed,
} as const;

const FULL_HEIGHT_ROUTES = new Set(["/pos", "/posv2"]);

function isFullHeightRoute(pathname: string) {
  return FULL_HEIGHT_ROUTES.has(pathname);
}

function shouldWaitForActiveOrganization(params: {
  hasActiveZeroOrganization: boolean;
  isActiveOrgPending: boolean;
  isOrganizationRoute: boolean;
}) {
  if (params.isOrganizationRoute && !params.hasActiveZeroOrganization) {
    return false;
  }

  return params.isActiveOrgPending && !params.hasActiveZeroOrganization;
}

function hasAnyActiveOrganization(params: {
  activeOrganization: ReturnType<
    typeof authClient.useActiveOrganization
  >["data"];
  hasActiveZeroOrganization: boolean;
  isActiveOrgPending: boolean;
}) {
  if (params.hasActiveZeroOrganization) {
    return true;
  }

  if (params.isActiveOrgPending) {
    return Boolean(params.activeOrganization);
  }

  return false;
}

function getActiveOrganizationName(
  activeOrganization: ReturnType<
    typeof authClient.useActiveOrganization
  >["data"]
) {
  return activeOrganization?.name ?? "Organización activa";
}

const baseNavItems = [
  {
    name: "Dashboard",
    path: "/dashboard",
    icon: LayoutDashboard,
    order: 10,
  },
  {
    name: "Organización",
    path: "/organization",
    icon: Users,
    order: 20,
  },
  { name: "POS", path: "/pos", icon: Store, order: 30 },
  { name: "Turnos", path: "/shifts", icon: Clock3, order: 40 },
  { name: "Ventas", path: "/sales", icon: Receipt, order: 50 },
  { name: "Clientes", path: "/customers", icon: Users, order: 55 },
  { name: "Crédito", path: "/credit", icon: Wallet, order: 56 },
  { name: "Productos", path: "/products", icon: Package, order: 60 },
  { name: "Configuración", path: "/settings", icon: Settings, order: 70 },
];

function ImpersonationBanner() {
  const { data: sessionData } = authClient.useSession();
  const [isStopping, setIsStopping] = useState(false);

  if (!getImpersonatedBy(sessionData?.session)) {
    return null;
  }

  const handleStop = async () => {
    setIsStopping(true);
    try {
      await authClient.admin.stopImpersonating();
      queryClient.clear();
      window.location.href = "/admin";
    } catch {
      setIsStopping(false);
    }
  };

  return (
    <div className="flex shrink-0 items-center justify-between gap-3 border-amber-400/20 border-b bg-amber-400/10 px-4 py-2 text-amber-200">
      <div className="flex min-w-0 items-center gap-2 text-sm">
        <VenetianMask className="size-4 shrink-0" />
        <span className="truncate">
          Estás suplantando a {sessionData?.user?.name ?? "otro usuario"}.
        </span>
      </div>
      <button
        className="shrink-0 rounded-lg border border-amber-400/30 px-3 py-1 font-medium text-sm transition-colors hover:bg-amber-400/10"
        disabled={isStopping}
        onClick={() => {
          handleStop().catch(() => undefined);
        }}
        type="button"
      >
        {isStopping ? "Volviendo…" : "Volver a mi cuenta"}
      </button>
    </div>
  );
}

export function AppLayout({ children }: { children: React.ReactNode }) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const pageContext = usePageContext();
  const { data: activeOrganization, isPending: isActiveOrgPending } =
    authClient.useActiveOrganization();
  const { data: capabilities } = useModuleCapabilities();
  const { runOrganizationTransition } = useOrganizationTransition();
  const zeroContext = usePageZeroContext();
  const hasActiveZeroOrganization = Boolean(zeroContext?.orgID);

  const isOrganizationRoute = pageContext.urlPathname === "/organization";

  if (
    shouldWaitForActiveOrganization({
      hasActiveZeroOrganization,
      isActiveOrgPending,
      isOrganizationRoute,
    })
  ) {
    return (
      <div className="app-safe-area flex min-h-[100dvh] w-full items-center justify-center bg-[var(--color-void)] text-[var(--color-photon)]">
        <Loader2 className="size-8 animate-spin text-[var(--color-voltage)]" />
      </div>
    );
  }

  if (
    !hasAnyActiveOrganization({
      activeOrganization,
      hasActiveZeroOrganization,
      isActiveOrgPending,
    })
  ) {
    return <OrganizationSelection />;
  }

  const moduleNavItems = capabilities?.modules
    ? Object.values(capabilities.modules).flatMap((moduleAccess) =>
        moduleAccess.navigation.map((item) => ({
          name: item.label,
          path: item.path,
          icon: moduleIconMap[item.icon as keyof typeof moduleIconMap] ?? Store,
          order: item.order,
        }))
      )
    : [];
  const adminNavItems =
    zeroContext?.systemRole === "admin"
      ? [{ name: "Admin", path: "/admin", icon: Shield, order: 65 }]
      : [];
  const navItems = [...baseNavItems, ...moduleNavItems, ...adminNavItems].sort(
    (left, right) => left.order - right.order
  );
  const lockMainScroll = isFullHeightRoute(pageContext.urlPathname);

  return (
    <div className="app-safe-area flex h-dvh max-h-dvh overflow-hidden bg-[var(--color-void)] text-[var(--color-photon)]">
      {isSidebarOpen ? (
        <button
          aria-label="Cerrar navegación"
          className="fixed inset-0 z-40 size-full cursor-default border-none bg-black/50 lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
          type="button"
        />
      ) : null}

      <aside
        className={cn(
          "fixed left-0 z-50 flex h-[100dvh] shrink-0 flex-col border-zinc-800 border-r bg-[var(--color-carbon)] pt-[var(--safe-area-top)] pb-[var(--safe-area-bottom)] transition-all duration-300 ease-in-out lg:sticky lg:top-0 lg:translate-x-0",
          isCollapsed ? "w-64 lg:w-20" : "w-64",
          isSidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex h-16 shrink-0 items-center overflow-hidden whitespace-nowrap border-zinc-800 border-b px-5">
          <a
            className={cn(
              "block overflow-hidden font-bold text-2xl text-[var(--color-voltage)] tracking-tight transition-all duration-300",
              isCollapsed
                ? "w-[120px] opacity-100 lg:pointer-events-none lg:w-0 lg:opacity-0"
                : "w-[120px] opacity-100"
            )}
            href="/dashboard"
          >
            Zentro
          </a>
          <button
            aria-label={
              isCollapsed ? "Expandir barra lateral" : "Colapsar barra lateral"
            }
            className="ml-auto hidden items-center justify-center rounded-lg p-2 text-zinc-400 transition-colors hover:bg-white/5 hover:text-white lg:flex"
            onClick={() => setIsCollapsed((current) => !current)}
            type="button"
          >
            {isCollapsed ? (
              <ChevronRight className="size-5" />
            ) : (
              <ChevronLeft className="size-5" />
            )}
          </button>
        </div>

        <div
          className={cn(
            "shrink-0 border-zinc-800 border-b p-4",
            isCollapsed && "lg:px-2"
          )}
        >
          <button
            className={cn(
              "group flex w-full items-center overflow-hidden rounded-xl border border-zinc-700 bg-zinc-900/50 px-3 py-2.5 text-left transition-all hover:border-zinc-600 hover:bg-zinc-800/50",
              isCollapsed && "lg:justify-center lg:px-0"
            )}
            onClick={async () => {
              try {
                await runOrganizationTransition({
                  destination: "/organization",
                  message: "Abriendo selector de organización...",
                  prepare: async () => {
                    const result = await authClient.organization.setActive({
                      organizationId: null,
                    });
                    if (result?.error) {
                      throw new Error(
                        result.error.message ||
                          "No se pudo abrir el selector de organización."
                      );
                    }
                  },
                });
              } catch {
                // Toast handled by transition helper.
              }
            }}
            title={isCollapsed ? "Cambiar organización" : undefined}
            type="button"
          >
            <div className="flex size-6 shrink-0 items-center justify-center rounded bg-[var(--color-voltage)]/10 text-[var(--color-voltage)] transition-colors group-hover:bg-[var(--color-voltage)]/20">
              <Building2 className="size-3.5" />
            </div>
            <div
              className={cn(
                "overflow-hidden transition-all duration-300",
                isCollapsed
                  ? "ml-3 w-auto opacity-100 lg:ml-0 lg:w-0 lg:flex-none lg:opacity-0"
                  : "ml-3 w-auto flex-1 opacity-100"
              )}
            >
              <p className="truncate font-medium text-sm text-white">
                {getActiveOrganizationName(activeOrganization)}
              </p>
              <p className="truncate text-xs text-zinc-500">Cambiar</p>
            </div>
          </button>
        </div>

        <nav
          className={cn(
            "no-scrollbar min-h-0 flex-1 space-y-2 overflow-y-auto px-4 py-6",
            isCollapsed && "lg:px-2"
          )}
        >
          {navItems.map((item) => {
            const isActive =
              item.path === "/dashboard"
                ? pageContext.urlPathname === item.path
                : pageContext.urlPathname.startsWith(item.path);
            const Icon = item.icon;

            return (
              <a
                className={cn(
                  "flex items-center whitespace-nowrap rounded-xl px-3 py-2.5 font-medium transition-colors",
                  isActive
                    ? "bg-[var(--color-voltage)]/10 text-[var(--color-voltage)]"
                    : "text-zinc-400 hover:bg-white/5 hover:text-white",
                  isCollapsed && "lg:justify-center lg:px-0"
                )}
                href={item.path}
                key={item.path}
                onClick={() => setIsSidebarOpen(false)}
                title={isCollapsed ? item.name : undefined}
              >
                <Icon className="size-5 shrink-0" />
                <span
                  className={cn(
                    "overflow-hidden transition-all duration-300",
                    isCollapsed
                      ? "ml-3 w-[140px] opacity-100 lg:ml-0 lg:w-0 lg:opacity-0"
                      : "ml-3 w-[140px] opacity-100"
                  )}
                >
                  {item.name}
                </span>
              </a>
            );
          })}
        </nav>

        <div
          className={cn(
            "overflow-hidden border-zinc-800 border-t p-4",
            isCollapsed && "lg:px-2"
          )}
        >
          <button
            className={cn(
              "flex w-full items-center whitespace-nowrap rounded-xl px-3 py-2.5 font-medium text-zinc-400 transition-colors hover:bg-white/5 hover:text-white",
              isCollapsed && "lg:justify-center lg:px-0"
            )}
            onClick={async () => {
              await authClient.signOut();
              queryClient.clear();
              window.location.href = "/login";
            }}
            title={isCollapsed ? "Cerrar sesión" : undefined}
            type="button"
          >
            <LogOut className="size-5 shrink-0" />
            <span
              className={cn(
                "overflow-hidden text-left transition-all duration-300",
                isCollapsed
                  ? "ml-3 w-[140px] opacity-100 lg:ml-0 lg:w-0 lg:opacity-0"
                  : "ml-3 w-[140px] opacity-100"
              )}
            >
              Cerrar sesión
            </span>
          </button>
        </div>
      </aside>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <ImpersonationBanner />
        <header className="flex h-16 shrink-0 items-center border-zinc-800 border-b bg-[var(--color-carbon)] px-4 lg:hidden">
          <button
            aria-label="Abrir navegación"
            className="-ml-2 p-2 text-zinc-400 hover:text-white"
            onClick={() => setIsSidebarOpen(true)}
            type="button"
          >
            <Menu className="size-6" />
          </button>
          <span className="ml-4 font-bold text-[var(--color-voltage)] text-xl">
            Zentro
          </span>
        </header>

        <main
          className={cn(
            "flex min-h-0 flex-1 flex-col",
            lockMainScroll ? "relative overflow-hidden" : "overflow-auto"
          )}
        >
          {children}
        </main>
      </div>
    </div>
  );
}
