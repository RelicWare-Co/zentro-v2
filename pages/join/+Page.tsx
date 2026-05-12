import { useState } from "react";
import { authClient } from "../../lib/auth-client";
import { useQuery, useMutation } from "@tanstack/react-query";
import { orpcQuery } from "../../server/orpc/client/query";
import { queryClient } from "../../lib/query-client";
import { formatOrganizationRoleLabel } from "../../lib/organization-shared";
import {
	ArrowRight,
	Building2,
	Loader2,
	LogOut,
} from "lucide-react";

function useJoinToken() {
	if (typeof window !== "undefined") {
		return new URLSearchParams(window.location.search).get("token");
	}
	return null;
}

function getErrorMessage(error: unknown, fallback: string) {
	return error instanceof Error ? error.message : fallback;
}

export default function Page() {
	const token = useJoinToken();
	const { data: sessionData, isPending: isSessionPending } =
		authClient.useSession();
	const [errorMessage, setErrorMessage] = useState<string | null>(null);
	const [isJoining, setIsJoining] = useState(false);

	const previewQuery = useQuery({
		...orpcQuery.organization.joinLinkPreview.queryOptions({
			input: { token: token ?? "" },
		}),
		enabled: !!token,
	});

	const redeemMutation = useMutation({
		...orpcQuery.organization.joinLinkRedeem.mutationOptions(),
	});

	const preview = previewQuery.data ?? null;

	const joinWithCurrentAccount = async () => {
		if (!token) {
			return;
		}

		setErrorMessage(null);
		setIsJoining(true);

		try {
			const result = await redeemMutation.mutateAsync({ token });
			await authClient.organization.setActive({
				organizationId: result.organizationId,
			});
			queryClient.clear();
			window.location.href = "/dashboard";
		} catch (error: unknown) {
			setErrorMessage(
				getErrorMessage(
					error,
					"No se pudo completar el acceso a la organización.",
				),
			);
		} finally {
			setIsJoining(false);
		}
	};

	return (
		<div className="flex min-h-[100dvh] items-center justify-center bg-[#0f0f0f] p-4 text-white md:p-8">
			<div className="w-full max-w-2xl space-y-6">
				<div className="space-y-3 text-center">
					<span className="inline-flex items-center rounded-full border border-[#dfff06]/20 bg-[#dfff06]/10 px-2 py-0.5 text-xs font-medium text-[#dfff06]">
						Join Link
					</span>
					<h1 className="text-3xl font-semibold tracking-tight text-balance">
						Entrar a una Organización
					</h1>
					<p className="mx-auto max-w-xl text-sm text-zinc-400 md:text-base">
						Este enlace te lleva directo a la organización indicada después de
						iniciar sesión o crear tu cuenta.
					</p>
				</div>

				{errorMessage ? (
					<div className="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-100">
						<p className="font-medium">No se pudo completar el acceso</p>
						<p className="text-red-200/90">{errorMessage}</p>
					</div>
				) : null}

				<div className="rounded-2xl border border-zinc-800 bg-[#1c1c1c] shadow-none">
					<div className="p-6 border-b border-zinc-800">
						<div className="flex items-center gap-2 text-lg font-semibold">
							<Building2 className="size-4 text-[#dfff06]" />
							Detalle del acceso
						</div>
						<p className="text-sm text-zinc-400 mt-1">
							Revisa la organización y continúa con la cuenta correcta.
						</p>
					</div>
					<div className="p-6 space-y-6">
						{preview?.organization ? (
							<div className="rounded-2xl border border-zinc-800 bg-black/20 p-5">
								<p className="text-lg font-semibold text-white">
									{preview.organization.name}
								</p>
								<p className="text-sm text-zinc-400">
									/{preview.organization.slug}
								</p>
								<div className="mt-4 flex flex-wrap gap-2">
									<span className="inline-flex items-center rounded-full border border-sky-500/30 bg-sky-500/10 px-2 py-0.5 text-xs font-medium text-sky-200">
										{formatOrganizationRoleLabel(preview.role)}
									</span>
									{preview.label ? (
										<span className="inline-flex items-center rounded-full border border-zinc-700 bg-transparent px-2 py-0.5 text-xs font-medium text-zinc-300">
											{preview.label}
										</span>
									) : null}
								</div>
								<p className="mt-4 text-sm text-zinc-400">
									{preview.canJoin
										? "El acceso está listo para usarse."
										: preview.message}
								</p>
							</div>
						) : (
							<div className="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-100">
								<p className="font-medium">Enlace no disponible</p>
								<p className="text-red-200/90">
									{preview?.message ??
										"No encontramos información para este enlace."}
								</p>
							</div>
						)}

						{sessionData ? (
							<div className="space-y-4 rounded-2xl border border-zinc-800 bg-black/20 p-5">
								<div>
									<p className="text-sm text-zinc-400">Cuenta actual</p>
									<p className="mt-1 font-semibold text-white">
										{sessionData.user.name}
									</p>
									<p className="text-sm text-zinc-400">
										{sessionData.user.email}
									</p>
								</div>
								<div className="flex flex-col gap-3 sm:flex-row">
									<button
										type="button"
										onClick={() => void joinWithCurrentAccount()}
										disabled={
											isSessionPending || isJoining || !preview?.canJoin
										}
										className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-[#dfff06] px-3 text-sm font-medium text-black hover:bg-[#c9e605] transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
									>
										{isJoining ? (
											<>
												<Loader2 className="size-4 animate-spin" />
												Entrando…
											</>
										) : (
											<>
												<ArrowRight className="size-4" />
												Entrar con esta cuenta
											</>
										)}
									</button>
									<button
										type="button"
										onClick={async () => {
											await authClient.signOut();
											window.location.reload();
										}}
										className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-zinc-700 bg-transparent px-3 text-sm font-medium text-zinc-200 hover:bg-white/5 hover:text-white transition-colors cursor-pointer"
									>
										<LogOut className="size-4" />
										Usar otra cuenta
									</button>
								</div>
							</div>
						) : (
							<div className="space-y-3 rounded-2xl border border-zinc-800 bg-black/20 p-5">
								<p className="text-sm text-zinc-400">
									Para continuar necesitas iniciar sesión o crear tu cuenta.
								</p>
								<div className="flex flex-col gap-3 sm:flex-row">
									<a
										href={`/login?token=${encodeURIComponent(token ?? "")}`}
										className="inline-flex h-9 items-center justify-center rounded-lg bg-[#dfff06] px-3 text-sm font-medium text-black hover:bg-[#c9e605] transition-colors"
									>
										Continuar
									</a>
									<a
										href="/login"
										className="inline-flex h-9 items-center justify-center rounded-lg border border-zinc-700 bg-transparent px-3 text-sm font-medium text-zinc-200 hover:bg-white/5 hover:text-white transition-colors"
									>
										Abrir login sin enlace
									</a>
								</div>
							</div>
						)}
					</div>
				</div>
			</div>
		</div>
	);
}
