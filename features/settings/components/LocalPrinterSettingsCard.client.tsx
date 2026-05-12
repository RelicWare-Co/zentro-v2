import {
	Printer,
	RefreshCcw,
	ScanLine,
	Settings2,
	TestTube2,
	Usb,
} from "lucide-react";
import { useMemo, useState } from "react";
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
	NativeSelect,
	NativeSelectOption,
} from "@/components/ui/native-select";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { usePosPrinterRuntimeState } from "@/features/pos/printing/printer-manager.client";
import {
	formatPosSavedPrinterDeviceLabel,
	getSavedDeviceForConnection,
	isPosPrinterConnectionTypeSupported,
	POS_PRINTER_CONNECTION_TYPES,
	POS_PRINTER_LANGUAGES,
	POS_PRINTER_OUTPUT_MODES,
	type PosLocalPrinterSettings,
	usePosLocalPrinterSettings,
} from "@/features/pos/printing/printer-settings.local.client";
import {
	connectPosPrinter,
	disconnectPosPrinter,
	openPosCashDrawer,
	printPosPrinterTestDocument,
	reconnectPosPrinter,
} from "@/features/pos/printing/print-thermal-receipt.client";

function toIntegerInRange(
	value: string,
	fallback: number,
	minimum: number,
	maximum: number,
) {
	const parsedValue = Number(value);
	if (!Number.isFinite(parsedValue)) {
		return fallback;
	}

	return Math.min(maximum, Math.max(minimum, Math.round(parsedValue)));
}

function buildStatusBadgeLabel(
	status: ReturnType<typeof usePosPrinterRuntimeState>["status"],
) {
	switch (status) {
		case "connecting":
			return "Conectando";
		case "connected":
			return "Conectada";
		case "disconnected":
			return "Desconectada";
		case "error":
			return "Error";
		default:
			return "Inactiva";
	}
}

function buildStatusBadgeClassName(
	status: ReturnType<typeof usePosPrinterRuntimeState>["status"],
) {
	switch (status) {
		case "connected":
			return "border-emerald-500/30 bg-emerald-500/10 text-emerald-200";
		case "connecting":
			return "border-amber-500/30 bg-amber-500/10 text-amber-200";
		case "error":
			return "border-red-500/30 bg-red-500/10 text-red-200";
		default:
			return "border-zinc-700 bg-black/20 text-zinc-300";
	}
}

export function LocalPrinterSettingsCard({
	organizationId,
}: {
	organizationId: string;
}) {
	const { settings, setSettings, resetSettings } =
		usePosLocalPrinterSettings(organizationId);
	const runtimeState = usePosPrinterRuntimeState(organizationId);
	const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
	const [feedbackError, setFeedbackError] = useState<string | null>(null);
	const [isBusy, setIsBusy] = useState(false);

	const connectionSupported = isPosPrinterConnectionTypeSupported(
		settings.connectionType,
	);
	const savedDevice = getSavedDeviceForConnection(
		settings,
		settings.connectionType,
	);
	const savedDeviceLabel = useMemo(
		() => formatPosSavedPrinterDeviceLabel(savedDevice),
		[savedDevice],
	);

	const setConnectionSettings = (
		updater: (currentValue: PosLocalPrinterSettings) => PosLocalPrinterSettings,
	) => {
		setSettings((currentValue) => updater(currentValue));
		setFeedbackMessage(null);
		setFeedbackError(null);
	};

	const executeAction = async (
		action: () => Promise<unknown>,
		successMessage: string,
	) => {
		setIsBusy(true);
		setFeedbackMessage(null);
		setFeedbackError(null);

		try {
			const result = await action();
			if (result === false) {
				throw new Error("No se pudo completar la operación solicitada.");
			}
			setFeedbackMessage(successMessage);
		} catch (error) {
			setFeedbackError(
				error instanceof Error
					? error.message
					: "No se pudo completar la operación con la impresora.",
			);
		} finally {
			setIsBusy(false);
		}
	};

	return (
		<Card className="border-zinc-800 bg-[var(--color-carbon)] text-[var(--color-photon)] shadow-none">
			<CardHeader>
				<CardTitle className="flex items-center gap-2">
					<Printer className="size-4 text-[var(--color-voltage)]" />
					Impresión local
				</CardTitle>
				<CardDescription className="text-zinc-400">
					Configura impresión por USB, Bluetooth o Serial en este dispositivo.
				</CardDescription>
			</CardHeader>
			<CardContent className="space-y-5">
				<div className="flex flex-wrap items-center gap-2">
					<Badge className={buildStatusBadgeClassName(runtimeState.status)}>
						{buildStatusBadgeLabel(runtimeState.status)}
					</Badge>
					<Badge className="border-zinc-700 bg-black/20 text-zinc-300">
						Modo: {settings.outputMode === "pdf" ? "PDF" : "Impresora POS"}
					</Badge>
					<Badge className="border-zinc-700 bg-black/20 text-zinc-300">
						Canal: {settings.connectionType.toUpperCase()}
					</Badge>
				</div>

				{runtimeState.printerStatus ? (
					<div className="rounded-2xl border border-zinc-800 bg-black/20 p-3 text-xs text-zinc-300">
						<p>
							Estado impresora:{" "}
							{runtimeState.printerStatus.online ? "Online" : "Offline"}· Papel{" "}
							{runtimeState.printerStatus.paperLoaded ? "ok" : "sin papel"}·
							Tapa{" "}
							{runtimeState.printerStatus.coverOpened ? "abierta" : "cerrada"}
						</p>
						<p>
							Papel bajo: {runtimeState.printerStatus.paperLow ? "sí" : "no"} ·
							Caja:{" "}
							{runtimeState.cashDrawerOpened === null
								? "sin dato"
								: runtimeState.cashDrawerOpened
									? "abierta"
									: "cerrada"}
						</p>
					</div>
				) : runtimeState.supportsTwoWay === false ? (
					<Alert className="border-amber-500/20 bg-amber-500/10 text-amber-100">
						<AlertTitle>Canal unidireccional</AlertTitle>
						<AlertDescription>
							Esta impresora permite imprimir, pero no reporta estado de
							papel/tapa/caja.
						</AlertDescription>
					</Alert>
				) : null}

				{runtimeState.message ? (
					<Alert className="border-zinc-700 bg-black/20 text-zinc-200">
						<AlertTitle>Estado del driver</AlertTitle>
						<AlertDescription>{runtimeState.message}</AlertDescription>
					</Alert>
				) : null}

				{feedbackMessage ? (
					<Alert className="border-emerald-500/20 bg-emerald-500/10 text-emerald-100">
						<AlertTitle>Operación exitosa</AlertTitle>
						<AlertDescription>{feedbackMessage}</AlertDescription>
					</Alert>
				) : null}

				{feedbackError ? (
					<Alert
						variant="destructive"
						className="border-red-500/20 bg-red-500/10 text-red-100"
					>
						<AlertTitle>No se pudo completar</AlertTitle>
						<AlertDescription>{feedbackError}</AlertDescription>
					</Alert>
				) : null}

				<div className="space-y-3 rounded-2xl border border-zinc-800 bg-black/20 p-4">
					<ToggleRow
						title="Usar impresora POS"
						description="Cuando está activo, el POS intenta imprimir directo al dispositivo."
						checked={settings.outputMode === "device"}
						onCheckedChange={(checked) =>
							setConnectionSettings((currentValue) => ({
								...currentValue,
								outputMode: checked ? "device" : "pdf",
							}))
						}
					/>
					<ToggleRow
						title="Reconectar al abrir"
						description="Intenta reconectar automáticamente a la última impresora guardada."
						checked={settings.autoReconnect}
						onCheckedChange={(checked) =>
							setConnectionSettings((currentValue) => ({
								...currentValue,
								autoReconnect: checked,
							}))
						}
					/>
					<ToggleRow
						title="Abrir caja tras imprimir"
						description="Si la impresora soporta DK, envía pulso automático al terminar un recibo."
						checked={settings.openDrawerAfterPrint}
						onCheckedChange={(checked) =>
							setConnectionSettings((currentValue) => ({
								...currentValue,
								openDrawerAfterPrint: checked,
							}))
						}
					/>
				</div>

				<div className="grid gap-3 md:grid-cols-2">
					<div className="grid gap-2">
						<Label>Tipo de conexión</Label>
						<NativeSelect
							value={settings.connectionType}
							onChange={(event) =>
								setConnectionSettings((currentValue) => ({
									...currentValue,
									connectionType: event.target
										.value as PosLocalPrinterSettings["connectionType"],
								}))
							}
							className="w-full"
						>
							{POS_PRINTER_CONNECTION_TYPES.map((connectionType) => (
								<NativeSelectOption key={connectionType} value={connectionType}>
									{connectionType.toUpperCase()}
								</NativeSelectOption>
							))}
						</NativeSelect>
					</div>

					<div className="grid gap-2">
						<Label>Lenguaje de fallback</Label>
						<NativeSelect
							value={settings.language}
							onChange={(event) =>
								setConnectionSettings((currentValue) => ({
									...currentValue,
									language: event.target
										.value as PosLocalPrinterSettings["language"],
								}))
							}
							className="w-full"
						>
							{POS_PRINTER_LANGUAGES.map((language) => (
								<NativeSelectOption key={language} value={language}>
									{language}
								</NativeSelectOption>
							))}
						</NativeSelect>
					</div>

					<div className="grid gap-2">
						<Label>Mapping de codepage</Label>
						<Input
							value={settings.codepageMapping}
							onChange={(event) =>
								setConnectionSettings((currentValue) => ({
									...currentValue,
									codepageMapping: event.target.value,
								}))
							}
							placeholder="epson"
							className="border-zinc-700 bg-black/20"
						/>
					</div>

					<div className="grid gap-2">
						<Label>Modo de salida</Label>
						<NativeSelect
							value={settings.outputMode}
							onChange={(event) =>
								setConnectionSettings((currentValue) => ({
									...currentValue,
									outputMode: event.target
										.value as PosLocalPrinterSettings["outputMode"],
								}))
							}
							className="w-full"
						>
							{POS_PRINTER_OUTPUT_MODES.map((outputMode) => (
								<NativeSelectOption key={outputMode} value={outputMode}>
									{outputMode === "pdf" ? "PDF" : "Impresora"}
								</NativeSelectOption>
							))}
						</NativeSelect>
					</div>
				</div>

				{settings.connectionType === "serial" ? (
					<>
						<Separator className="border-zinc-800" />
						<div className="space-y-3 rounded-2xl border border-zinc-800 bg-black/20 p-4">
							<div className="flex items-center gap-2 text-sm font-medium text-zinc-200">
								<Usb className="size-4 text-[var(--color-voltage)]" />
								Parámetros Serial
							</div>
							<div className="grid gap-3 md:grid-cols-3">
								<NumberField
									label="Baud rate"
									value={settings.serial.baudRate}
									onChange={(value) =>
										setConnectionSettings((currentValue) => ({
											...currentValue,
											serial: {
												...currentValue.serial,
												baudRate: toIntegerInRange(value, 9600, 300, 115200),
											},
										}))
									}
								/>
								<NumberField
									label="Buffer"
									value={settings.serial.bufferSize}
									onChange={(value) =>
										setConnectionSettings((currentValue) => ({
											...currentValue,
											serial: {
												...currentValue.serial,
												bufferSize: toIntegerInRange(value, 255, 64, 4096),
											},
										}))
									}
								/>
								<div className="grid gap-2">
									<Label>Data bits</Label>
									<NativeSelect
										value={String(settings.serial.dataBits)}
										onChange={(event) =>
											setConnectionSettings((currentValue) => ({
												...currentValue,
												serial: {
													...currentValue.serial,
													dataBits: event.target.value === "7" ? 7 : 8,
												},
											}))
										}
										className="w-full"
									>
										<NativeSelectOption value="8">8</NativeSelectOption>
										<NativeSelectOption value="7">7</NativeSelectOption>
									</NativeSelect>
								</div>
								<div className="grid gap-2">
									<Label>Paridad</Label>
									<NativeSelect
										value={settings.serial.parity}
										onChange={(event) =>
											setConnectionSettings((currentValue) => ({
												...currentValue,
												serial: {
													...currentValue.serial,
													parity: event.target
														.value as PosLocalPrinterSettings["serial"]["parity"],
												},
											}))
										}
										className="w-full"
									>
										<NativeSelectOption value="none">none</NativeSelectOption>
										<NativeSelectOption value="even">even</NativeSelectOption>
										<NativeSelectOption value="odd">odd</NativeSelectOption>
									</NativeSelect>
								</div>
								<div className="grid gap-2">
									<Label>Flow control</Label>
									<NativeSelect
										value={settings.serial.flowControl}
										onChange={(event) =>
											setConnectionSettings((currentValue) => ({
												...currentValue,
												serial: {
													...currentValue.serial,
													flowControl: event.target
														.value as PosLocalPrinterSettings["serial"]["flowControl"],
												},
											}))
										}
										className="w-full"
									>
										<NativeSelectOption value="none">none</NativeSelectOption>
										<NativeSelectOption value="hardware">
											hardware
										</NativeSelectOption>
									</NativeSelect>
								</div>
								<div className="grid gap-2">
									<Label>Stop bits</Label>
									<NativeSelect
										value={String(settings.serial.stopBits)}
										onChange={(event) =>
											setConnectionSettings((currentValue) => ({
												...currentValue,
												serial: {
													...currentValue.serial,
													stopBits: event.target.value === "2" ? 2 : 1,
												},
											}))
										}
										className="w-full"
									>
										<NativeSelectOption value="1">1</NativeSelectOption>
										<NativeSelectOption value="2">2</NativeSelectOption>
									</NativeSelect>
								</div>
							</div>
						</div>
					</>
				) : null}

				<Separator className="border-zinc-800" />

				<div className="rounded-2xl border border-zinc-800 bg-black/20 p-4 text-sm text-zinc-300">
					<p className="font-medium text-zinc-100">Impresora guardada</p>
					<p className="mt-1 text-xs text-zinc-400">{savedDeviceLabel}</p>
				</div>

				{!connectionSupported ? (
					<Alert
						variant="destructive"
						className="border-red-500/20 bg-red-500/10 text-red-100"
					>
						<AlertTitle>Navegador sin soporte</AlertTitle>
						<AlertDescription>
							Este navegador no soporta {settings.connectionType.toUpperCase()}{" "}
							para impresión directa. Cambia a PDF o usa otro navegador
							compatible.
						</AlertDescription>
					</Alert>
				) : null}

				<div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
					<Button
						type="button"
						onClick={() =>
							executeAction(
								() => connectPosPrinter(organizationId),
								"Impresora conectada.",
							)
						}
						disabled={isBusy || !connectionSupported}
						className="bg-[var(--color-voltage)] text-black hover:bg-[#d9f15c]"
					>
						<ScanLine className="size-4" />
						Conectar
					</Button>
					<Button
						type="button"
						variant="outline"
						onClick={() =>
							executeAction(
								() => reconnectPosPrinter({}, organizationId),
								"Reconexión finalizada.",
							)
						}
						disabled={isBusy || !connectionSupported || !savedDevice}
						className="border-zinc-700 bg-transparent text-zinc-200 hover:bg-white/5 hover:text-white"
					>
						<RefreshCcw className="size-4" />
						Reconectar
					</Button>
					<Button
						type="button"
						variant="outline"
						onClick={() =>
							executeAction(
								() => disconnectPosPrinter(),
								"Impresora desconectada.",
							)
						}
						disabled={isBusy || runtimeState.status !== "connected"}
						className="border-zinc-700 bg-transparent text-zinc-200 hover:bg-white/5 hover:text-white"
					>
						<Settings2 className="size-4" />
						Desconectar
					</Button>
					<Button
						type="button"
						variant="outline"
						onClick={() =>
							executeAction(
								() => printPosPrinterTestDocument(organizationId),
								"Ticket de prueba enviado.",
							)
						}
						disabled={isBusy}
						className="border-zinc-700 bg-transparent text-zinc-200 hover:bg-white/5 hover:text-white"
					>
						<TestTube2 className="size-4" />
						Imprimir prueba
					</Button>
					<Button
						type="button"
						variant="outline"
						onClick={() =>
							executeAction(
								() => openPosCashDrawer(organizationId),
								"Pulso de caja enviado.",
							)
						}
						disabled={isBusy || !connectionSupported}
						className="border-zinc-700 bg-transparent text-zinc-200 hover:bg-white/5 hover:text-white"
					>
						<Usb className="size-4" />
						Abrir caja
					</Button>
					<Button
						type="button"
						variant="outline"
						onClick={() => {
							resetSettings();
							setFeedbackMessage("Configuración local restablecida.");
							setFeedbackError(null);
						}}
						disabled={isBusy}
						className="border-zinc-700 bg-transparent text-zinc-200 hover:bg-white/5 hover:text-white"
					>
						<RefreshCcw className="size-4" />
						Restablecer local
					</Button>
				</div>
			</CardContent>
		</Card>
	);
}

function NumberField({
	label,
	value,
	onChange,
}: {
	label: string;
	value: number;
	onChange: (value: string) => void;
}) {
	return (
		<div className="grid gap-2">
			<Label>{label}</Label>
			<Input
				type="number"
				inputMode="numeric"
				value={value}
				onChange={(event) => onChange(event.target.value)}
				className="border-zinc-700 bg-black/20"
			/>
		</div>
	);
}

function ToggleRow({
	title,
	description,
	checked,
	onCheckedChange,
}: {
	title: string;
	description: string;
	checked: boolean;
	onCheckedChange: (checked: boolean) => void;
}) {
	return (
		<div className="flex items-center justify-between rounded-xl border border-zinc-800 bg-black/10 p-3">
			<div>
				<p className="text-sm font-medium text-white">{title}</p>
				<p className="text-xs text-zinc-400">{description}</p>
			</div>
			<Switch checked={checked} onCheckedChange={onCheckedChange} />
		</div>
	);
}
