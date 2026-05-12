import { useMutation, useQuery } from "@tanstack/react-query";
import {
	AlertTriangle,
	Building2,
	Check,
	Copy,
	Link2,
	Loader2,
	LogOut,
	Mail,
	Pencil,
	ShieldCheck,
	Trash2,
	UserPlus,
	UserX,
	Users,
	XCircle,
} from "lucide-react";
import { useId, useState } from "react";
import type { z } from "zod";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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

const ROLE_OPTIONS = [
	{ value: "member", label: "Miembro" },
	{ value: "admin", label: "Admin" },
	{ value: "owner", label: "Owner" },
];

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
	const [activeTab, setActiveTab] = useState("general");

	if (isActiveOrgPending || managementQuery.isPending) {
		return (
			<div className="flex min-h-[60dvh] w-full items-center justify-center">
				<Loader2 className="size-8 animate-spin text-[var(--color-voltage)]" />
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
				<header className="shrink-0 border-b border-zinc-800 px-6 py-6 md:px-8 lg:px-12">
					<div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
						<div className="min-w-0 space-y-1">
							<h1 className="truncate text-2xl font-semibold tracking-tight text-white">
								{data.organization.name}
							</h1>
							<div className="flex flex-wrap items-center gap-2 text-sm text-zinc-400">
								<span>/{data.organization.slug}</span>
								<span className="text-zinc-600">•</span>
								<span className="inline-flex items-center gap-1">
									<ShieldCheck className="size-3.5 text-[var(--color-voltage)]" />
									{formatOrganizationRoleLabel(data.viewer.role)}
								</span>
							</div>
						</div>
						<div className="flex gap-4">
							<HeaderStat label="Miembros" value={data.stats.membersCount} />
							<div className="w-px bg-zinc-800" />
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

						<Tabs value={activeTab} onValueChange={setActiveTab} className="gap-6">
							<div className="flex sm:hidden justify-center">
								<Select
									value={activeTab}
									onValueChange={(v) => setActiveTab(v)}
								>
									<SelectTrigger className="h-10 w-auto min-w-[180px] rounded-xl border-zinc-800 bg-[var(--color-carbon)] px-5 text-sm font-medium text-white">
										<SelectValue />
									</SelectTrigger>
									<SelectContent className="border-zinc-800 bg-[var(--color-carbon)] text-white">
										<SelectItem value="general">
											<div className="flex items-center gap-2">
												<Building2 className="size-4" />
												General
											</div>
										</SelectItem>
										<SelectItem value="members">
											<div className="flex items-center gap-2">
												<Users className="size-4" />
												Miembros
											</div>
										</SelectItem>
										<SelectItem value="invitations">
											<div className="flex items-center gap-2">
												<Mail className="size-4" />
												Invitaciones
											</div>
										</SelectItem>
										<SelectItem value="access">
											<div className="flex items-center gap-2">
												<Link2 className="size-4" />
												Acceso
											</div>
										</SelectItem>
									</SelectContent>
								</Select>
							</div>
							<TabsList className="hidden sm:flex h-auto flex-wrap gap-2 bg-transparent border-0 p-0 w-full">
								<TabsTrigger
									value="general"
									className="shrink-0 h-10 gap-2 rounded-xl border border-transparent px-5 text-sm font-medium text-zinc-400 transition-all hover:text-white data-[state=active]:bg-[var(--color-carbon)] data-[state=active]:!border-zinc-700 data-[state=active]:text-white"
								>
									<Building2 className="size-4" />
									General
								</TabsTrigger>
								<TabsTrigger
									value="members"
									className="shrink-0 h-10 gap-2 rounded-xl border border-transparent px-5 text-sm font-medium text-zinc-400 transition-all hover:text-white data-[state=active]:bg-[var(--color-carbon)] data-[state=active]:!border-zinc-700 data-[state=active]:text-white"
								>
									<Users className="size-4" />
									Miembros
								</TabsTrigger>
								<TabsTrigger
									value="invitations"
									className="shrink-0 h-10 gap-2 rounded-xl border border-transparent px-5 text-sm font-medium text-zinc-400 transition-all hover:text-white data-[state=active]:bg-[var(--color-carbon)] data-[state=active]:!border-zinc-700 data-[state=active]:text-white"
								>
									<Mail className="size-4" />
									Invitaciones
								</TabsTrigger>
								<TabsTrigger
									value="access"
									className="shrink-0 h-10 gap-2 rounded-xl border border-transparent px-5 text-sm font-medium text-zinc-400 transition-all hover:text-white data-[state=active]:bg-[var(--color-carbon)] data-[state=active]:!border-zinc-700 data-[state=active]:text-white"
								>
									<Link2 className="size-4" />
									Acceso
								</TabsTrigger>
							</TabsList>

							<TabsContent value="general">
								<GeneralTab
									data={data}
									refetchManagement={() => managementQuery.refetch()}
									setFeedback={setFeedback}
								/>
							</TabsContent>
							<TabsContent value="members">
								<MembersTab
									data={data}
									refetchManagement={() => managementQuery.refetch()}
									setFeedback={setFeedback}
								/>
							</TabsContent>
							<TabsContent value="invitations">
								<InvitationsTab
									data={data}
									refetchManagement={() => managementQuery.refetch()}
									setFeedback={setFeedback}
								/>
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
			<p className="text-xs tracking-wider text-zinc-500 uppercase">
				{props.label}
			</p>
			<p className="text-lg font-semibold text-white">{props.value}</p>
		</div>
	);
}

function GeneralTab({
	data,
	refetchManagement,
	setFeedback,
}: {
	data: OrganizationManagementData;
	refetchManagement: () => Promise<unknown>;
	setFeedback: (message: string | null, type?: "success" | "error") => void;
}) {
	const [isEditing, setIsEditing] = useState(false);
	const [editName, setEditName] = useState(data.organization.name);
	const [editSlug, setEditSlug] = useState(data.organization.slug);
	const [showDeleteDialog, setShowDeleteDialog] = useState(false);

	const updateMutation = useMutation(
		orpcQuery.organization.updateOrganization.mutationOptions(),
	);
	const deleteMutation = useMutation(
		orpcQuery.organization.deleteOrganization.mutationOptions(),
	);

	const isOwner = parseRoleList(data.viewer.role).includes("owner");

	const handleSave = async (event: React.FormEvent) => {
		event.preventDefault();
		setFeedback(null);
		try {
			await updateMutation.mutateAsync({
				name: editName || undefined,
				slug: editSlug || undefined,
			});
			await refetchManagement();
			setIsEditing(false);
			setFeedback("Organización actualizada.");
		} catch (error) {
			setFeedback(
				getErrorMessage(error, "No se pudo actualizar la organización."),
				"error",
			);
		}
	};

	const handleDelete = async () => {
		setShowDeleteDialog(false);
		setFeedback(null);
		try {
			await deleteMutation.mutateAsync({
				organizationId: data.organization.id,
			});
			setFeedback("Organización eliminada. Redirigiendo...", "success");
			// Clear active org and reload to selection
			await authClient.organization.setActive({ organizationId: null });
			window.location.href = "/organization";
		} catch (error) {
			setFeedback(
				getErrorMessage(error, "No se pudo eliminar la organización."),
				"error",
			);
		}
	};

	return (
		<div className="space-y-6">
			<Card className="border-zinc-800 bg-[var(--color-carbon)] shadow-none">
				<CardHeader>
					<div className="flex items-center justify-between gap-4">
						<div>
							<CardTitle>Información General</CardTitle>
							<CardDescription className="text-zinc-400">
								Detalles básicos de la organización activa.
							</CardDescription>
						</div>
						{data.viewer.canManageAccess && !isEditing && (
							<Button
								variant="outline"
								size="sm"
								onClick={() => setIsEditing(true)}
								className="border-zinc-700 bg-transparent text-zinc-200 hover:bg-white/5"
							>
								<Pencil className="mr-1.5 size-3.5" />
								Editar
							</Button>
						)}
					</div>
				</CardHeader>
				<CardContent>
					{isEditing ? (
						<form onSubmit={handleSave} className="space-y-4">
							<div className="grid gap-4 sm:grid-cols-2">
								<div className="space-y-2">
									<Label>Nombre</Label>
									<Input
										value={editName}
										onChange={(e) => setEditName(e.target.value)}
										className="border-zinc-800 bg-black/30"
										disabled={updateMutation.isPending}
									/>
								</div>
								<div className="space-y-2">
									<Label>Slug</Label>
									<Input
										value={editSlug}
										onChange={(e) =>
											setEditSlug(
												e.target.value
													.toLowerCase()
													.replace(/[^a-z0-9-]/g, ""),
											)
										}
										className="border-zinc-800 bg-black/30"
										disabled={updateMutation.isPending}
									/>
								</div>
							</div>
							<div className="flex flex-col-reverse gap-3 sm:flex-row">
								<Button
									type="button"
									variant="outline"
									onClick={() => {
										setIsEditing(false);
										setEditName(data.organization.name);
										setEditSlug(data.organization.slug);
									}}
									className="border-zinc-700 bg-transparent text-zinc-200 hover:bg-white/5"
									disabled={updateMutation.isPending}
								>
									Cancelar
								</Button>
								<Button
									type="submit"
									className="bg-[var(--color-voltage)] text-black hover:bg-[#d9f15c]"
									disabled={updateMutation.isPending}
								>
									{updateMutation.isPending ? (
										<>
											<Loader2 className="mr-2 size-4 animate-spin" />
											Guardando…
										</>
									) : (
										<>
											<Check className="mr-2 size-4" />
											Guardar
										</>
									)}
								</Button>
							</div>
						</form>
					) : (
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
					)}
				</CardContent>
			</Card>

			<Card className="border-zinc-800 bg-[var(--color-carbon)] shadow-none">
				<CardHeader>
					<CardTitle>Permisos Actuales</CardTitle>
					<CardDescription className="text-zinc-400">
						Tu rol determina qué acciones puedes realizar.
					</CardDescription>
				</CardHeader>
				<CardContent className="flex flex-wrap gap-2">
					<Badge variant="outline" className="border-zinc-700 text-zinc-300">
						{formatOrganizationRoleLabel(data.viewer.role)}
					</Badge>
					<Badge
						variant="outline"
						className={
							data.viewer.canManageAccess
								? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
								: "border-zinc-700 bg-zinc-800 text-zinc-400"
						}
					>
						{data.viewer.canManageAccess
							? "Puede gestionar acceso"
							: "Acceso de lectura"}
					</Badge>
				</CardContent>
			</Card>

			{isOwner && (
				<Card className="border-red-500/20 bg-red-500/5 shadow-none">
					<CardHeader>
						<CardTitle className="text-red-200">Zona de Peligro</CardTitle>
						<CardDescription className="text-red-200/60">
							Eliminar la organización es irreversible.
						</CardDescription>
					</CardHeader>
					<CardContent>
						<Button
							variant="outline"
							size="sm"
							onClick={() => setShowDeleteDialog(true)}
							disabled={deleteMutation.isPending}
							className="border-red-500/30 bg-transparent text-red-200 hover:bg-red-500/10"
						>
							{deleteMutation.isPending ? (
								<Loader2 className="mr-2 size-4 animate-spin" />
							) : (
								<Trash2 className="mr-2 size-4" />
							)}
							Eliminar Organización
						</Button>
					</CardContent>
				</Card>
			)}

			<AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
				<AlertDialogContent className="border-red-500/20 bg-[var(--color-carbon)] text-[var(--color-photon)]">
					<AlertDialogHeader>
						<AlertDialogTitle className="flex items-center gap-2 text-red-200">
							<AlertTriangle className="size-5" />
							¿Eliminar organización?
						</AlertDialogTitle>
						<AlertDialogDescription className="text-zinc-400">
							Esta acción no se puede deshacer. Todos los datos asociados
							(productos, ventas, miembros) serán eliminados.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel className="border-zinc-700 bg-transparent text-zinc-200 hover:bg-white/5">
							Cancelar
						</AlertDialogCancel>
						<AlertDialogAction
							onClick={handleDelete}
							className="bg-red-500 text-white hover:bg-red-600"
						>
							Eliminar
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</div>
	);
}

function Detail(props: { label: string; value: string; mono?: boolean }) {
	return (
		<div className="min-w-0 space-y-1">
			<p className="text-xs tracking-wider text-zinc-500 uppercase">
				{props.label}
			</p>
			<p
				className={
					props.mono
						? "truncate font-mono text-sm text-zinc-400"
						: "truncate text-sm font-medium text-white"
				}
			>
				{props.value}
			</p>
		</div>
	);
}

function MembersTab({
	data,
	refetchManagement,
	setFeedback,
}: {
	data: OrganizationManagementData;
	refetchManagement: () => Promise<unknown>;
	setFeedback: (message: string | null, type?: "success" | "error") => void;
}) {
	const [editingMemberId, setEditingMemberId] = useState<string | null>(null);
	const [pendingRole, setPendingRole] = useState<string>("");
	const [confirmRemoveMember, setConfirmRemoveMember] = useState<{
		memberId: string;
		name: string;
	} | null>(null);

	const updateRoleMutation = useMutation(
		orpcQuery.organization.updateMemberRole.mutationOptions(),
	);
	const removeMutation = useMutation(
		orpcQuery.organization.removeMember.mutationOptions(),
	);

	const startEditRole = (memberId: string, currentRole: string) => {
		setEditingMemberId(memberId);
		setPendingRole(currentRole);
	};

	const saveRole = async (memberId: string) => {
		setFeedback(null);
		try {
			await updateRoleMutation.mutateAsync({
				memberId,
				role: pendingRole,
			});
			await refetchManagement();
			setEditingMemberId(null);
			setFeedback("Rol actualizado.");
		} catch (error) {
			setFeedback(
				getErrorMessage(error, "No se pudo actualizar el rol."),
				"error",
			);
		}
	};

	const handleRemove = async () => {
		if (!confirmRemoveMember) return;
		const target = confirmRemoveMember.memberId;
		setConfirmRemoveMember(null);
		setFeedback(null);
		try {
			await removeMutation.mutateAsync({ memberIdOrEmail: target });
			await refetchManagement();
			setFeedback("Miembro removido.");
		} catch (error) {
			setFeedback(
				getErrorMessage(error, "No se pudo remover al miembro."),
				"error",
			);
		}
	};

	const viewerIsOwner = parseRoleList(data.viewer.role).includes("owner");
	const viewerIsAdmin = parseRoleList(data.viewer.role).includes("admin");
	const canEditMembers = data.viewer.canManageAccess;

	return (
		<Card className="border-zinc-800 bg-[var(--color-carbon)] shadow-none">
			<CardHeader>
				<CardTitle>Miembros Activos</CardTitle>
				<CardDescription className="text-zinc-400">
					Listado de usuarios con acceso a esta organización.
				</CardDescription>
			</CardHeader>
			<CardContent className="p-0">
				<Table>
					<TableHeader>
						<TableRow className="border-zinc-800 hover:bg-transparent">
							<TableHead className="px-4 text-zinc-400">Miembro</TableHead>
							<TableHead className="text-zinc-400">Rol</TableHead>
							<TableHead className="text-zinc-400">Ingreso</TableHead>
							{canEditMembers && (
								<TableHead className="text-zinc-400 text-right">Acciones</TableHead>
							)}
						</TableRow>
					</TableHeader>
					<TableBody>
						{data.members.map((member) => {
							const isSelf = member.userId === data.viewer.userId;
							const isEditing = editingMemberId === member.memberId;
							const memberRoles = parseRoleList(member.role);
							const isMemberOwner = memberRoles.includes("owner");
							// Prevent non-owners from editing an owner, and prevent removing last owner
							const canEditThis =
								canEditMembers &&
								(viewerIsOwner || !isMemberOwner) &&
								!isSelf;
							const canRemoveThis =
								canEditMembers && !isSelf && (viewerIsOwner || !isMemberOwner);

							return (
								<TableRow
									key={member.memberId}
									className="border-zinc-800 hover:bg-white/5"
								>
									<TableCell className="px-4">
										<div className="flex min-w-0 items-center gap-3">
											<div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-zinc-800">
												<span className="text-sm font-medium text-zinc-400">
													{member.name.charAt(0).toUpperCase()}
												</span>
											</div>
											<div className="min-w-0">
												<p className="truncate text-sm font-medium text-white">
													{member.name}
												</p>
												<p className="truncate text-xs text-zinc-500">
													{member.email}
												</p>
											</div>
										</div>
									</TableCell>
									<TableCell>
										{isEditing ? (
											<div className="flex items-center gap-2">
												<Select
													value={pendingRole}
													onValueChange={setPendingRole}
													disabled={updateRoleMutation.isPending}
												>
													<SelectTrigger className="h-8 w-32 border-zinc-800 bg-black/30 text-xs">
														<SelectValue />
													</SelectTrigger>
													<SelectContent>
														{ROLE_OPTIONS.map((r) => (
															<SelectItem key={r.value} value={r.value}>
																{r.label}
															</SelectItem>
														))}
													</SelectContent>
												</Select>
												<Button
													size="icon-sm"
													variant="ghost"
													onClick={() =>
														void saveRole(member.memberId)
													}
													disabled={updateRoleMutation.isPending}
													className="text-emerald-400 hover:text-emerald-300"
												>
													<Check className="size-4" />
												</Button>
												<Button
													size="icon-sm"
													variant="ghost"
													onClick={() => setEditingMemberId(null)}
													className="text-zinc-400 hover:text-zinc-300"
												>
													<XCircle className="size-4" />
												</Button>
											</div>
										) : (
											<Badge
												variant="outline"
												className="text-zinc-300"
											>
												{formatOrganizationRoleLabel(member.role)}
											</Badge>
										)}
									</TableCell>
									<TableCell className="text-sm text-zinc-400">
										{member.joinedAt
											? dateFormatter.format(member.joinedAt)
											: "N/A"}
									</TableCell>
									{canEditMembers && (
										<TableCell className="text-right">
											<div className="flex items-center justify-end gap-2">
												{canEditThis && !isEditing && (
													<Button
														variant="ghost"
														size="icon-sm"
														onClick={() =>
															startEditRole(
																member.memberId,
																member.role,
															)
														}
														className="text-zinc-400 hover:text-white"
													>
														<Pencil className="size-4" />
													</Button>
												)}
												{canRemoveThis && (
													<Button
														variant="ghost"
														size="icon-sm"
														onClick={() =>
															setConfirmRemoveMember({
																memberId: member.memberId,
																name: member.name,
															})
														}
														disabled={removeMutation.isPending}
														className="text-red-400 hover:text-red-300"
													>
														<UserX className="size-4" />
													</Button>
												)}
											</div>
										</TableCell>
									)}
								</TableRow>
							);
						})}
					</TableBody>
				</Table>
				{data.members.length === 0 ? (
					<div className="p-8 text-center text-sm text-zinc-500">
						No hay miembros en la organización.
						</div>
					) : null}
				</CardContent>

				<AlertDialog
					open={!!confirmRemoveMember}
					onOpenChange={() => setConfirmRemoveMember(null)}
				>
					<AlertDialogContent className="border-red-500/20 bg-[var(--color-carbon)] text-[var(--color-photon)]">
						<AlertDialogHeader>
							<AlertDialogTitle className="flex items-center gap-2 text-red-200">
								<AlertTriangle className="size-5" />
								Remover miembro
							</AlertDialogTitle>
							<AlertDialogDescription className="text-zinc-400">
								¿Seguro que deseas remover a{" "}
								<strong>{confirmRemoveMember?.name}</strong> de la
								organización?
							</AlertDialogDescription>
						</AlertDialogHeader>
						<AlertDialogFooter>
							<AlertDialogCancel className="border-zinc-700 bg-transparent text-zinc-200 hover:bg-white/5">
								Cancelar
							</AlertDialogCancel>
							<AlertDialogAction
								onClick={handleRemove}
								className="bg-red-500 text-white hover:bg-red-600"
							>
								Remover
							</AlertDialogAction>
						</AlertDialogFooter>
					</AlertDialogContent>
				</AlertDialog>
			</Card>
		);
	}

function InvitationsTab({
	data,
	refetchManagement,
	setFeedback,
}: {
	data: OrganizationManagementData;
	refetchManagement: () => Promise<unknown>;
	setFeedback: (message: string | null, type?: "success" | "error") => void;
}) {
	const [inviteEmail, setInviteEmail] = useState("");
	const [inviteRole, setInviteRole] = useState("member");
	const [confirmCancelId, setConfirmCancelId] = useState<string | null>(null);

	const inviteMutation = useMutation(
		orpcQuery.organization.inviteMember.mutationOptions(),
	);
	const cancelMutation = useMutation(
		orpcQuery.organization.cancelInvitation.mutationOptions(),
	);

	const handleInvite = async (event: React.FormEvent) => {
		event.preventDefault();
		setFeedback(null);
		try {
			await inviteMutation.mutateAsync({
				email: inviteEmail,
				role: inviteRole,
			});
			await refetchManagement();
			setInviteEmail("");
			setInviteRole("member");
			setFeedback("Invitación enviada.");
		} catch (error) {
			setFeedback(
				getErrorMessage(error, "No se pudo enviar la invitación."),
				"error",
			);
		}
	};

	const handleCancel = async () => {
		if (!confirmCancelId) return;
		const id = confirmCancelId;
		setConfirmCancelId(null);
		setFeedback(null);
		try {
			await cancelMutation.mutateAsync({ invitationId: id });
			await refetchManagement();
			setFeedback("Invitación cancelada.");
		} catch (error) {
			setFeedback(
				getErrorMessage(error, "No se pudo cancelar la invitación."),
				"error",
			);
		}
	};

	return (
		<div className="space-y-6">
			<Card className="border-zinc-800 bg-[var(--color-carbon)] shadow-none">
				<CardHeader>
					<CardTitle className="flex items-center gap-2">
						<UserPlus className="size-4 text-[var(--color-voltage)]" />
						Invitar Miembro
					</CardTitle>
					<CardDescription className="text-zinc-400">
						Envía una invitación por correo electrónico.
					</CardDescription>
				</CardHeader>
				<CardContent>
					{data.viewer.canManageAccess ? (
						<form onSubmit={handleInvite} className="space-y-4">
							<div className="grid gap-4 sm:grid-cols-2">
								<div className="space-y-2">
									<Label>Correo electrónico</Label>
									<Input
										type="email"
										value={inviteEmail}
										onChange={(e) => setInviteEmail(e.target.value)}
										placeholder="colaborador@ejemplo.com"
										required
										className="border-zinc-800 bg-black/30"
										disabled={inviteMutation.isPending}
									/>
								</div>
								<div className="space-y-2">
									<Label>Rol</Label>
									<Select
										value={inviteRole}
										onValueChange={setInviteRole}
										disabled={inviteMutation.isPending}
									>
										<SelectTrigger className="border-zinc-800 bg-black/30">
											<SelectValue />
										</SelectTrigger>
										<SelectContent>
											{ROLE_OPTIONS.map((r) => (
												<SelectItem key={r.value} value={r.value}>
													{r.label}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
								</div>
							</div>
							<Button
								type="submit"
								className="bg-[var(--color-voltage)] text-black hover:bg-[#d9f15c]"
								disabled={inviteMutation.isPending}
							>
								{inviteMutation.isPending ? (
									<>
										<Loader2 className="mr-2 size-4 animate-spin" />
										Enviando…
									</>
									) : (
										<>
											<UserPlus className="mr-2 size-4" />
											Enviar Invitación
										</>
									)}
							</Button>
						</form>
					) : (
						<Alert className="border-amber-500/20 bg-amber-500/10 text-amber-100">
							<AlertTitle>Acceso restringido</AlertTitle>
							<AlertDescription>
								Solo owners y admins pueden enviar invitaciones.
							</AlertDescription>
						</Alert>
					)}
				</CardContent>
			</Card>

			<Card className="border-zinc-800 bg-[var(--color-carbon)] shadow-none">
				<CardHeader>
					<CardTitle>Invitaciones Pendientes</CardTitle>
					<CardDescription className="text-zinc-400">
						Invitaciones internas que todavía no han sido aceptadas.
					</CardDescription>
				</CardHeader>
				<CardContent className="p-0">
					<Table>
						<TableHeader>
							<TableRow className="border-zinc-800 hover:bg-transparent">
								<TableHead className="px-4 text-zinc-400">Email</TableHead>
								<TableHead className="text-zinc-400">Rol</TableHead>
								<TableHead className="text-zinc-400">Expira</TableHead>
								{data.viewer.canManageAccess && (
									<TableHead className="text-zinc-400 text-right">Acciones</TableHead>
								)}
							</TableRow>
						</TableHeader>
						<TableBody>
							{data.pendingInvitations.map((invitation) => (
								<TableRow
									key={invitation.id}
									className="border-zinc-800 hover:bg-white/5"
								>
									<TableCell className="px-4 text-sm text-white">
										{invitation.email}
									</TableCell>
									<TableCell>
										<Badge variant="outline" className="text-zinc-300">
											{formatOrganizationRoleLabel(invitation.role)}
										</Badge>
									</TableCell>
									<TableCell className="text-sm text-zinc-400">
										{invitation.expiresAt
											? dateTimeFormatter.format(invitation.expiresAt)
											: "N/A"}
									</TableCell>
									{data.viewer.canManageAccess && (
										<TableCell className="text-right">
											<Button
												variant="ghost"
												size="sm"
												onClick={() =>
													setConfirmCancelId(invitation.id)
												}
												disabled={cancelMutation.isPending}
												className="text-red-400 hover:text-red-300"
											>
												<XCircle className="mr-1.5 size-3.5" />
												Cancelar
											</Button>
										</TableCell>
									)}
								</TableRow>
							))}
						</TableBody>
					</Table>
					{data.pendingInvitations.length === 0 ? (
						<div className="p-8 text-center text-sm text-zinc-500">
							No hay invitaciones pendientes.
						</div>
					) : null}
				</CardContent>
			</Card>

			<AlertDialog
				open={!!confirmCancelId}
				onOpenChange={() => setConfirmCancelId(null)}
			>
				<AlertDialogContent className="border-red-500/20 bg-[var(--color-carbon)] text-[var(--color-photon)]">
					<AlertDialogHeader>
						<AlertDialogTitle className="flex items-center gap-2 text-red-200">
							<AlertTriangle className="size-5" />
							Cancelar invitación
						</AlertDialogTitle>
						<AlertDialogDescription className="text-zinc-400">
							La invitación será cancelada y el destinatario no podrá
							aceptarla.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel className="border-zinc-700 bg-transparent text-zinc-200 hover:bg-white/5">
							Volver
						</AlertDialogCancel>
						<AlertDialogAction
							onClick={handleCancel}
							className="bg-red-500 text-white hover:bg-red-600"
						>
							Cancelar Invitación
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</div>
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
	const [showLeaveDialog, setShowLeaveDialog] = useState(false);
	const createJoinLinkMutation = useMutation(
		orpcQuery.organization.joinLinkCreate.mutationOptions(),
	);
	const revokeJoinLinkMutation = useMutation(
		orpcQuery.organization.joinLinkRevoke.mutationOptions(),
	);
	const leaveMutation = useMutation(
		orpcQuery.organization.leaveOrganization.mutationOptions(),
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

	const handleLeave = async () => {
		setShowLeaveDialog(false);
		setFeedback(null);
		try {
			await leaveMutation.mutateAsync({
				organizationId: data.organization.id,
			});
			setFeedback("Saliste de la organización. Redirigiendo...", "success");
			await authClient.organization.setActive({ organizationId: null });
			window.location.href = "/organization";
		} catch (error) {
			setFeedback(
				getErrorMessage(error, "No se pudo salir de la organización."),
				"error",
			);
		}
	};

	return (
		<div className="space-y-6">
			<div className="grid gap-6 lg:grid-cols-3">
				<Card className="lg:col-span-2 border-zinc-800 bg-[var(--color-carbon)] shadow-none">
					<CardHeader>
						<CardTitle>Crear Link de Acceso</CardTitle>
						<CardDescription className="text-zinc-400">
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
											onChange={(event) =>
												setJoinLinkLabel(event.target.value)
											}
											placeholder="Ej. Sucursal centro"
											autoComplete="off"
											className="border-zinc-800 bg-black/30"
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
												className="w-full border-zinc-800 bg-black/30"
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
											<Loader2 className="size-4 animate-spin" />
											Creando…
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

				<Card className="border-zinc-800 bg-[var(--color-carbon)] shadow-none">
					<CardHeader>
						<CardTitle>Modo de Alta</CardTitle>
						<CardDescription className="text-zinc-400">
							Política vigente para organizaciones.
						</CardDescription>
					</CardHeader>
					<CardContent className="space-y-4">
						<Badge
							variant="outline"
							className={
								data.policy.allowOrganizationCreation
									? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
									: "border-zinc-700 bg-zinc-800 text-zinc-400"
							}
						>
							{data.policy.allowOrganizationCreation
								? "Creación habilitada"
								: "Creación controlada"}
						</Badge>
						<p className="text-sm text-zinc-400">
							{data.policy.contactMessage}
						</p>
					</CardContent>
				</Card>
			</div>

			<Card className="border-zinc-800 bg-[var(--color-carbon)] shadow-none">
				<CardHeader>
					<div className="flex items-center justify-between gap-4">
						<CardTitle>Links de Acceso</CardTitle>
						<Badge variant="outline" className="text-zinc-400">
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
									className="flex flex-col gap-3 rounded-xl border border-zinc-800 bg-black/20 p-4 sm:flex-row sm:items-center sm:justify-between"
								>
									<div className="min-w-0 flex-1 space-y-1">
										<div className="flex flex-wrap items-center gap-2">
											<p className="truncate font-medium text-white">
												{joinLink.label || "Sin referencia"}
											</p>
											<JoinLinkStatusBadge status={joinLink.status} />
										</div>
										<p className="text-xs text-zinc-500">
											{joinLink.lastUsedAt
												? `Último uso ${dateTimeFormatter.format(joinLink.lastUsedAt)}`
												: "Sin uso todavía"}
											<span className="mx-2 text-zinc-700">•</span>
											Expira:{" "}
											{joinLink.expiresAt
												? dateTimeFormatter.format(joinLink.expiresAt)
												: "Sin límite"}
											<span className="mx-2 text-zinc-700">•</span>
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
											className="border-zinc-700 bg-transparent text-zinc-200 hover:bg-white/5"
										>
											<Copy className="mr-1.5 size-3.5" />
											Copiar
										</Button>
										{data.viewer.canManageAccess ? (
											<Button
												type="button"
												variant="outline"
												size="sm"
												onClick={() =>
													void handleRevokeJoinLink(joinLink.id)
												}
												disabled={
													joinLink.status === "revoked" ||
													revokeJoinLinkMutation.isPending
												}
												className="border-red-500/30 bg-transparent text-red-200 hover:bg-red-500/10"
											>
												<XCircle className="mr-1.5 size-3.5" />
												Revocar
											</Button>
										) : null}
									</div>
								</div>
							))}
						</div>
					) : (
						<div className="rounded-xl border border-dashed border-zinc-800 bg-black/10 p-8 text-center">
							<p className="text-sm text-zinc-500">
								No hay links de acceso creados todavía.
							</p>
						</div>
					)}
				</CardContent>
			</Card>

			<Card className="border-zinc-800 bg-[var(--color-carbon)] shadow-none">
				<CardHeader>
					<CardTitle>Salir de la Organización</CardTitle>
					<CardDescription className="text-zinc-400">
						Si ya no necesitas acceso, puedes salir en cualquier momento.
						No puedes salir si eres el único owner.
						</CardDescription>
					</CardHeader>
					<CardContent>
						<Button
							variant="outline"
							size="sm"
							onClick={() => setShowLeaveDialog(true)}
							disabled={leaveMutation.isPending}
							className="border-zinc-700 bg-transparent text-zinc-200 hover:bg-white/5"
						>
							{leaveMutation.isPending ? (
								<Loader2 className="mr-2 size-4 animate-spin" />
							) : (
								<LogOut className="mr-2 size-4" />
							)}
							Salir de la Organización
						</Button>
					</CardContent>
				</Card>

				<AlertDialog
					open={showLeaveDialog}
					onOpenChange={setShowLeaveDialog}
				>
					<AlertDialogContent className="border-amber-500/20 bg-[var(--color-carbon)] text-[var(--color-photon)]">
						<AlertDialogHeader>
							<AlertDialogTitle className="flex items-center gap-2 text-amber-200">
								<AlertTriangle className="size-5" />
								¿Salir de la organización?
							</AlertDialogTitle>
							<AlertDialogDescription className="text-zinc-400">
								Perderás acceso a todos los datos de{" "}
								<strong>{data.organization.name}</strong>. Esta acción no se
								puede deshacer.
							</AlertDialogDescription>
						</AlertDialogHeader>
						<AlertDialogFooter>
							<AlertDialogCancel className="border-zinc-700 bg-transparent text-zinc-200 hover:bg-white/5">
								Cancelar
							</AlertDialogCancel>
							<AlertDialogAction
								onClick={handleLeave}
								className="bg-amber-500 text-black hover:bg-amber-600"
							>
								Salir
							</AlertDialogAction>
						</AlertDialogFooter>
					</AlertDialogContent>
				</AlertDialog>
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

function parseRoleList(role: string | null | undefined) {
	return (role ?? "")
		.split(",")
		.flatMap((value) => {
			const trimmed = value.trim().toLowerCase();
			return trimmed ? [trimmed] : [];
		});
}
