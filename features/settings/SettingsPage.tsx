import {
	Building2,
	CreditCard,
	Loader2,
	Package,
	Plus,
	Save,
	Settings2,
	Store,
	UtensilsCrossed,
	Users,
} from "lucide-react";
import { useEffect, useId, useMemo, useState } from "react";
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
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { RestaurantModuleSettingsCard } from "@/features/restaurants/components/RestaurantModuleSettingsCard";
import {
	useRestaurantConfiguration,
} from "@/features/restaurants/hooks/use-restaurants";
import {
	useSettings,
	useUpdateSettingsMutation,
	type SettingsPageData,
} from "@/features/settings/hooks/use-settings";
import {
	normalizeOrganizationSettings,
	normalizePaymentMethodId,
	type OrganizationPaymentMethodSettings,
	type OrganizationSettings,
} from "@/features/settings/settings.shared";
import { formatMoneyInput, parseMoneyInput } from "@/lib/utils";

const dateFormatter = new Intl.DateTimeFormat("es-CO", {
	day: "numeric",
	month: "short",
	year: "numeric",
});

function getErrorMessage(error: unknown, fallback: string) {
	if (error instanceof Error && error.message) {
		return error.message;
	}
	return fallback;
}

export function SettingsPage() {
	const settingsQuery = useSettings();
	const updateSettingsMutation = useUpdateSettingsMutation();

	if (settingsQuery.isPending) {
		return (
			<div className="flex min-h-[60dvh] items-center justify-center">
				<Loader2 className="h-8 w-8 animate-spin text-[var(--color-voltage)]" />
			</div>
		);
	}

	if (settingsQuery.isError || !settingsQuery.data) {
		return (
			<div className="mx-auto max-w-3xl p-6 md:p-8">
				<Alert
					variant="destructive"
					className="border-red-500/20 bg-red-500/10 text-red-100"
				>
					<AlertTitle>No se pudo cargar configuración</AlertTitle>
					<AlertDescription>
						{getErrorMessage(settingsQuery.error, "Intenta recargar la página.")}
					</AlertDescription>
				</Alert>
			</div>
		);
	}

	return (
		<SettingsForm
			data={settingsQuery.data}
			isSaving={updateSettingsMutation.isPending}
			saveError={updateSettingsMutation.error}
			onSave={(settings) => updateSettingsMutation.mutateAsync({ settings })}
		/>
	);
}

function LocalPrinterSettingsSection({
	organizationId,
}: {
	organizationId: string;
}) {
	const [CardComponent, setCardComponent] = useState<
		React.ComponentType<{ organizationId: string }> | null
	>(null);

	useEffect(() => {
		let mounted = true;
		import("@/features/settings/components/LocalPrinterSettingsCard.client").then(
			(mod) => {
				if (mounted) setCardComponent(() => mod.LocalPrinterSettingsCard);
			},
		);
		return () => {
			mounted = false;
		};
	}, []);

	if (!CardComponent) {
		return (
			<Card className="border-gray-800 bg-[var(--color-carbon)] text-[var(--color-photon)] shadow-none">
				<CardHeader>
					<CardTitle className="flex items-center gap-2">
						<Settings2 className="h-4 w-4 text-[var(--color-voltage)]" />
						Impresión local
					</CardTitle>
					<CardDescription className="text-gray-400">
						Cargando configuración de impresora…
					</CardDescription>
				</CardHeader>
			</Card>
		);
	}

	return <CardComponent organizationId={organizationId} />;
}

function SettingsForm({
	data,
	isSaving,
	saveError,
	onSave,
}: {
	data: SettingsPageData;
	isSaving: boolean;
	saveError: unknown;
	onSave: (settings: OrganizationSettings) => Promise<unknown>;
}) {
	const canManageSettings = data.viewer.canManageSettings;
	const [draftSettings, setDraftSettings] = useState<OrganizationSettings>(() =>
		normalizeOrganizationSettings(data.settings),
	);
	const [showSavedMessage, setShowSavedMessage] = useState(false);
	const [newPaymentMethodLabel, setNewPaymentMethodLabel] = useState("");
	const [paymentMethodDraftError, setPaymentMethodDraftError] = useState<
		string | null
	>(null);
	const defaultTerminalNameId = useId();
	const defaultStartingCashId = useId();
	const defaultInterestRateId = useId();
	const lowStockThresholdId = useId();
	const defaultTaxRateId = useId();
	const newPaymentMethodId = useId();


	const persistedSettings = useMemo(
		() => normalizeOrganizationSettings(data.settings),
		[data.settings],
	);
	const hasChanges = useMemo(
		() => JSON.stringify(draftSettings) !== JSON.stringify(persistedSettings),
		[draftSettings, persistedSettings],
	);
	const newPaymentMethodSlug = useMemo(
		() => normalizePaymentMethodId(newPaymentMethodLabel),
		[newPaymentMethodLabel],
	);

	useEffect(() => {
		setDraftSettings(persistedSettings);
	}, [persistedSettings]);

	useEffect(() => {
		if (hasChanges) {
			setShowSavedMessage(false);
		}
	}, [hasChanges]);

	const handlePaymentMethodChange = (
		methodId: string,
		updates: Partial<OrganizationPaymentMethodSettings>,
	) => {
		setDraftSettings((currentValue) => ({
			...currentValue,
			pos: {
				...currentValue.pos,
				paymentMethods: currentValue.pos.paymentMethods.map((method) =>
					method.id === methodId
						? {
								...method,
								...updates,
								requiresReference:
									method.id === "cash"
										? false
										: (updates.requiresReference ?? method.requiresReference),
							}
						: method,
				),
			},
		}));
	};

	const handleAddPaymentMethod = () => {
		const trimmedLabel = newPaymentMethodLabel.trim();
		if (!trimmedLabel || !newPaymentMethodSlug) {
			setPaymentMethodDraftError(
				"Escribe un nombre válido para crear el método de pago.",
			);
			return;
		}

		if (
			draftSettings.pos.paymentMethods.some(
				(paymentMethod) => paymentMethod.id === newPaymentMethodSlug,
			)
		) {
			setPaymentMethodDraftError(
				`Ya existe un método con el código ${newPaymentMethodSlug}.`,
			);
			return;
		}

		setDraftSettings((currentValue) => ({
			...currentValue,
			pos: {
				...currentValue.pos,
				paymentMethods: [
					...currentValue.pos.paymentMethods,
					{
						id: newPaymentMethodSlug,
						label: trimmedLabel,
						enabled: true,
						requiresReference: true,
					},
				],
			},
		}));
		setNewPaymentMethodLabel("");
		setPaymentMethodDraftError(null);
	};

	const handleSave = async () => {
		if (!canManageSettings) return;
		await onSave(draftSettings);
		setShowSavedMessage(true);
	};

	const handleReset = () => {
		setDraftSettings(persistedSettings);
		setShowSavedMessage(false);
		setPaymentMethodDraftError(null);
	};

	return (
		<main className="space-y-6 bg-[var(--color-void)] p-6 text-[var(--color-photon)] md:p-8 lg:p-12">
			<section className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
				<div className="space-y-3">
					<Badge className="border-[var(--color-voltage)]/20 bg-[var(--color-voltage)]/10 text-[var(--color-voltage)] hover:bg-[var(--color-voltage)]/10">
						Configuración
					</Badge>
					<div className="space-y-2">
						<h1 className="text-3xl font-bold tracking-tight">
							Ajustes del negocio
						</h1>
						<p className="max-w-2xl text-sm text-gray-400 md:text-base">
							Reglas operativas para caja, pagos, crédito, inventario y módulos.
						</p>
					</div>
				</div>

				<div className="flex flex-col gap-3 sm:flex-row">
					<Button
						type="button"
						variant="outline"
						onClick={handleReset}
						disabled={!canManageSettings || !hasChanges || isSaving}
						className="border-gray-700 bg-[var(--color-carbon)] text-gray-200 hover:bg-white/5 hover:text-white"
					>
						Restablecer
					</Button>
					<Button
						type="button"
						onClick={() => void handleSave()}
						disabled={!canManageSettings || !hasChanges || isSaving}
						className="bg-[var(--color-voltage)] text-black hover:bg-[#d9f15c]"
					>
						<Save className="h-4 w-4" />
						{isSaving ? "Guardando..." : "Guardar cambios"}
					</Button>
				</div>
			</section>

			{showSavedMessage ? (
				<Alert
					className="border-emerald-500/20 bg-emerald-500/10 text-emerald-100"
					aria-live="polite"
				>
					<AlertTitle>Cambios guardados</AlertTitle>
					<AlertDescription>
						Los próximos flujos usarán esta configuración.
					</AlertDescription>
				</Alert>
			) : null}

			{!canManageSettings ? (
				<Alert className="border-gray-700 bg-[var(--color-carbon)] text-[var(--color-photon)]">
					<AlertTitle>Solo lectura</AlertTitle>
					<AlertDescription>
						Necesitas rol admin u owner para cambiar estos ajustes.
					</AlertDescription>
				</Alert>
			) : null}

			{saveError ? (
				<Alert
					variant="destructive"
					className="border-red-500/20 bg-red-500/10 text-red-100"
					aria-live="polite"
				>
					<AlertTitle>No se pudo guardar</AlertTitle>
					<AlertDescription>
						{getErrorMessage(saveError, "Revisa los campos e intenta otra vez.")}
					</AlertDescription>
				</Alert>
			) : null}

			<section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
				<SummaryCard
					title="Organización activa"
					value={data.organization.name}
					description={`Slug: ${data.organization.slug}`}
					icon={Building2}
				/>
				<SummaryCard
					title="Equipo"
					value={`${data.stats.membersCount}`}
					description={`${data.stats.invitationsCount} invitaciones pendientes`}
					icon={Users}
				/>
				<SummaryCard
					title="Catálogo"
					value={`${data.stats.productsCount}`}
					description={`${data.stats.customersCount} clientes registrados`}
					icon={Package}
				/>
				<SummaryCard
					title="Creada"
					value={dateFormatter.format(data.organization.createdAt)}
					description="Perfil de organización"
					icon={Settings2}
				/>
			</section>

			<section className="grid gap-6 xl:grid-cols-[1.1fr_1fr]">
				<div className="space-y-6">
					<Card className="border-gray-800 bg-[var(--color-carbon)] text-[var(--color-photon)] shadow-none">
						<CardHeader>
							<CardTitle className="flex items-center gap-2">
								<Store className="h-4 w-4 text-[var(--color-voltage)]" />
								Caja y POS
							</CardTitle>
							<CardDescription className="text-gray-400">
								Valores por defecto para apertura de turno y checkout.
							</CardDescription>
						</CardHeader>
						<CardContent className="space-y-6">
						<div className="grid gap-2">
							<Label htmlFor={defaultTerminalNameId}>
								Nombre por defecto de caja
							</Label>
							<Input
								id={defaultTerminalNameId}
								value={draftSettings.pos.defaultTerminalName}
								onChange={(event) =>
									setDraftSettings((currentValue) => ({
										...currentValue,
										pos: {
											...currentValue.pos,
											defaultTerminalName: event.target.value,
										},
									}))
								}
								disabled={!canManageSettings}
								className="border-gray-700 bg-black/20"
							/>
						</div>

						<div className="grid gap-2">
							<Label htmlFor={defaultStartingCashId}>
								Base inicial sugerida
							</Label>
							<Input
								id={defaultStartingCashId}
								type="text"
								inputMode="numeric"
								value={formatMoneyInput(draftSettings.pos.defaultStartingCash)}
								onChange={(event) =>
									setDraftSettings((currentValue) => ({
										...currentValue,
										pos: {
											...currentValue.pos,
											defaultStartingCash: parseMoneyInput(event.target.value),
										},
									}))
								}
								disabled={!canManageSettings}
								className="border-gray-700 bg-black/20"
							/>
						</div>

						<Separator className="bg-gray-800" />

						<div className="space-y-4">
							<div>
								<h3 className="font-medium text-white">Métodos de pago</h3>
								<p className="mt-1 text-sm text-gray-400">
									Configura etiquetas, disponibilidad y referencia obligatoria.
								</p>
							</div>

							<div className="space-y-3">
								{draftSettings.pos.paymentMethods.map((paymentMethod) => (
									<div
										key={paymentMethod.id}
										className="rounded-2xl border border-gray-800 bg-black/20 p-4"
									>
										<div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
											<div className="min-w-0 flex-1 space-y-3">
												<div className="grid gap-2">
													<Label htmlFor={`payment-method-${paymentMethod.id}`}>
														Nombre visible
													</Label>
													<Input
														id={`payment-method-${paymentMethod.id}`}
														value={paymentMethod.label}
														onChange={(event) =>
															handlePaymentMethodChange(paymentMethod.id, {
																label: event.target.value,
															})
														}
														disabled={!canManageSettings}
														className="border-gray-700 bg-black/20"
													/>
												</div>
												<p className="text-xs text-gray-500">
													Código interno:{" "}
													<span className="text-gray-400">
														{paymentMethod.id}
													</span>
												</p>
											</div>

											<div className="flex flex-wrap items-center gap-6">
												<ToggleControl
													label="Activo"
													checked={paymentMethod.enabled}
													disabled={
														!canManageSettings || paymentMethod.id === "cash"
													}
													onCheckedChange={(checked) =>
														handlePaymentMethodChange(paymentMethod.id, {
															enabled: checked,
														})
													}
												/>
												<ToggleControl
													label="Requiere referencia"
													checked={paymentMethod.requiresReference}
													disabled={
														!canManageSettings || paymentMethod.id === "cash"
													}
													onCheckedChange={(checked) =>
														handlePaymentMethodChange(paymentMethod.id, {
															requiresReference: checked,
														})
													}
												/>
											</div>
										</div>
									</div>
								))}
							</div>

							<div className="rounded-2xl border border-dashed border-gray-700 bg-black/10 p-4">
								<div className="grid gap-3 lg:grid-cols-[1fr_auto] lg:items-end">
									<div className="space-y-2">
										<Label htmlFor={newPaymentMethodId}>
											Agregar método personalizado
										</Label>
										<Input
											id={newPaymentMethodId}
											value={newPaymentMethodLabel}
											onChange={(event) => {
												if (paymentMethodDraftError) {
													setPaymentMethodDraftError(null);
												}
												setNewPaymentMethodLabel(event.target.value);
											}}
											disabled={!canManageSettings}
											placeholder="Ej. Daviplata, QR, Zelle"
											className="border-gray-700 bg-black/20"
										/>
										<p className="text-xs text-gray-500">
											Código interno:{" "}
											<span className="text-gray-400">
												{newPaymentMethodSlug || "Se genera automáticamente"}
											</span>
										</p>
									</div>
									<Button
										type="button"
										variant="outline"
										onClick={handleAddPaymentMethod}
										disabled={!canManageSettings}
										className="border-gray-700 bg-transparent text-gray-200 hover:bg-white/5 hover:text-white"
									>
										<Plus className="h-4 w-4" />
										Agregar
									</Button>
								</div>
								{paymentMethodDraftError ? (
									<p className="mt-3 text-sm text-red-400">
										{paymentMethodDraftError}
									</p>
								) : null}
							</div>
						</div>
					</CardContent>
				</Card>

				<LocalPrinterSettingsSection
					organizationId={data.organization.id}
				/>
			</div>

				<div className="space-y-6">
					<RestaurantConfigurationCard
						moduleAccess={data.modules.restaurants}
						draftSettings={draftSettings}
						canManageSettings={canManageSettings}
						onSettingsChange={setDraftSettings}
					/>

					<Card className="border-gray-800 bg-[var(--color-carbon)] text-[var(--color-photon)] shadow-none">
						<CardHeader>
							<CardTitle className="flex items-center gap-2">
								<CreditCard className="h-4 w-4 text-[var(--color-voltage)]" />
								Crédito
							</CardTitle>
							<CardDescription className="text-gray-400">
								Parámetros base para ventas fiadas y cartera.
							</CardDescription>
						</CardHeader>
						<CardContent className="space-y-6">
							<ToggleRow
								title="Permitir ventas a crédito"
								description="Controla si checkout puede dejar saldo pendiente."
								checked={draftSettings.credit.allowCreditSales}
								disabled={!canManageSettings}
								onCheckedChange={(checked) =>
									setDraftSettings((currentValue) => ({
										...currentValue,
										credit: {
											...currentValue.credit,
											allowCreditSales: checked,
										},
									}))
								}
							/>
							<div className="grid gap-2">
								<Label htmlFor={defaultInterestRateId}>
									Tasa de interés por defecto (%)
								</Label>
								<Input
									id={defaultInterestRateId}
									type="number"
									min={0}
									max={100}
									value={draftSettings.credit.defaultInterestRate}
									onChange={(event) =>
										setDraftSettings((currentValue) => ({
											...currentValue,
											credit: {
												...currentValue.credit,
												defaultInterestRate: Math.min(
													100,
													Math.max(0, Number(event.target.value) || 0),
												),
											},
										}))
									}
									disabled={!canManageSettings}
									className="border-gray-700 bg-black/20"
								/>
							</div>
						</CardContent>
					</Card>

					<Card className="border-gray-800 bg-[var(--color-carbon)] text-[var(--color-photon)] shadow-none">
						<CardHeader>
							<CardTitle className="flex items-center gap-2">
								<Package className="h-4 w-4 text-[var(--color-voltage)]" />
								Inventario
							</CardTitle>
							<CardDescription className="text-gray-400">
								Defaults para catálogo y alertas operativas.
							</CardDescription>
						</CardHeader>
						<CardContent className="space-y-6">
							<div className="grid gap-4 md:grid-cols-2">
								<div className="grid gap-2">
									<Label htmlFor={lowStockThresholdId}>
										Umbral de stock bajo
									</Label>
									<Input
										id={lowStockThresholdId}
										type="number"
										min={0}
										value={draftSettings.inventory.lowStockThreshold}
										onChange={(event) =>
											setDraftSettings((currentValue) => ({
												...currentValue,
												inventory: {
													...currentValue.inventory,
													lowStockThreshold: Math.max(
														0,
														Number(event.target.value) || 0,
													),
												},
											}))
										}
										disabled={!canManageSettings}
										className="border-gray-700 bg-black/20"
									/>
								</div>
								<div className="grid gap-2">
									<Label htmlFor={defaultTaxRateId}>
										Impuesto por defecto (%)
									</Label>
									<Input
										id={defaultTaxRateId}
										type="number"
										min={0}
										max={100}
										value={draftSettings.inventory.defaultTaxRate}
										onChange={(event) =>
											setDraftSettings((currentValue) => ({
												...currentValue,
												inventory: {
													...currentValue.inventory,
													defaultTaxRate: Math.min(
														100,
														Math.max(0, Number(event.target.value) || 0),
													),
												},
											}))
										}
										disabled={!canManageSettings}
										className="border-gray-700 bg-black/20"
									/>
								</div>
							</div>
							<ToggleRow
								title="Controlar inventario en productos nuevos"
								description="Preferencia inicial para altas de productos."
								checked={draftSettings.inventory.trackInventoryByDefault}
								disabled={!canManageSettings}
								onCheckedChange={(checked) =>
									setDraftSettings((currentValue) => ({
										...currentValue,
										inventory: {
											...currentValue.inventory,
											trackInventoryByDefault: checked,
										},
									}))
								}
							/>
							<ToggleRow
								title="Permitir modificadores por defecto"
								description="Útil para extras y adiciones frecuentes."
								checked={draftSettings.inventory.modifiersEnabledByDefault}
								disabled={!canManageSettings}
								onCheckedChange={(checked) =>
									setDraftSettings((currentValue) => ({
										...currentValue,
										inventory: {
											...currentValue.inventory,
											modifiersEnabledByDefault: checked,
										},
									}))
								}
							/>
						</CardContent>
					</Card>
				</div>
			</section>
		</main>
	);
}

function RestaurantConfigurationCard({
	moduleAccess,
	draftSettings,
	canManageSettings,
	onSettingsChange,
}: {
	moduleAccess: SettingsPageData["modules"]["restaurants"];
	draftSettings: OrganizationSettings;
	canManageSettings: boolean;
	onSettingsChange: (
		updater: (currentValue: OrganizationSettings) => OrganizationSettings,
	) => void;
}) {
	const { data: configuration } = useRestaurantConfiguration();

	return (
		<RestaurantModuleSettingsCard
			moduleAccess={moduleAccess}
			configuration={configuration ?? []}
			settings={draftSettings}
			canManageSettings={canManageSettings}
			onSettingsChange={onSettingsChange}
		/>
	);
}

function SummaryCard({
	title,
	value,
	description,
	icon: Icon,
}: {
	title: string;
	value: string;
	description: string;
	icon: typeof Building2;
}) {
	return (
		<Card className="border-gray-800 bg-[var(--color-carbon)] text-[var(--color-photon)] shadow-none">
			<CardHeader className="space-y-4">
				<div className="flex items-center gap-3">
					<div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-[var(--color-voltage)]/20 bg-[var(--color-voltage)]/10 text-[var(--color-voltage)]">
						<Icon className="h-4 w-4" />
					</div>
					<div className="min-w-0 flex-1">
						<CardDescription className="text-gray-400">{title}</CardDescription>
						<CardTitle className="mt-1 truncate text-xl font-semibold tracking-tight text-white">
							{value}
						</CardTitle>
					</div>
				</div>
			</CardHeader>
			<CardContent className="pt-0">
				<p className="text-sm leading-6 text-gray-400">{description}</p>
			</CardContent>
		</Card>
	);
}

function ToggleControl({
	label,
	checked,
	disabled,
	onCheckedChange,
}: {
	label: string;
	checked: boolean;
	disabled?: boolean;
	onCheckedChange: (checked: boolean) => void;
}) {
	return (
		<div className="flex items-center gap-3">
			<Switch
				checked={checked}
				disabled={disabled}
				onCheckedChange={onCheckedChange}
			/>
			<span className="text-sm text-gray-300">{label}</span>
		</div>
	);
}

function ToggleRow({
	id,
	title,
	description,
	checked,
	disabled,
	onCheckedChange,
}: {
	id?: string;
	title: string;
	description: string;
	checked: boolean;
	disabled?: boolean;
	onCheckedChange: (checked: boolean) => void;
}) {
	return (
		<div className="flex items-center justify-between gap-4 rounded-2xl border border-gray-800 bg-black/20 p-4">
			<div>
				<Label htmlFor={id} className="font-medium text-white">
					{title}
				</Label>
				<p className="mt-1 text-sm text-gray-400">{description}</p>
			</div>
			<Switch
				id={id}
				checked={checked}
				disabled={disabled}
				onCheckedChange={onCheckedChange}
			/>
		</div>
	);
}
