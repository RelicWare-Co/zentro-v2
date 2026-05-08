import { useMutation, useQuery } from "@tanstack/react-query";
import {
	Building2,
	Copy,
	Link2,
	Loader2,
	Mail,
	ShieldCheck,
	Users,
	XCircle,
} from "lucide-react";
import { useId, useState } from "react";
import type { z } from "zod";
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
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { OrganizationSelection } from "@/components/OrganizationSelection";
import { authClient } from "@/lib/auth-client";
import {
	formatJoinLinkStatusLabel,
	formatOrganizationRoleLabel,
	isJoinLinkActive,
	JOIN_LINK_EXPIRY_OPTIONS,
	type OrganizationJoinLinkStatus,
} from "@/lib/organization-shared";
import { orpcQuery } from "@/server/orpc/client/query";
import type { OrganizationManagementSchema } from "@/schemas/organization";

type OrganizationManagementData = z.infer<typeof OrganizationManagementSchema>;

const dateFormatter = new Intl.DateTimeFormat("es-CO", {
	day: "numeric",
	month: "short",
	year: "numeric",
});

const dateTimeFormatter = new Intl.DateTimeFormat("es-CO", {
	day: "numeric",
	month: "short",
	hour: "numeric",
	minute: "2-digit",
});

function getErrorMessage(error: unknown, fallback: string) {
	if (error instanceof Error && error.message) {
		return error.message;
	}

	return fallback;
}

export function OrganizationManagement() {
	const { data: activeOrganization, isPending: isActiveOrgPending } =
		authClient.useActiveOrganization();
	const managementQuery = useQuery({
		...orpcQuery.organization.management.queryOptions(),
		enabled: Boolean(activeOrganization),
	});
	const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
	const [feedbackType, setFeedbackType] = useState<"success" | "error">(
		"success",
	);

	if (isActiveOrgPending || managementQuery.isPending) {
		return (
			<div className="flex min-h-[60dvh] w-full items-center justify-center">
				<Loader2 className="h-8 w-8 animate-spin text-[var(--color-voltage)]" />
			</div>
		);
	}

	if (!activeOrganization) {
		return <OrganizationSelection />;
	}

	if (managementQuery.isError || !managementQuery.data) {
		return (
			<div className="mx-auto max-w-3xl p-6 md:p-8">
				<Alert
					variant="destructive"
					className="border-red-500/20 bg-red-500/10 text-red-100"
				>
					<AlertTitle>No se pudo cargar la organización</AlertTitle>
					<AlertDescription>
						{getErrorMessage(
							managementQuery.error,
							"Intenta recargar la página.",
						)}
					</AlertDescription>
				</Alert>
			</div>
		);
	}

	const data = managementQuery.data;
	const setFeedback = (
		message: string | null,
		type: "success" | "error" = "success",
	) => {
		setFeedbackMessage(message);
		setFeedbackType(type);
	};

	return (
		<div className="min-h-full bg-[var(--color-void)] text-[var(--color-photon)]">
			<div className="mx-auto flex min-h-full max-w-7xl flex-col">
				<header className="shrink-0 border-b border-gray-800 px-6 py-6 md:px-8 lg:px-12">
					<div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
						<div className="min-w-0 space-y-1">
							<h1 className="truncate text-2xl font-bold tracking-tight text-white">
								{data.organization.name}
							</h1>
							<div className="flex flex-wrap items-center gap-2 text-sm text-gray-400">
								<span>/{data.organization.slug}</span>
								<span className="text-gray-600">•</span>
								<span className="inline-flex items-center gap-1">
									<ShieldCheck className="h-3.5 w-3.5 text-[var(--color-voltage)]" />
									{formatOrganizationRoleLabel(data.viewer.role)}
								</span>
							</div>
						</div>
						<div className="flex gap-4">
							<HeaderStat label="Miembros" value={data.stats.membersCount} />
							<div className="w-px bg-gray-800" />
							<HeaderStat label="Links" value={data.stats.activeJoinLinksCount} />
						</div>
					</div>
				</header>

				<main className="flex-1 p-6 md:p-8 lg:p-12">
					<div className="max-w-5xl space-y-6">
						{feedbackMessage ? (
							<Alert
								variant={feedbackType === "error" ? "destructive" : "default"}
								className={
									feedbackType === "error"
										? "border-red-500/20 bg-red-500/10 text-red-100"
										: "border-[var(--color-voltage)]/20 bg-[var(--color-voltage)]/10 text-[var(--color-photon)]"
								}
							>
								<AlertTitle>
									{feedbackType === "error" ? "Error" : "Estado"}
								</AlertTitle>
								<AlertDescription>{feedbackMessage}</AlertDescription>
							</Alert>
						) : null}

						<Tabs defaultValue="general" className="space-y-6">
							<TabsList className="h-auto flex-wrap border border-gray-800 bg-[var(--color-carbon)]">
								<TabsTrigger value="general">
									<Building2 className="h-4 w-4" />
									General
								</TabsTrigger>
								<TabsTrigger value="members">
									<Users className="h-4 w-4" />
									Miembros
								</TabsTrigger>
								<TabsTrigger value="invitations">
									<Mail className="h-4 w-4" />
									Invitaciones
								</TabsTrigger>
								<TabsTrigger value="access">
									<Link2 className="h-4 w-4" />
									Acceso
								</TabsTrigger>
							</TabsList>

							<TabsContent value="general">
								<GeneralTab data={data} />
							</TabsContent>
							<TabsContent value="members">
								<MembersTab data={data} />
							</TabsContent>
							<TabsContent value="invitations">
								<InvitationsTab data={data} />
							</TabsContent>
							<TabsContent value="access">
								<AccessTab
									data={data}
									refetchManagement={() => managementQuery.refetch()}
									setFeedback={setFeedback}
								/>
							</TabsContent>
						</Tabs>
					</div>
				</main>
			</div>
		</div>
	);
}

function HeaderStat(props: { label: string; value: number }) {
	return (
		<div className="text-right">
			<p className="text-xs tracking-wider text-gray-500 uppercase">
				{props.label}
			</p>
			<p className="text-lg font-semibold text-white">{props.value}</p>
		</div>
	);
}

function GeneralTab({ data }: { data: OrganizationManagementData }) {
	return (
		<div className="space-y-6">
			<Card className="border-gray-800 bg-[var(--color-carbon)] shadow-none">
				<CardHeader>
					<CardTitle>Información General</CardTitle>
					<CardDescription className="text-gray-400">
						Detalles básicos de la organización activa.
					</CardDescription>
				</CardHeader>
				<CardContent>
					<div className="grid gap-4 sm:grid-cols-2">
						<Detail label="Nombre" value={data.organization.name} />
						<Detail label="Slug" value={`/${data.organization.slug}`} />
						<Detail label="ID" value={data.organization.id} mono />
						<Detail
							label="Creada"
							value={
								data.organization.createdAt
									? dateFormatter.format(data.organization.createdAt)
									: "N/A"
							}
						/>
					</div>
				</CardContent>
			</Card>

			<Card className="border-gray-800 bg-[var(--color-carbon)] shadow-none">
				<CardHeader>
					<CardTitle>Permisos Actuales</CardTitle>
					<CardDescription className="text-gray-400">
						Las acciones de edición, invitación y miembros se migrarán como el
						siguiente bloque oRPC.
					</CardDescription>
				</CardHeader>
				<CardContent className="flex flex-wrap gap-2">
					<Badge variant="outline" className="border-gray-700 text-gray-300">
						{formatOrganizationRoleLabel(data.viewer.role)}
					</Badge>
					<Badge
						variant="outline"
						className={
							data.viewer.canManageAccess
								? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
								: "border-gray-700 bg-gray-800 text-gray-400"
						}
					>
						{data.viewer.canManageAccess
							? "Puede gestionar acceso"
							: "Acceso de lectura"}
					</Badge>
				</CardContent>
			</Card>
		</div>
	);
}

function Detail(props: { label: string; value: string; mono?: boolean }) {
	return (
		<div className="min-w-0 space-y-1">
			<p className="text-xs tracking-wider text-gray-500 uppercase">
				{props.label}
			</p>
			<p
				className={
					props.mono
						? "truncate font-mono text-sm text-gray-400"
						: "truncate text-sm font-medium text-white"
				}
			>
				{props.value}
			</p>
		</div>
	);
}

function MembersTab({ data }: { data: OrganizationManagementData }) {
	return (
		<Card className="border-gray-800 bg-[var(--color-carbon)] shadow-none">
			<CardHeader>
				<CardTitle>Miembros Activos</CardTitle>
				<CardDescription className="text-gray-400">
					Listado de usuarios con acceso a esta organización.
				</CardDescription>
			</CardHeader>
			<CardContent className="p-0">
				<Table>
					<TableHeader>
						<TableRow className="border-gray-800 hover:bg-transparent">
							<TableHead className="px-4 text-gray-400">Miembro</TableHead>
							<TableHead className="text-gray-400">Rol</TableHead>
							<TableHead className="text-gray-400">Ingreso</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{data.members.map((member) => (
							<TableRow
								key={member.memberId}
								className="border-gray-800 hover:bg-white/5"
							>
								<TableCell className="px-4">
									<div className="flex min-w-0 items-center gap-3">
										<div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gray-800">
											<span className="text-sm font-medium text-gray-400">
												{member.name.charAt(0).toUpperCase()}
											</span>
										</div>
										<div className="min-w-0">
											<p className="truncate text-sm font-medium text-white">
												{member.name}
											</p>
											<p className="truncate text-xs text-gray-500">
												{member.email}
											</p>
										</div>
									</div>
								</TableCell>
								<TableCell>
									<Badge variant="outline" className="text-gray-300">
										{formatOrganizationRoleLabel(member.role)}
									</Badge>
								</TableCell>
								<TableCell className="text-sm text-gray-400">
									{member.joinedAt
										? dateFormatter.format(member.joinedAt)
										: "N/A"}
								</TableCell>
							</TableRow>
						))}
					</TableBody>
				</Table>
				{data.members.length === 0 ? (
					<div className="p-8 text-center text-sm text-gray-500">
						No hay miembros en la organización.
					</div>
				) : null}
			</CardContent>
		</Card>
	);
}

function InvitationsTab({ data }: { data: OrganizationManagementData }) {
	return (
		<Card className="border-gray-800 bg-[var(--color-carbon)] shadow-none">
			<CardHeader>
				<CardTitle>Invitaciones Pendientes</CardTitle>
				<CardDescription className="text-gray-400">
					Invitaciones internas que todavía no han sido aceptadas.
				</CardDescription>
			</CardHeader>
			<CardContent className="p-0">
				<Table>
					<TableHeader>
						<TableRow className="border-gray-800 hover:bg-transparent">
							<TableHead className="px-4 text-gray-400">Email</TableHead>
							<TableHead className="text-gray-400">Rol</TableHead>
							<TableHead className="text-gray-400">Expira</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{data.pendingInvitations.map((invitation) => (
							<TableRow
								key={invitation.id}
								className="border-gray-800 hover:bg-white/5"
							>
								<TableCell className="px-4 text-sm text-white">
									{invitation.email}
								</TableCell>
								<TableCell>
									<Badge variant="outline" className="text-gray-300">
										{formatOrganizationRoleLabel(invitation.role)}
									</Badge>
								</TableCell>
								<TableCell className="text-sm text-gray-400">
									{invitation.expiresAt
										? dateTimeFormatter.format(invitation.expiresAt)
										: "N/A"}
								</TableCell>
							</TableRow>
						))}
					</TableBody>
				</Table>
				{data.pendingInvitations.length === 0 ? (
					<div className="p-8 text-center text-sm text-gray-500">
						No hay invitaciones pendientes.
					</div>
				) : null}
			</CardContent>
		</Card>
	);
}

function AccessTab({
	data,
	refetchManagement,
	setFeedback,
}: {
	data: OrganizationManagementData;
	refetchManagement: () => Promise<unknown>;
	setFeedback: (message: string | null, type?: "success" | "error") => void;
}) {
	const labelId = useId();
	const expiryId = useId();
	const [joinLinkLabel, setJoinLinkLabel] = useState("");
	const [expiresInDays, setExpiresInDays] = useState("7");
	const [latestJoinUrl, setLatestJoinUrl] = useState<string | null>(null);
	const createJoinLinkMutation = useMutation(
		orpcQuery.organization.joinLinkCreate.mutationOptions(),
	);
	const revokeJoinLinkMutation = useMutation(
		orpcQuery.organization.joinLinkRevoke.mutationOptions(),
	);

	const createJoinUrl = (joinPath: string) =>
		new URL(joinPath, window.location.origin).toString();

	const copyJoinUrl = async (joinPath: string) => {
		const joinUrl = createJoinUrl(joinPath);
		await navigator.clipboard.writeText(joinUrl);
		setFeedback("Enlace copiado. Ya puedes compartirlo.");
	};

	const handleCreateJoinLink = async (
		event: React.FormEvent<HTMLFormElement>,
	) => {
		event.preventDefault();
		setFeedback(null);

		try {
			const result = await createJoinLinkMutation.mutateAsync({
				label: joinLinkLabel || undefined,
				expiresInDays: Number(expiresInDays),
			});
			const joinUrl = createJoinUrl(result.joinPath);
			setLatestJoinUrl(joinUrl);
			setJoinLinkLabel("");
			await navigator.clipboard.writeText(joinUrl);
			await refetchManagement();
			setFeedback("Enlace creado y copiado.");
		} catch (error) {
			setLatestJoinUrl(null);
			setFeedback(
				getErrorMessage(error, "No se pudo crear el enlace de acceso."),
				"error",
			);
		}
	};

	const handleRevokeJoinLink = async (joinLinkId: string) => {
		setFeedback(null);

		try {
			await revokeJoinLinkMutation.mutateAsync({ joinLinkId });
			await refetchManagement();
			setFeedback("El enlace fue revocado.");
		} catch (error) {
			setFeedback(
				getErrorMessage(error, "No se pudo revocar el enlace."),
				"error",
			);
		}
	};

	return (
		<div className="space-y-6">
			<div className="grid gap-6 lg:grid-cols-3">
				<Card className="lg:col-span-2 border-gray-800 bg-[var(--color-carbon)] shadow-none">
					<CardHeader>
						<CardTitle>Crear Link de Acceso</CardTitle>
						<CardDescription className="text-gray-400">
							Genera un enlace de un solo uso para sumar miembros.
						</CardDescription>
					</CardHeader>
					<CardContent className="space-y-4">
						{data.viewer.canManageAccess ? (
							<form onSubmit={handleCreateJoinLink} className="space-y-4">
								<div className="grid gap-4 sm:grid-cols-2">
									<div className="space-y-2">
										<Label htmlFor={labelId}>Referencia</Label>
										<Input
											id={labelId}
											name="joinLinkLabel"
											value={joinLinkLabel}
											onChange={(event) => setJoinLinkLabel(event.target.value)}
											placeholder="Ej. Sucursal centro"
											autoComplete="off"
											className="border-gray-800 bg-black/30"
											disabled={createJoinLinkMutation.isPending}
										/>
									</div>
									<div className="space-y-2">
										<Label htmlFor={expiryId}>Vigencia</Label>
										<Select
											value={expiresInDays}
											onValueChange={setExpiresInDays}
											disabled={createJoinLinkMutation.isPending}
										>
											<SelectTrigger
												id={expiryId}
												className="w-full border-gray-800 bg-black/30"
											>
												<SelectValue placeholder="Selecciona" />
											</SelectTrigger>
											<SelectContent>
												{JOIN_LINK_EXPIRY_OPTIONS.map((option) => (
													<SelectItem
														key={option.value}
														value={String(option.value)}
													>
														{option.label}
													</SelectItem>
												))}
											</SelectContent>
										</Select>
									</div>
								</div>
								<Button
									type="submit"
									className="bg-[var(--color-voltage)] text-black hover:bg-[#d9f15c]"
									disabled={createJoinLinkMutation.isPending}
								>
									{createJoinLinkMutation.isPending ? (
										<>
											<Loader2 className="h-4 w-4 animate-spin" />
											Creando...
										</>
									) : (
										"Crear Link"
									)}
								</Button>
							</form>
						) : (
							<Alert className="border-amber-500/20 bg-amber-500/10 text-amber-100">
								<AlertTitle>Acceso restringido</AlertTitle>
								<AlertDescription>
									Solo owners y admins pueden crear o revocar enlaces de acceso.
								</AlertDescription>
							</Alert>
						)}

						{latestJoinUrl ? (
							<div className="space-y-2 rounded-xl border border-[var(--color-voltage)]/20 bg-[var(--color-voltage)]/10 p-4">
								<p className="text-sm font-medium text-white">
									Último enlace generado
								</p>
								<Input
									readOnly
									value={latestJoinUrl}
									className="border-[var(--color-voltage)]/20 bg-black/20 text-sm"
								/>
							</div>
						) : null}
					</CardContent>
				</Card>

				<Card className="border-gray-800 bg-[var(--color-carbon)] shadow-none">
					<CardHeader>
						<CardTitle>Modo de Alta</CardTitle>
						<CardDescription className="text-gray-400">
							Política vigente para organizaciones.
						</CardDescription>
					</CardHeader>
					<CardContent className="space-y-4">
						<Badge
							variant="outline"
							className={
								data.policy.allowOrganizationCreation
									? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
									: "border-gray-700 bg-gray-800 text-gray-400"
							}
						>
							{data.policy.allowOrganizationCreation
								? "Creación habilitada"
								: "Creación controlada"}
						</Badge>
						<p className="text-sm text-gray-400">{data.policy.contactMessage}</p>
					</CardContent>
				</Card>
			</div>

			<Card className="border-gray-800 bg-[var(--color-carbon)] shadow-none">
				<CardHeader>
					<div className="flex items-center justify-between gap-4">
						<CardTitle>Links de Acceso</CardTitle>
						<Badge variant="outline" className="text-gray-400">
							{data.joinLinks.length} total
						</Badge>
					</div>
				</CardHeader>
				<CardContent>
					{data.joinLinks.length > 0 ? (
						<div className="space-y-3">
							{data.joinLinks.map((joinLink) => (
								<div
									key={joinLink.id}
									className="flex flex-col gap-3 rounded-xl border border-gray-800 bg-black/20 p-4 sm:flex-row sm:items-center sm:justify-between"
								>
									<div className="min-w-0 flex-1 space-y-1">
										<div className="flex flex-wrap items-center gap-2">
											<p className="truncate font-medium text-white">
												{joinLink.label || "Sin referencia"}
											</p>
											<JoinLinkStatusBadge status={joinLink.status} />
										</div>
										<p className="text-xs text-gray-500">
											{joinLink.lastUsedAt
												? `Último uso ${dateTimeFormatter.format(joinLink.lastUsedAt)}`
												: "Sin uso todavía"}
											<span className="mx-2 text-gray-700">•</span>
											Expira:{" "}
											{joinLink.expiresAt
												? dateTimeFormatter.format(joinLink.expiresAt)
												: "Sin límite"}
											<span className="mx-2 text-gray-700">•</span>
											Uso: {joinLink.useCount}/{joinLink.maxUses}
										</p>
									</div>
									<div className="flex gap-2">
										<Button
											type="button"
											variant="outline"
											size="sm"
											onClick={() => void copyJoinUrl(joinLink.joinPath)}
											disabled={!isJoinLinkActive(joinLink.status)}
											className="border-gray-700 bg-transparent text-gray-200 hover:bg-white/5"
										>
											<Copy className="mr-1.5 h-3.5 w-3.5" />
											Copiar
										</Button>
										{data.viewer.canManageAccess ? (
											<Button
												type="button"
												variant="outline"
												size="sm"
												onClick={() => void handleRevokeJoinLink(joinLink.id)}
												disabled={
													joinLink.status === "revoked" ||
													revokeJoinLinkMutation.isPending
												}
												className="border-red-500/30 bg-transparent text-red-200 hover:bg-red-500/10"
											>
												<XCircle className="mr-1.5 h-3.5 w-3.5" />
												Revocar
											</Button>
										) : null}
									</div>
								</div>
							))}
						</div>
					) : (
						<div className="rounded-xl border border-dashed border-gray-800 bg-black/10 p-8 text-center">
							<p className="text-sm text-gray-500">
								No hay links de acceso creados todavía.
							</p>
						</div>
					)}
				</CardContent>
			</Card>
		</div>
	);
}

function JoinLinkStatusBadge(props: { status: OrganizationJoinLinkStatus }) {
	const className =
		props.status === "active"
			? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
			: props.status === "used"
				? "border-sky-500/30 bg-sky-500/10 text-sky-200"
				: props.status === "revoked"
					? "border-red-500/30 bg-red-500/10 text-red-200"
					: "border-amber-500/30 bg-amber-500/10 text-amber-200";

	return (
		<Badge variant="outline" className={className}>
			{formatJoinLinkStatusLabel(props.status)}
		</Badge>
	);
}
