import { useQuery } from "@tanstack/react-query";
import {
	ArrowRight,
	Building2,
	Loader2,
	LogOut,
	Mail,
	Plus,
	ShieldAlert,
	XCircle,
} from "lucide-react";
import { useEffect, useId, useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth-client";
import { formatOrganizationRoleLabel } from "@/lib/organization-shared";
import { queryClient } from "@/lib/query-client";
import { orpcQuery } from "@/server/orpc/client/query";

const dateTimeFormatter = new Intl.DateTimeFormat("es-CO", {
	day: "numeric",
	month: "short",
	hour: "numeric",
	minute: "2-digit",
});

type OrganizationListItem = {
	id: string;
	name: string;
	slug: string;
};

type InvitationItem = {
	id: string;
	organizationId: string;
	organizationName: string;
	organizationSlug: string;
	role: string;
	expiresAt?: number | null;
};

export function OrganizationSelection() {
	const organizationsQuery = authClient.useListOrganizations();
	const {
		data: organizations,
		isPending: isOrganizationsPending,
		refetch: refetchOrganizations,
	} = organizationsQuery;
	const selectionQuery = useQuery({
		...orpcQuery.organization.selection.queryOptions(),
	});
	const {
		data: selectionData,
		isPending: isSelectionPending,
		refetch: refetchSelectionData,
	} = selectionQuery;
	const orgNameInputId = useId();
	const orgSlugInputId = useId();
	const [isCreating, setIsCreating] = useState(false);
	const [newOrgName, setNewOrgName] = useState("");
	const [newOrgSlug, setNewOrgSlug] = useState("");
	const [slugModified, setSlugModified] = useState(false);
	const [errorMsg, setErrorMsg] = useState<string | null>(null);
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [isSelectingId, setIsSelectingId] = useState<string | null>(null);
	const [isAcceptingInvitationId, setIsAcceptingInvitationId] = useState<
		string | null
	>(null);
	const [isRejectingInvitationId, setIsRejectingInvitationId] = useState<
		string | null
	>(null);

	useEffect(() => {
		const handleVisibilityChange = () => {
			if (document.visibilityState === "visible") {
				void refetchOrganizations();
				void refetchSelectionData();
			}
		};

		document.addEventListener("visibilitychange", handleVisibilityChange);
		return () => {
			document.removeEventListener("visibilitychange", handleVisibilityChange);
		};
	}, []);

	const refreshAndEnter = async () => {
		queryClient.clear();
		window.location.href = "/dashboard";
	};

	const handleSelect = async (orgId: string) => {
		setErrorMsg(null);
		setIsSelectingId(orgId);
		try {
			const result = await authClient.organization.setActive({
				organizationId: orgId,
			});
			if (result?.error) {
				setErrorMsg(result.error.message || "No se pudo seleccionar la organización.");
				return;
			}
			await refreshAndEnter();
		} finally {
			setIsSelectingId(null);
		}
	};

	const handleSlugChange = (event: React.ChangeEvent<HTMLInputElement>) => {
		const value = event.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "");
		setNewOrgSlug(value);
		setSlugModified(true);
	};

	const handleNameChange = (event: React.ChangeEvent<HTMLInputElement>) => {
		const nextName = event.target.value;
		setNewOrgName(nextName);

		if (!slugModified) {
			setNewOrgSlug(
				nextName
					.toLowerCase()
					.replace(/[^a-z0-9]+/g, "-")
					.replace(/(^-|-$)+/g, ""),
			);
		}
	};

	const handleCreate = async (event: React.FormEvent) => {
		event.preventDefault();
		setErrorMsg(null);
		setIsSubmitting(true);

		try {
			if (!newOrgName || !newOrgSlug) {
				setErrorMsg("Completa el nombre y el identificador antes de continuar.");
				return;
			}

			const checkResult = await authClient.organization.checkSlug({
				slug: newOrgSlug,
			});

			if (checkResult?.error) {
				setErrorMsg(
					checkResult.error.message ||
						"No fue posible validar el identificador de la organización.",
				);
				return;
			}

			if (checkResult?.data?.status === false) {
				setErrorMsg("Ese identificador ya está en uso. Elige otro.");
				return;
			}

			const result = await authClient.organization.create({
				name: newOrgName,
				slug: newOrgSlug,
			});

			if (result?.error) {
				setErrorMsg(result.error.message || "No se pudo crear la organización.");
				return;
			}

			if (result?.data) {
				await refetchOrganizations();
				await authClient.organization.setActive({
					organizationId: result.data.id,
				});
				await refreshAndEnter();
			}
		} catch {
			setErrorMsg("Ocurrió un error inesperado al crear la organización.");
		} finally {
			setIsSubmitting(false);
		}
	};

	const handleAcceptInvitation = async (invitation: InvitationItem) => {
		setErrorMsg(null);
		setIsAcceptingInvitationId(invitation.id);

		try {
			const result = await authClient.organization.acceptInvitation({
				invitationId: invitation.id,
			});

			if (result?.error) {
				setErrorMsg(result.error.message || "No se pudo aceptar la invitación.");
				return;
			}

			await refetchOrganizations();
			await refetchSelectionData();
			await authClient.organization.setActive({
				organizationId: invitation.organizationId,
			});
			await refreshAndEnter();
		} catch {
			setErrorMsg("No se pudo aceptar la invitación.");
		} finally {
			setIsAcceptingInvitationId(null);
		}
	};

	const handleRejectInvitation = async (invitationId: string) => {
		setErrorMsg(null);
		setIsRejectingInvitationId(invitationId);

		try {
			const result = await authClient.organization.rejectInvitation({
				invitationId,
			});

			if (result?.error) {
				setErrorMsg(result.error.message || "No se pudo rechazar la invitación.");
				return;
			}

			await refetchSelectionData();
		} catch {
			setErrorMsg("No se pudo rechazar la invitación.");
		} finally {
			setIsRejectingInvitationId(null);
		}
	};

	const isInitialLoading =
		(isOrganizationsPending && organizations === undefined) ||
		(isSelectionPending && selectionData === undefined);

	if (isInitialLoading) {
		return (
			<div className="app-safe-area flex min-h-[100dvh] w-full items-center justify-center bg-[var(--color-void)] text-[var(--color-photon)]">
				<Loader2 className="h-8 w-8 animate-spin text-[var(--color-voltage)]" />
			</div>
		);
	}

	const invitations = selectionData?.invitations ?? [];
	const allowOrganizationCreation =
		selectionData?.allowOrganizationCreation ?? true;

	return (
		<div className="app-safe-area flex min-h-[100dvh] w-full items-center justify-center bg-[var(--color-void)] text-[var(--color-photon)]">
			<div className="w-full max-w-6xl space-y-8 px-4 py-8 md:px-8">
				<div className="flex items-start justify-end">
					<Button
						type="button"
						variant="outline"
						size="sm"
						onClick={async () => {
							await authClient.signOut();
							window.location.href = "/login";
						}}
						className="border-gray-700 bg-transparent text-gray-300 hover:bg-white/5 hover:text-white"
					>
						<LogOut className="mr-2 h-4 w-4" />
						Cerrar sesión
					</Button>
				</div>

				<div className="space-y-3 text-center">
					<Badge className="border-[var(--color-voltage)]/20 bg-[var(--color-voltage)]/10 text-[var(--color-voltage)] hover:bg-[var(--color-voltage)]/10">
						Acceso a organizaciones
					</Badge>
					<h1 className="text-3xl font-bold tracking-tight text-balance md:text-4xl">
						Elige Cómo Quieres Entrar
					</h1>
					<p className="mx-auto max-w-2xl text-sm text-gray-400 md:text-base">
						Selecciona una organización existente, acepta una invitación en la app
						o crea un nuevo espacio si tu cuenta todavía lo tiene habilitado.
					</p>
				</div>

				<div aria-live="polite">
					{errorMsg ? (
						<Alert
							variant="destructive"
							className="border-red-500/20 bg-red-500/10 text-red-100"
						>
							<AlertTitle>No se pudo completar la acción</AlertTitle>
							<AlertDescription>{errorMsg}</AlertDescription>
						</Alert>
					) : null}
				</div>

				<div className="grid gap-6 lg:grid-cols-2 lg:gap-8 xl:grid-cols-[1.1fr_0.9fr]">
					<Card className="border-gray-800 bg-[var(--color-carbon)] text-[var(--color-photon)] shadow-none">
						<CardHeader>
							<CardTitle className="flex items-center gap-2">
								<Building2 className="h-4 w-4 text-[var(--color-voltage)]" />
								Tus Organizaciones
							</CardTitle>
							<CardDescription className="text-gray-400">
								Entrar a un espacio existente mantiene intacto el selector actual.
							</CardDescription>
						</CardHeader>
						<CardContent className="space-y-3">
							{organizations && organizations.length > 0 ? (
								(organizations as OrganizationListItem[]).map((org) => (
									<button
										key={org.id}
										type="button"
										onClick={() => void handleSelect(org.id)}
										disabled={isSelectingId !== null}
										className="flex w-full items-center justify-between rounded-2xl border border-gray-800 bg-black/20 p-4 text-left transition-colors hover:border-[var(--color-voltage)]/40 hover:bg-black/30 disabled:cursor-not-allowed disabled:opacity-60"
									>
										<div className="flex min-w-0 items-center gap-3">
											<div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[var(--color-voltage)]/10 text-[var(--color-voltage)]">
												<Building2 className="h-5 w-5" />
											</div>
											<div className="min-w-0">
												<p className="truncate font-semibold text-white">{org.name}</p>
												<p className="truncate text-sm text-gray-400">/{org.slug}</p>
											</div>
										</div>
										{isSelectingId === org.id ? (
											<Loader2 className="h-5 w-5 animate-spin text-[var(--color-voltage)]" />
										) : (
											<ArrowRight className="h-5 w-5 text-gray-500" />
										)}
									</button>
								))
							) : (
								<div className="rounded-2xl border border-dashed border-gray-800 bg-black/10 p-8 text-center">
									<p className="text-sm text-gray-300">
										Tu cuenta aún no pertenece a ninguna organización.
									</p>
									<p className="mt-2 text-sm text-gray-500">
										Usa una invitación o un join link para entrar sin crear una nueva.
									</p>
								</div>
							)}
						</CardContent>
					</Card>

					<div className="space-y-6">
						<Card className="border-gray-800 bg-[var(--color-carbon)] text-[var(--color-photon)] shadow-none">
							<CardHeader>
								<CardTitle className="flex items-center gap-2">
									<Mail className="h-4 w-4 text-[var(--color-voltage)]" />
									Invitaciones Pendientes
								</CardTitle>
								<CardDescription className="text-gray-400">
									Si ya te invitaron, puedes entrar directo desde aquí.
								</CardDescription>
							</CardHeader>
							<CardContent className="space-y-3">
								{invitations.length > 0 ? (
									invitations.map((invitation) => (
										<div
											key={invitation.id}
											className="rounded-2xl border border-gray-800 bg-black/20 p-4"
										>
											<div className="flex items-start justify-between gap-3">
												<div className="min-w-0">
													<p className="truncate font-semibold text-white">
														{invitation.organizationName}
													</p>
													<p className="truncate text-sm text-gray-400">
														/{invitation.organizationSlug}
													</p>
												</div>
												<Badge
													variant="outline"
													className="border-sky-500/30 bg-sky-500/10 text-sky-200"
												>
													{formatOrganizationRoleLabel(invitation.role)}
												</Badge>
											</div>
											<p className="mt-3 text-xs text-gray-500">
												Expira{" "}
												{invitation.expiresAt
													? dateTimeFormatter.format(invitation.expiresAt)
													: "sin fecha"}
											</p>
											<div className="mt-4 flex flex-col gap-2 sm:flex-row">
												<Button
													type="button"
													onClick={() => void handleAcceptInvitation(invitation)}
													disabled={
														isAcceptingInvitationId !== null ||
														isRejectingInvitationId !== null
													}
													className="bg-[var(--color-voltage)] text-black hover:bg-[#d9f15c]"
												>
													{isAcceptingInvitationId === invitation.id ? (
														<>
															<Loader2 className="h-4 w-4 animate-spin" />
															Entrando...
														</>
													) : (
														"Entrar Ahora"
													)}
												</Button>
												<Button
													type="button"
													variant="outline"
													onClick={() => void handleRejectInvitation(invitation.id)}
													disabled={
														isAcceptingInvitationId !== null ||
														isRejectingInvitationId !== null
													}
													className="border-gray-700 bg-transparent text-gray-200 hover:bg-white/5 hover:text-white"
												>
													{isRejectingInvitationId === invitation.id ? (
														<>
															<Loader2 className="h-4 w-4 animate-spin" />
															Rechazando...
														</>
													) : (
														"Rechazar"
													)}
												</Button>
											</div>
										</div>
									))
								) : (
									<div className="rounded-2xl border border-dashed border-gray-800 bg-black/10 p-6 text-sm text-gray-400">
										No hay invitaciones pendientes para esta cuenta.
									</div>
								)}
							</CardContent>
						</Card>

						{allowOrganizationCreation ? (
							<Card className="border-gray-800 bg-[var(--color-carbon)] text-[var(--color-photon)] shadow-none">
								<CardHeader>
									<CardTitle className="flex items-center gap-2">
										<Plus className="h-4 w-4 text-[var(--color-voltage)]" />
										Crear Organización
									</CardTitle>
									<CardDescription className="text-gray-400">
										Usa este flujo solo si no tienes invitación ni join link.
									</CardDescription>
								</CardHeader>
								<CardContent>
									{!isCreating ? (
										<Button
											type="button"
											onClick={() => {
												setErrorMsg(null);
												setIsCreating(true);
											}}
											variant="outline"
											className="h-12 w-full border-dashed border-gray-700 bg-transparent text-gray-200 hover:bg-white/5 hover:text-white"
										>
											<Plus className="h-4 w-4" />
											Crear Nueva Organización
										</Button>
									) : (
										<form onSubmit={handleCreate} className="space-y-5">
											<div className="space-y-2">
												<Label htmlFor={orgNameInputId}>Nombre de la organización</Label>
												<Input
													id={orgNameInputId}
													name="organizationName"
													value={newOrgName}
													onChange={handleNameChange}
													placeholder="Ej. Tienda Principal..."
													autoComplete="off"
													className="border-gray-800 bg-black/30"
													disabled={isSubmitting}
												/>
											</div>
											<div className="space-y-2">
												<Label htmlFor={orgSlugInputId}>Identificador único</Label>
												<Input
													id={orgSlugInputId}
													name="organizationSlug"
													value={newOrgSlug}
													onChange={handleSlugChange}
													placeholder="tienda-principal"
													autoComplete="off"
													className="border-gray-800 bg-black/30"
													disabled={isSubmitting}
												/>
												<p className="text-xs text-gray-500">
													Se usará en URLs y selección interna.
												</p>
											</div>
											<div className="flex flex-col-reverse gap-3 sm:flex-row">
												<Button
													type="button"
													variant="outline"
													onClick={() => {
														setIsCreating(false);
														setNewOrgName("");
														setNewOrgSlug("");
														setSlugModified(false);
														setErrorMsg(null);
													}}
													className="flex-1 border-gray-700 bg-transparent text-gray-200 hover:bg-white/5 hover:text-white"
													disabled={isSubmitting}
												>
													Cancelar
												</Button>
												<Button
													type="submit"
													className="flex-1 bg-[var(--color-voltage)] text-black hover:bg-[#d9f15c]"
													disabled={isSubmitting}
												>
													{isSubmitting ? (
														<>
															<Loader2 className="h-4 w-4 animate-spin" />
															Creando...
														</>
													) : (
														"Crear y Entrar"
													)}
												</Button>
											</div>
										</form>
									)}
								</CardContent>
							</Card>
						) : (
							<Card className="border-gray-800 bg-[var(--color-carbon)] text-[var(--color-photon)] shadow-none">
								<CardHeader>
									<CardTitle className="flex items-center gap-2">
										<ShieldAlert className="h-4 w-4 text-amber-300" />
										Creación Controlada
									</CardTitle>
									<CardDescription className="text-gray-400">
										La cuenta no puede abrir organizaciones nuevas por sí sola.
									</CardDescription>
								</CardHeader>
								<CardContent className="space-y-4">
									<Alert className="border-amber-500/20 bg-amber-500/10 text-amber-100">
										<AlertTitle>Solicita acceso al admin</AlertTitle>
										<AlertDescription>{selectionData?.contactMessage}</AlertDescription>
									</Alert>
									{selectionData?.contactHref ? (
										<Button
											asChild
											variant="outline"
											className="w-full border-gray-700 bg-transparent text-gray-200 hover:bg-white/5 hover:text-white"
										>
											<a href={selectionData.contactHref} target="_blank" rel="noreferrer">
												{selectionData.contactLabel}
											</a>
										</Button>
									) : (
										<div className="rounded-2xl border border-dashed border-gray-800 bg-black/10 p-4 text-sm text-gray-300">
											{selectionData?.contactLabel ?? "Contactar al administrador"}
										</div>
									)}
								</CardContent>
							</Card>
						)}

						<Card className="border-gray-800 bg-[var(--color-carbon)] text-[var(--color-photon)] shadow-none">
							<CardHeader>
								<CardTitle className="flex items-center gap-2">
									<XCircle className="h-4 w-4 text-gray-400" />
									Sin correo manual
								</CardTitle>
								<CardDescription className="text-gray-400">
									El alta nueva se maneja dentro de la app. Los admins deben compartir
									invitaciones internas o join links.
								</CardDescription>
							</CardHeader>
						</Card>
					</div>
				</div>
			</div>
		</div>
	);
}
