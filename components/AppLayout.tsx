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
	Store,
	UtensilsCrossed,
	Users,
	Wallet,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { usePageContext } from "vike-react/usePageContext";
import { OrganizationSelection } from "@/components/OrganizationSelection";
import { authClient } from "@/lib/auth-client";
import { queryClient } from "@/lib/query-client";
import { cn } from "@/lib/utils";
import { orpcQuery } from "@/server/orpc/client/query";

const moduleIconMap = {
	"chef-hat": ChefHat,
	"utensils-crossed": UtensilsCrossed,
} as const;

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

export function AppLayout({ children }: { children: React.ReactNode }) {
	const [isSidebarOpen, setIsSidebarOpen] = useState(false);
	const [isCollapsed, setIsCollapsed] = useState(false);
	const pageContext = usePageContext();
	const { data: activeOrganization, isPending: isActiveOrgPending } =
		authClient.useActiveOrganization();
	const { data: capabilities } = useQuery({
		...orpcQuery.modules.capabilities.queryOptions(),
		enabled: Boolean(activeOrganization),
	});

	if (isActiveOrgPending) {
		return (
			<div className="app-safe-area flex min-h-[100dvh] w-full items-center justify-center bg-[var(--color-void)] text-[var(--color-photon)]">
				<Loader2 className="h-8 w-8 animate-spin text-[var(--color-voltage)]" />
			</div>
		);
	}

	if (!activeOrganization) {
		return <OrganizationSelection />;
	}

	const moduleNavItems =
		capabilities?.modules
			? Object.values(capabilities.modules).flatMap((moduleAccess) =>
					moduleAccess.navigation.map((item) => ({
						name: item.label,
						path: item.path,
						icon:
							moduleIconMap[item.icon as keyof typeof moduleIconMap] ?? Store,
						order: item.order,
					})),
				)
			: [];
	const navItems = [...baseNavItems, ...moduleNavItems].sort(
		(left, right) => left.order - right.order,
	);

	return (
		<div className="app-safe-area flex min-h-[100dvh] bg-[var(--color-void)] text-[var(--color-photon)]">
			{isSidebarOpen ? (
				<button
					type="button"
					className="fixed inset-0 z-40 h-full w-full cursor-default border-none bg-black/50 lg:hidden"
					onClick={() => setIsSidebarOpen(false)}
					aria-label="Cerrar navegación"
				/>
			) : null}

			<aside
				className={cn(
					"fixed left-0 z-50 flex h-[100dvh] shrink-0 flex-col border-r border-gray-800 bg-[var(--color-carbon)] pt-[var(--safe-area-top)] pb-[var(--safe-area-bottom)] transition-all duration-300 ease-in-out lg:sticky lg:top-0 lg:translate-x-0",
					isCollapsed ? "w-64 lg:w-20" : "w-64",
					isSidebarOpen ? "translate-x-0" : "-translate-x-full",
				)}
			>
				<div className="flex h-16 shrink-0 items-center overflow-hidden border-b border-gray-800 px-5 whitespace-nowrap">
					<a
						href="/dashboard"
						className={cn(
							"block overflow-hidden text-2xl font-bold tracking-tight text-[var(--color-voltage)] transition-all duration-300",
							isCollapsed
								? "w-[120px] opacity-100 lg:w-0 lg:pointer-events-none lg:opacity-0"
								: "w-[120px] opacity-100",
						)}
					>
						Zentro
					</a>
					<button
						type="button"
						onClick={() => setIsCollapsed((current) => !current)}
						className="ml-auto hidden items-center justify-center rounded-lg p-2 text-gray-400 transition-colors hover:bg-white/5 hover:text-white lg:flex"
						aria-label={
							isCollapsed ? "Expandir barra lateral" : "Colapsar barra lateral"
						}
					>
						{isCollapsed ? (
							<ChevronRight className="h-5 w-5" />
						) : (
							<ChevronLeft className="h-5 w-5" />
						)}
					</button>
				</div>

				<div
					className={cn(
						"shrink-0 border-b border-gray-800 p-4",
						isCollapsed && "lg:px-2",
					)}
				>
					<button
						type="button"
						onClick={async () => {
							await authClient.organization.setActive({ organizationId: null });
							queryClient.clear();
						}}
						className={cn(
							"group flex w-full items-center overflow-hidden rounded-xl border border-gray-700 bg-gray-900/50 px-3 py-2.5 text-left transition-all hover:border-gray-600 hover:bg-gray-800/50",
							isCollapsed && "lg:justify-center lg:px-0",
						)}
						title={isCollapsed ? "Cambiar organización" : undefined}
					>
						<div className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-[var(--color-voltage)]/10 text-[var(--color-voltage)] transition-colors group-hover:bg-[var(--color-voltage)]/20">
							<Building2 className="h-3.5 w-3.5" />
						</div>
						<div
							className={cn(
								"overflow-hidden transition-all duration-300",
								isCollapsed
									? "ml-3 w-auto opacity-100 lg:ml-0 lg:w-0 lg:flex-none lg:opacity-0"
									: "ml-3 w-auto flex-1 opacity-100",
							)}
						>
							<p className="truncate text-sm font-medium text-white">
								{activeOrganization.name || "Sin organización"}
							</p>
							<p className="truncate text-xs text-gray-500">Cambiar</p>
						</div>
					</button>
				</div>

				<nav
					className={cn(
						"flex-1 min-h-0 space-y-2 overflow-y-auto no-scrollbar px-4 py-6",
						isCollapsed && "lg:px-2",
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
								key={item.path}
								href={item.path}
								className={cn(
									"flex items-center rounded-xl px-3 py-2.5 font-medium whitespace-nowrap transition-colors",
									isActive
										? "bg-[var(--color-voltage)]/10 text-[var(--color-voltage)]"
										: "text-gray-400 hover:bg-white/5 hover:text-white",
									isCollapsed && "lg:justify-center lg:px-0",
								)}
								onClick={() => setIsSidebarOpen(false)}
								title={isCollapsed ? item.name : undefined}
							>
								<Icon className="h-5 w-5 shrink-0" />
								<span
									className={cn(
										"overflow-hidden transition-all duration-300",
										isCollapsed
											? "ml-3 w-[140px] opacity-100 lg:ml-0 lg:w-0 lg:opacity-0"
											: "ml-3 w-[140px] opacity-100",
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
						"overflow-hidden border-t border-gray-800 p-4",
						isCollapsed && "lg:px-2",
					)}
				>
					<button
						type="button"
						onClick={async () => {
							await authClient.signOut();
							queryClient.clear();
							window.location.href = "/login";
						}}
						className={cn(
							"flex w-full items-center rounded-xl px-3 py-2.5 font-medium whitespace-nowrap text-gray-400 transition-colors hover:bg-white/5 hover:text-white",
							isCollapsed && "lg:justify-center lg:px-0",
						)}
						title={isCollapsed ? "Cerrar sesión" : undefined}
					>
						<LogOut className="h-5 w-5 shrink-0" />
						<span
							className={cn(
								"overflow-hidden text-left transition-all duration-300",
								isCollapsed
									? "ml-3 w-[140px] opacity-100 lg:ml-0 lg:w-0 lg:opacity-0"
									: "ml-3 w-[140px] opacity-100",
							)}
						>
							Cerrar sesión
						</span>
					</button>
				</div>
			</aside>

			<div className="flex h-dvh min-w-0 flex-1 flex-col overflow-hidden">
				<header className="flex h-16 shrink-0 items-center border-b border-gray-800 bg-[var(--color-carbon)] px-4 lg:hidden">
					<button
						type="button"
						onClick={() => setIsSidebarOpen(true)}
						className="-ml-2 p-2 text-gray-400 hover:text-white"
						aria-label="Abrir navegación"
					>
						<Menu className="h-6 w-6" />
					</button>
					<span className="ml-4 text-xl font-bold text-[var(--color-voltage)]">
						Zentro
					</span>
				</header>

				<main className="flex min-h-0 flex-1 flex-col overflow-auto">{children}</main>
			</div>
		</div>
	);
}
