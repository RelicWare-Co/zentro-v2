import { usePageContext } from "vike-react/usePageContext";
import { authClient } from "../../lib/auth-client";

function getUserRole(user: unknown) {
	const role = user && typeof user === "object" && "role" in user ? user.role : null;
	return typeof role === "string" && role ? role : "user";
}

export default function Page() {
	const pageContext = usePageContext();
	const { data: sessionData } = authClient.useSession();

	const user = pageContext.user ?? sessionData?.user;

	const handleLogout = async () => {
		await authClient.signOut();
		window.location.href = "/login";
	};

	return (
		<div className="space-y-6">
			<h1 className="text-3xl font-bold">Dashboard</h1>

			<div className="rounded-xl border border-border bg-card p-6">
				<h2 className="text-lg font-semibold mb-4">Información de sesión</h2>
				{user ? (
					<div className="space-y-2 text-sm">
						<p>
							<strong>Nombre:</strong> {user.name}
						</p>
						<p>
							<strong>Email:</strong> {user.email}
						</p>
						<p>
							<strong>Rol:</strong> {getUserRole(user)}
						</p>
					</div>
				) : (
					<p className="text-muted-foreground">No hay sesión activa.</p>
				)}
			</div>

			<button
				onClick={handleLogout}
				className="inline-flex items-center justify-center rounded-md bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground hover:bg-destructive/90 transition-colors cursor-pointer"
			>
				Cerrar sesión
			</button>
		</div>
	);
}
