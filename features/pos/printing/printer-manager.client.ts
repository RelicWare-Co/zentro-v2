import { useEffect, useSyncExternalStore } from "react";
import {
	encodeDrawerPulse,
	encodeThermalReceipt,
} from "@/features/pos/printing/encode-thermal-receipt.client";
import {
	getSavedDeviceForConnection,
	isPosEncodablePrinterLanguage,
	isPosPrinterConnectionTypeSupported,
	type PosLocalPrinterSettings,
	type PosPrinterConnectionType,
	type PosPrinterLanguage,
	type PosSavedBluetoothPrinterDevice,
	type PosSavedPrinterDevice,
	type PosSavedSerialPrinterDevice,
	type PosSavedUsbPrinterDevice,
	patchPosLocalPrinterSettings,
	readPosLocalPrinterSettings,
} from "@/features/pos/printing/printer-settings.local.client";
import type { ThermalReceiptDocument } from "@/features/pos/printing/thermal-receipt-document";

type EncodablePrinterLanguage = Exclude<PosPrinterLanguage, "auto">;

type PrinterStatusSnapshot = {
	online: boolean;
	coverOpened: boolean;
	paperLoaded: boolean;
	paperLow: boolean;
};

type PosPrinterRuntimeState = {
	status: "idle" | "connecting" | "connected" | "disconnected" | "error";
	message: string | null;
	connectionType: PosPrinterConnectionType | null;
	device: PosSavedPrinterDevice | null;
	language: EncodablePrinterLanguage | null;
	codepageMapping: string | null;
	supportsTwoWay: boolean | null;
	printerStatus: PrinterStatusSnapshot | null;
	cashDrawerOpened: boolean | null;
};

const DEFAULT_PRINTER_RUNTIME_STATE: PosPrinterRuntimeState = {
	status: "idle",
	message: null,
	connectionType: null,
	device: null,
	language: null,
	codepageMapping: null,
	supportsTwoWay: null,
	printerStatus: null,
	cashDrawerOpened: null,
};

type ConnectedDevicePayload = {
	type?: unknown;
	vendorId?: unknown;
	productId?: unknown;
	serialNumber?: unknown;
	manufacturerName?: unknown;
	productName?: unknown;
	id?: unknown;
	name?: unknown;
	language?: unknown;
	codepageMapping?: unknown;
};

interface ReceiptPrinterDriver {
	connect: () => Promise<void> | void;
	reconnect: (device: unknown) => Promise<void> | void;
	disconnect?: () => Promise<void> | void;
	listen?: () => Promise<boolean> | boolean;
	print: (data: Uint8Array | ArrayLike<number>) => Promise<void> | void;
	addEventListener(
		event: "connected",
		listener: (device: unknown) => void,
	): void;
	addEventListener(event: "disconnected", listener: () => void): void;
	addEventListener(
		event: "data",
		listener: (data: DataView | Uint8Array) => void,
	): void;
}

interface ReceiptPrinterStatusDriver {
	connected: boolean;
	language: string;
	status: {
		online: boolean;
		coverOpened: boolean;
		paperLoaded: boolean;
		paperLow: boolean;
	};
	cashDrawer: {
		open: () => void;
		opened: boolean;
		addEventListener(event: "update", listener: (state: unknown) => void): void;
		addEventListener(event: "open", listener: () => void): void;
		addEventListener(event: "close", listener: () => void): void;
	};
	addEventListener(event: "connected", listener: () => void): void;
	addEventListener(event: "unsupported", listener: () => void): void;
	addEventListener(event: "disconnected", listener: () => void): void;
	addEventListener(event: "update", listener: (state: unknown) => void): void;
}

function getErrorMessage(
	error: unknown,
	fallback = "No se pudo completar la operación",
) {
	if (error instanceof Error && error.message.trim().length > 0) {
		return error.message;
	}

	return fallback;
}

function toNullableString(value: unknown) {
	if (typeof value !== "string") {
		return null;
	}

	const trimmedValue = value.trim();
	return trimmedValue.length > 0 ? trimmedValue : null;
}

function toNullableNumber(value: unknown) {
	if (typeof value !== "number" || !Number.isFinite(value)) {
		return null;
	}

	return Math.round(value);
}

function toSavedPrinterDevice(
	connectionType: PosPrinterConnectionType,
	payload: ConnectedDevicePayload,
): PosSavedPrinterDevice {
	if (connectionType === "usb") {
		const vendorId = toNullableNumber(payload.vendorId) ?? 0;
		const productId = toNullableNumber(payload.productId) ?? 0;
		const language = isPosEncodablePrinterLanguage(payload.language)
			? payload.language
			: null;

		const device: PosSavedUsbPrinterDevice = {
			type: "usb",
			vendorId,
			productId,
			serialNumber: toNullableString(payload.serialNumber),
			manufacturerName: toNullableString(payload.manufacturerName),
			productName: toNullableString(payload.productName),
			language,
			codepageMapping: toNullableString(payload.codepageMapping),
		};

		return device;
	}

	if (connectionType === "bluetooth") {
		const device: PosSavedBluetoothPrinterDevice = {
			type: "bluetooth",
			id: toNullableString(payload.id) ?? "",
			name: toNullableString(payload.name),
			language: isPosEncodablePrinterLanguage(payload.language)
				? payload.language
				: null,
			codepageMapping: toNullableString(payload.codepageMapping),
		};

		return device;
	}

	const device: PosSavedSerialPrinterDevice = {
		type: "serial",
		vendorId: toNullableNumber(payload.vendorId),
		productId: toNullableNumber(payload.productId),
		language: isPosEncodablePrinterLanguage(payload.language)
			? payload.language
			: null,
		codepageMapping: toNullableString(payload.codepageMapping),
	};

	return device;
}

function toPrinterStatusSnapshot(value: unknown): PrinterStatusSnapshot | null {
	if (!value || typeof value !== "object") {
		return null;
	}

	const candidate = value as Record<string, unknown>;
	if (
		typeof candidate.online !== "boolean" ||
		typeof candidate.coverOpened !== "boolean" ||
		typeof candidate.paperLoaded !== "boolean" ||
		typeof candidate.paperLow !== "boolean"
	) {
		return null;
	}

	return {
		online: candidate.online,
		coverOpened: candidate.coverOpened,
		paperLoaded: candidate.paperLoaded,
		paperLow: candidate.paperLow,
	};
}

function toCashDrawerOpened(value: unknown) {
	if (!value || typeof value !== "object") {
		return null;
	}

	const candidate = value as Record<string, unknown>;
	if (typeof candidate.opened !== "boolean") {
		return null;
	}

	return candidate.opened;
}

type PendingConnection = {
	resolve: () => void;
	reject: (error: Error) => void;
	timeoutId: number;
};

class PosPrinterManager {
	private listeners = new Set<() => void>();
	private state: PosPrinterRuntimeState = DEFAULT_PRINTER_RUNTIME_STATE;
	private connectionType: PosPrinterConnectionType | null = null;
	private serialConfigHash = "";
	private printer: ReceiptPrinterDriver | null = null;
	private printerStatus: ReceiptPrinterStatusDriver | null = null;
	private runtimeOrganizationKey = "__none__";
	private eventGeneration = 0;
	private autoReconnectAttempted = new Set<string>();
	private pendingConnection: PendingConnection | null = null;

	private normalizeOrgKey(organizationId?: string | null): string {
		return organizationId ?? "__none__";
	}

	private resolveOrgIdFromKey(key: string): string | null {
		return key === "__none__" ? null : key;
	}

	subscribe(listener: () => void) {
		this.listeners.add(listener);
		return () => {
			this.listeners.delete(listener);
		};
	}

	getState() {
		return this.state;
	}

	private setState(nextValue: Partial<PosPrinterRuntimeState>) {
		this.state = {
			...this.state,
			...nextValue,
		};

		for (const listener of this.listeners) {
			listener();
		}
	}

	private resolveLanguage(settings: PosLocalPrinterSettings) {
		if (this.state.language) {
			return this.state.language;
		}

		if (isPosEncodablePrinterLanguage(this.state.device?.language)) {
			return this.state.device.language;
		}

		if (isPosEncodablePrinterLanguage(settings.language)) {
			return settings.language;
		}

		return "esc-pos";
	}

	private resolveCodepageMapping(settings: PosLocalPrinterSettings) {
		return (
			this.state.codepageMapping ??
			this.state.device?.codepageMapping ??
			settings.codepageMapping
		);
	}

	private ensureConnectionTypeIsSupported(
		connectionType: PosPrinterConnectionType,
	) {
		if (isPosPrinterConnectionTypeSupported(connectionType)) {
			return;
		}

		const labels: Record<PosPrinterConnectionType, string> = {
			usb: "WebUSB",
			serial: "WebSerial",
			bluetooth: "WebBluetooth",
		};

		throw new Error(
			`Tu navegador no soporta ${labels[connectionType]} para impresoras POS.`,
		);
	}

	private getSerialConfigHash(settings: PosLocalPrinterSettings) {
		return JSON.stringify(settings.serial);
	}

	private clearPendingConnection(error?: Error) {
		if (!this.pendingConnection) {
			return;
		}

		const pendingConnection = this.pendingConnection;
		this.pendingConnection = null;
		window.clearTimeout(pendingConnection.timeoutId);

		if (error) {
			pendingConnection.reject(error);
			return;
		}

		pendingConnection.resolve();
	}

	private async loadDriver(
		connectionType: PosPrinterConnectionType,
		settings: PosLocalPrinterSettings,
		organizationId?: string | null,
	) {
		const orgKey = this.normalizeOrgKey(organizationId);
		const serialConfigHash = this.getSerialConfigHash(settings);
		const shouldRecreateDriver =
			!this.printer ||
			this.connectionType !== connectionType ||
			this.runtimeOrganizationKey !== orgKey ||
			(connectionType === "serial" &&
				this.serialConfigHash !== serialConfigHash);

		if (!shouldRecreateDriver) {
			this.runtimeOrganizationKey = orgKey;
			return this.printer;
		}

		if (this.printer?.disconnect) {
			try {
				await this.printer.disconnect();
			} catch {
				/* ignore */
			}
		}

		this.printerStatus = null;
		this.pendingConnection = null;
		this.eventGeneration++;

		if (connectionType === "usb") {
			const module = await import("@point-of-sale/webusb-receipt-printer");
			const Driver = module.default as new () => ReceiptPrinterDriver;
			this.printer = new Driver();
		}

		if (connectionType === "serial") {
			const module = await import("@point-of-sale/webserial-receipt-printer");
			const Driver = module.default as new (
				options: PosLocalPrinterSettings["serial"],
			) => ReceiptPrinterDriver;
			this.printer = new Driver(settings.serial);
		}

		if (connectionType === "bluetooth") {
			const module = await import(
				"@point-of-sale/webbluetooth-receipt-printer"
			);
			const Driver = module.default as new () => ReceiptPrinterDriver;
			this.printer = new Driver();
		}

		if (!this.printer) {
			throw new Error("No se pudo inicializar el driver de impresión");
		}

		this.connectionType = connectionType;
		this.runtimeOrganizationKey = orgKey;
		this.serialConfigHash = serialConfigHash;
		this.bindPrinterEvents();

		return this.printer;
	}

	private bindPrinterEvents() {
		if (!this.printer || !this.connectionType) {
			return;
		}

		const activeConnectionType = this.connectionType;
		const boundGeneration = this.eventGeneration;

		this.printer.addEventListener("connected", (rawPayload) => {
			if (this.eventGeneration !== boundGeneration) {
				return;
			}
			if (this.connectionType !== activeConnectionType) {
				return;
			}

			const expectedPrinter = this.printer;
			if (!expectedPrinter) {
				return;
			}

			const payload =
				typeof rawPayload === "object" && rawPayload
					? (rawPayload as ConnectedDevicePayload)
					: {};

			const savedDevice = toSavedPrinterDevice(activeConnectionType, payload);
			if (
				savedDevice.type === "bluetooth" &&
				savedDevice.id.trim().length === 0
			) {
				this.setState({
					status: "error",
					message:
						"No fue posible identificar la impresora Bluetooth conectada.",
				});
				this.clearPendingConnection(
					new Error("Identificador Bluetooth inválido"),
				);
				return;
			}

			patchPosLocalPrinterSettings(
				(currentValue) => ({
					...currentValue,
					savedDevices: {
						...currentValue.savedDevices,
						[activeConnectionType]: savedDevice,
					},
				}),
				this.resolveOrgIdFromKey(this.runtimeOrganizationKey),
			);

			this.setState({
				status: "connected",
				message: null,
				connectionType: activeConnectionType,
				device: savedDevice,
				language: isPosEncodablePrinterLanguage(payload.language)
					? payload.language
					: isPosEncodablePrinterLanguage(savedDevice.language)
						? savedDevice.language
						: null,
				codepageMapping:
					toNullableString(payload.codepageMapping) ??
					savedDevice.codepageMapping,
				supportsTwoWay: null,
				printerStatus: null,
				cashDrawerOpened: null,
			});

			this.initializePrinterStatus(
				savedDevice,
				this.resolveOrgIdFromKey(this.runtimeOrganizationKey),
				expectedPrinter,
				boundGeneration,
			).catch(() => {
				this.setState({
					supportsTwoWay: false,
				});
			});

			this.clearPendingConnection();
		});

		this.printer.addEventListener("disconnected", () => {
			if (this.eventGeneration !== boundGeneration) {
				return;
			}
			if (this.connectionType !== activeConnectionType) {
				return;
			}

			this.setState({
				status: "disconnected",
				message: "La impresora se desconectó.",
				supportsTwoWay: null,
				printerStatus: null,
				cashDrawerOpened: null,
			});

			this.clearPendingConnection(new Error("La impresora se desconectó."));
		});
	}

	private async initializePrinterStatus(
		savedDevice: PosSavedPrinterDevice,
		organizationId: string | null,
		expectedPrinter: ReceiptPrinterDriver,
		boundGeneration: number,
	) {
		if (this.eventGeneration !== boundGeneration) {
			return;
		}

		const settings = readPosLocalPrinterSettings(organizationId);

		if (this.eventGeneration !== boundGeneration) {
			return;
		}
		if (this.printer !== expectedPrinter) {
			return;
		}

		const module = await import("@point-of-sale/receipt-printer-status");
		const ReceiptPrinterStatus = module.default as new (options: {
			printer: ReceiptPrinterDriver;
			language?: PosPrinterLanguage;
		}) => ReceiptPrinterStatusDriver;

		const statusLanguage =
			(isPosEncodablePrinterLanguage(savedDevice.language)
				? savedDevice.language
				: undefined) ??
			(isPosEncodablePrinterLanguage(settings.language)
				? settings.language
				: undefined);
		const printerStatus = new ReceiptPrinterStatus({
			printer: expectedPrinter,
			language: statusLanguage,
		});
		this.printerStatus = printerStatus;

		printerStatus.addEventListener("connected", () => {
			if (this.eventGeneration !== boundGeneration) {
				return;
			}
			if (this.printerStatus !== printerStatus) {
				return;
			}

			const detectedLanguage = isPosEncodablePrinterLanguage(
				printerStatus.language,
			)
				? printerStatus.language
				: this.state.language;

			this.setState({
				supportsTwoWay: true,
				language: detectedLanguage,
				printerStatus: toPrinterStatusSnapshot(printerStatus.status),
				cashDrawerOpened: printerStatus.cashDrawer.opened,
			});
		});

		printerStatus.addEventListener("unsupported", () => {
			if (this.eventGeneration !== boundGeneration) {
				return;
			}
			if (this.printerStatus !== printerStatus) {
				return;
			}

			this.setState({
				supportsTwoWay: false,
				printerStatus: null,
				cashDrawerOpened: null,
			});
		});

		printerStatus.addEventListener("disconnected", () => {
			if (this.eventGeneration !== boundGeneration) {
				return;
			}
			if (this.printerStatus !== printerStatus) {
				return;
			}

			this.setState({
				supportsTwoWay: null,
				printerStatus: null,
				cashDrawerOpened: null,
			});
		});

		printerStatus.addEventListener("update", (statusValue) => {
			if (this.eventGeneration !== boundGeneration) {
				return;
			}
			if (this.printerStatus !== printerStatus) {
				return;
			}

			this.setState({
				printerStatus:
					toPrinterStatusSnapshot(statusValue) ??
					toPrinterStatusSnapshot(printerStatus.status),
			});
		});

		printerStatus.cashDrawer.addEventListener("update", (statusValue) => {
			if (this.eventGeneration !== boundGeneration) {
				return;
			}
			if (this.printerStatus !== printerStatus) {
				return;
			}

			this.setState({
				cashDrawerOpened:
					toCashDrawerOpened(statusValue) ?? printerStatus.cashDrawer.opened,
			});
		});
	}

	private async waitForConnection(startConnection: () => Promise<void> | void) {
		this.clearPendingConnection();

		return await new Promise<void>((resolve, reject) => {
			const timeoutId = window.setTimeout(() => {
				this.pendingConnection = null;
				reject(new Error("No se pudo conectar con la impresora."));
			}, 12_000);

			this.pendingConnection = {
				resolve,
				reject,
				timeoutId,
			};

			Promise.resolve(startConnection()).catch((error) => {
				this.clearPendingConnection(
					error instanceof Error
						? error
						: new Error("Error intentando conectar la impresora"),
				);
			});
		});
	}

	async connectWithPrompt(
		settings?: PosLocalPrinterSettings,
		organizationId?: string | null,
	) {
		const resolvedSettings =
			settings ?? readPosLocalPrinterSettings(organizationId);
		const connectionType = resolvedSettings.connectionType;
		this.ensureConnectionTypeIsSupported(connectionType);

		await this.loadDriver(connectionType, resolvedSettings, organizationId);

		if (!this.printer) {
			throw new Error("No se pudo crear el driver de impresión");
		}

		this.setState({
			status: "connecting",
			message: null,
			connectionType,
		});

		try {
			await this.waitForConnection(() => this.printer?.connect());
			return this.state;
		} catch (error) {
			const message = getErrorMessage(
				error,
				"No fue posible conectar la impresora. Reintenta desde un botón de usuario.",
			);
			this.setState({
				status: "error",
				message,
			});
			throw new Error(message);
		}
	}

	async reconnectSaved(
		settings?: PosLocalPrinterSettings,
		options: {
			silent?: boolean;
		} = {},
		organizationId?: string | null,
	) {
		const resolvedSettings =
			settings ?? readPosLocalPrinterSettings(organizationId);
		const connectionType = resolvedSettings.connectionType;
		this.ensureConnectionTypeIsSupported(connectionType);

		const savedDevice = getSavedDeviceForConnection(
			resolvedSettings,
			connectionType,
		);
		if (!savedDevice) {
			if (!options.silent) {
				this.setState({
					status: "idle",
					message: "No hay impresora guardada para reconectar.",
					connectionType,
				});
			}
			return false;
		}

		if (
			savedDevice.type === "serial" &&
			(savedDevice.vendorId === null || savedDevice.productId === null)
		) {
			if (!options.silent) {
				this.setState({
					status: "error",
					message:
						"No se puede reconectar automáticamente una impresora serial sin vendor/product id.",
				});
			}
			return false;
		}

		await this.loadDriver(connectionType, resolvedSettings, organizationId);
		if (!this.printer) {
			return false;
		}

		if (!options.silent) {
			this.setState({
				status: "connecting",
				message: null,
				connectionType,
			});
		}

		try {
			await this.waitForConnection(() => this.printer?.reconnect(savedDevice));
			return true;
		} catch (error) {
			if (!options.silent) {
				this.setState({
					status: "error",
					message: getErrorMessage(
						error,
						"No se pudo reconectar con la impresora guardada.",
					),
				});
			}
			return false;
		}
	}

	async attemptAutoReconnect(
		settings?: PosLocalPrinterSettings,
		organizationId?: string | null,
	) {
		const resolvedSettings =
			settings ?? readPosLocalPrinterSettings(organizationId);
		if (!resolvedSettings.autoReconnect) {
			return false;
		}

		const attemptKey = `${this.normalizeOrgKey(organizationId)}:${resolvedSettings.connectionType}`;
		if (this.autoReconnectAttempted.has(attemptKey)) {
			return this.state.status === "connected";
		}

		this.autoReconnectAttempted.add(attemptKey);
		return this.reconnectSaved(resolvedSettings, { silent: true }, organizationId);
	}

	async disconnect() {
		if (this.printer?.disconnect) {
			await this.printer.disconnect();
		}

		this.printerStatus = null;
		this.runtimeOrganizationKey = "__none__";
		this.autoReconnectAttempted.clear();
		this.setState({
			status: "disconnected",
			message: "Impresora desconectada.",
			supportsTwoWay: null,
			printerStatus: null,
			cashDrawerOpened: null,
		});
	}

	private async ensureConnected(
		settings?: PosLocalPrinterSettings,
		organizationId?: string | null,
	) {
		const resolvedSettings =
			settings ?? readPosLocalPrinterSettings(organizationId);
		const orgKey = this.normalizeOrgKey(organizationId);
		if (
			this.state.status === "connected" &&
			this.state.connectionType === resolvedSettings.connectionType &&
			this.runtimeOrganizationKey === orgKey
		) {
			return;
		}

		const reconnectSucceeded = await this.reconnectSaved(
			resolvedSettings,
			{ silent: true },
			organizationId,
		);
		if (reconnectSucceeded) {
			return;
		}

		throw new Error(
			"No hay impresora conectada. Conéctala desde Ajustes > Impresión local.",
		);
	}

	async printReceipt(
		document: ThermalReceiptDocument,
		organizationId?: string | null,
	) {
		const settings = readPosLocalPrinterSettings(organizationId);
		await this.ensureConnected(settings, organizationId);

		if (!this.printer) {
			throw new Error("No hay driver de impresora activo");
		}

		const language = this.resolveLanguage(settings);
		const codepageMapping = this.resolveCodepageMapping(settings);
		const payload = encodeThermalReceipt({
			receipt: document.receipt,
			language,
			codepageMapping,
		});

		await Promise.resolve(this.printer.print(payload));

		if (settings.openDrawerAfterPrint) {
			await this.openCashDrawer(organizationId);
		}
	}

	async openCashDrawer(organizationId?: string | null) {
		const settings = readPosLocalPrinterSettings(organizationId);
		await this.ensureConnected(settings, organizationId);

		if (!this.printer) {
			throw new Error("No hay driver de impresora activo");
		}

		if (this.printerStatus?.connected) {
			this.printerStatus.cashDrawer.open();
			return;
		}

		const language = this.resolveLanguage(settings);
		const codepageMapping = this.resolveCodepageMapping(settings);
		const payload = encodeDrawerPulse({
			language,
			codepageMapping,
		});

		await Promise.resolve(this.printer.print(payload));
	}
}

const posPrinterManager = new PosPrinterManager();

export function getPosPrinterManager() {
	return posPrinterManager;
}

export function usePosPrinterRuntimeState(organizationId?: string | null) {
	const state = useSyncExternalStore(
		(listener) => posPrinterManager.subscribe(listener),
		() => posPrinterManager.getState(),
		() => DEFAULT_PRINTER_RUNTIME_STATE,
	);

	useEffect(() => {
		void posPrinterManager.attemptAutoReconnect(
			readPosLocalPrinterSettings(organizationId),
			organizationId,
		);
	}, [organizationId]);

	return state;
}
