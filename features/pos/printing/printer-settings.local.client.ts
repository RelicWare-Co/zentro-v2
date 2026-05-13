import { useCallback, useEffect, useMemo, useState } from "react";

const POS_PRINTER_SETTINGS_STORAGE_KEY = "zentro:pos-printer-settings:v1";
const POS_PRINTER_SETTINGS_EVENT = "zentro:pos-printer-settings:updated";

export const POS_PRINTER_CONNECTION_TYPES = [
  "usb",
  "serial",
  "bluetooth",
] as const;
export type PosPrinterConnectionType =
  (typeof POS_PRINTER_CONNECTION_TYPES)[number];

export const POS_PRINTER_OUTPUT_MODES = ["pdf", "device"] as const;
type PosPrinterOutputMode = (typeof POS_PRINTER_OUTPUT_MODES)[number];

export const POS_PRINTER_LANGUAGES = [
  "auto",
  "esc-pos",
  "star-prnt",
  "star-line",
] as const;
export type PosPrinterLanguage = (typeof POS_PRINTER_LANGUAGES)[number];

export interface PosSavedUsbPrinterDevice {
  codepageMapping: string | null;
  language: PosPrinterLanguage | null;
  manufacturerName: string | null;
  productId: number;
  productName: string | null;
  serialNumber: string | null;
  type: "usb";
  vendorId: number;
}

export interface PosSavedSerialPrinterDevice {
  codepageMapping: string | null;
  language: PosPrinterLanguage | null;
  productId: number | null;
  type: "serial";
  vendorId: number | null;
}

export interface PosSavedBluetoothPrinterDevice {
  codepageMapping: string | null;
  id: string;
  language: PosPrinterLanguage | null;
  name: string | null;
  type: "bluetooth";
}

export type PosSavedPrinterDevice =
  | PosSavedUsbPrinterDevice
  | PosSavedSerialPrinterDevice
  | PosSavedBluetoothPrinterDevice;

interface PosPrinterSerialConfig {
  baudRate: number;
  bufferSize: number;
  dataBits: 7 | 8;
  flowControl: "none" | "hardware";
  parity: "none" | "even" | "odd";
  stopBits: 1 | 2;
}

export interface PosLocalPrinterSettings {
  autoReconnect: boolean;
  codepageMapping: string;
  connectionType: PosPrinterConnectionType;
  language: PosPrinterLanguage;
  openDrawerAfterPrint: boolean;
  outputMode: PosPrinterOutputMode;
  savedDevices: {
    usb: PosSavedUsbPrinterDevice | null;
    serial: PosSavedSerialPrinterDevice | null;
    bluetooth: PosSavedBluetoothPrinterDevice | null;
  };
  serial: PosPrinterSerialConfig;
}

const DEFAULT_POS_LOCAL_PRINTER_SETTINGS: PosLocalPrinterSettings = {
  outputMode: "pdf",
  connectionType: "usb",
  language: "auto",
  codepageMapping: "epson",
  autoReconnect: true,
  openDrawerAfterPrint: false,
  serial: {
    baudRate: 9600,
    bufferSize: 255,
    dataBits: 8,
    flowControl: "none",
    parity: "none",
    stopBits: 1,
  },
  savedDevices: {
    usb: null,
    serial: null,
    bluetooth: null,
  },
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}

function toIntegerInRange(
  value: unknown,
  fallback: number,
  min: number,
  max: number
) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback;
  }

  return Math.min(max, Math.max(min, Math.round(value)));
}

function toSafeString(value: unknown, fallback: string) {
  if (typeof value !== "string") {
    return fallback;
  }

  const trimmedValue = value.trim();
  return trimmedValue.length > 0 ? trimmedValue : fallback;
}

function toNullableString(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmedValue = value.trim();
  return trimmedValue.length > 0 ? trimmedValue : null;
}

function toBoolean(value: unknown, fallback: boolean) {
  return typeof value === "boolean" ? value : fallback;
}

function isPosPrinterConnectionType(
  value: unknown
): value is PosPrinterConnectionType {
  return (
    typeof value === "string" &&
    POS_PRINTER_CONNECTION_TYPES.includes(value as PosPrinterConnectionType)
  );
}

function isPosPrinterOutputMode(value: unknown): value is PosPrinterOutputMode {
  return (
    typeof value === "string" &&
    POS_PRINTER_OUTPUT_MODES.includes(value as PosPrinterOutputMode)
  );
}

function isPosPrinterLanguage(value: unknown): value is PosPrinterLanguage {
  return (
    typeof value === "string" &&
    POS_PRINTER_LANGUAGES.includes(value as PosPrinterLanguage)
  );
}

export function isPosEncodablePrinterLanguage(
  value: unknown
): value is Exclude<PosPrinterLanguage, "auto"> {
  return value === "esc-pos" || value === "star-prnt" || value === "star-line";
}

function normalizeSavedUsbDevice(
  value: unknown
): PosSavedUsbPrinterDevice | null {
  if (!isRecord(value) || value.type !== "usb") {
    return null;
  }

  if (
    typeof value.vendorId !== "number" ||
    typeof value.productId !== "number"
  ) {
    return null;
  }

  return {
    type: "usb",
    vendorId: Math.round(value.vendorId),
    productId: Math.round(value.productId),
    serialNumber: toNullableString(value.serialNumber),
    manufacturerName: toNullableString(value.manufacturerName),
    productName: toNullableString(value.productName),
    language: isPosPrinterLanguage(value.language) ? value.language : null,
    codepageMapping: toNullableString(value.codepageMapping),
  };
}

function normalizeSavedSerialDevice(
  value: unknown
): PosSavedSerialPrinterDevice | null {
  if (!isRecord(value) || value.type !== "serial") {
    return null;
  }

  const vendorId =
    typeof value.vendorId === "number" ? Math.round(value.vendorId) : null;
  const productId =
    typeof value.productId === "number" ? Math.round(value.productId) : null;

  return {
    type: "serial",
    vendorId,
    productId,
    language: isPosPrinterLanguage(value.language) ? value.language : null,
    codepageMapping: toNullableString(value.codepageMapping),
  };
}

function normalizeSavedBluetoothDevice(
  value: unknown
): PosSavedBluetoothPrinterDevice | null {
  if (!isRecord(value) || value.type !== "bluetooth") {
    return null;
  }

  const id = toNullableString(value.id);
  if (!id) {
    return null;
  }

  return {
    type: "bluetooth",
    id,
    name: toNullableString(value.name),
    language: isPosPrinterLanguage(value.language) ? value.language : null,
    codepageMapping: toNullableString(value.codepageMapping),
  };
}

function normalizeSerialConfig(
  value: unknown,
  fallback: PosPrinterSerialConfig
): PosPrinterSerialConfig {
  if (!isRecord(value)) {
    return fallback;
  }

  return {
    baudRate: toIntegerInRange(value.baudRate, fallback.baudRate, 300, 115_200),
    bufferSize: toIntegerInRange(
      value.bufferSize,
      fallback.bufferSize,
      64,
      4096
    ),
    dataBits:
      value.dataBits === 7 || value.dataBits === 8
        ? value.dataBits
        : fallback.dataBits,
    flowControl:
      value.flowControl === "hardware" || value.flowControl === "none"
        ? value.flowControl
        : fallback.flowControl,
    parity:
      value.parity === "none" ||
      value.parity === "even" ||
      value.parity === "odd"
        ? value.parity
        : fallback.parity,
    stopBits:
      value.stopBits === 1 || value.stopBits === 2
        ? value.stopBits
        : fallback.stopBits,
  };
}

function normalizePosLocalPrinterSettings(
  value: unknown
): PosLocalPrinterSettings {
  if (!isRecord(value)) {
    return DEFAULT_POS_LOCAL_PRINTER_SETTINGS;
  }

  const fallback = DEFAULT_POS_LOCAL_PRINTER_SETTINGS;
  const savedDevices = isRecord(value.savedDevices) ? value.savedDevices : {};

  return {
    outputMode: isPosPrinterOutputMode(value.outputMode)
      ? value.outputMode
      : fallback.outputMode,
    connectionType: isPosPrinterConnectionType(value.connectionType)
      ? value.connectionType
      : fallback.connectionType,
    language: isPosPrinterLanguage(value.language)
      ? value.language
      : fallback.language,
    codepageMapping: toSafeString(
      value.codepageMapping,
      fallback.codepageMapping
    ),
    autoReconnect: toBoolean(value.autoReconnect, fallback.autoReconnect),
    openDrawerAfterPrint: toBoolean(
      value.openDrawerAfterPrint,
      fallback.openDrawerAfterPrint
    ),
    serial: normalizeSerialConfig(value.serial, fallback.serial),
    savedDevices: {
      usb: normalizeSavedUsbDevice(savedDevices.usb),
      serial: normalizeSavedSerialDevice(savedDevices.serial),
      bluetooth: normalizeSavedBluetoothDevice(savedDevices.bluetooth),
    },
  };
}

function getStorageKey(organizationId?: string | null) {
  if (!organizationId) {
    return POS_PRINTER_SETTINGS_STORAGE_KEY;
  }
  return `${POS_PRINTER_SETTINGS_STORAGE_KEY}:${organizationId}`;
}

function emitLocalPrinterSettingsUpdated() {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(new CustomEvent(POS_PRINTER_SETTINGS_EVENT));
}

export function readPosLocalPrinterSettings(
  organizationId?: string | null
): PosLocalPrinterSettings {
  if (typeof window === "undefined") {
    return DEFAULT_POS_LOCAL_PRINTER_SETTINGS;
  }

  try {
    const rawValue = window.localStorage.getItem(getStorageKey(organizationId));
    if (!rawValue) {
      return DEFAULT_POS_LOCAL_PRINTER_SETTINGS;
    }

    const parsedValue = JSON.parse(rawValue) as unknown;
    return normalizePosLocalPrinterSettings(parsedValue);
  } catch {
    return DEFAULT_POS_LOCAL_PRINTER_SETTINGS;
  }
}

function writePosLocalPrinterSettings(
  value: PosLocalPrinterSettings,
  organizationId?: string | null
): PosLocalPrinterSettings {
  const normalizedValue = normalizePosLocalPrinterSettings(value);

  if (typeof window === "undefined") {
    return normalizedValue;
  }

  try {
    window.localStorage.setItem(
      getStorageKey(organizationId),
      JSON.stringify(normalizedValue)
    );
    emitLocalPrinterSettingsUpdated();
  } catch {
    /* Ignore write errors from private mode or storage quota */
  }

  return normalizedValue;
}

export function patchPosLocalPrinterSettings(
  updater:
    | Partial<PosLocalPrinterSettings>
    | ((currentValue: PosLocalPrinterSettings) => PosLocalPrinterSettings),
  organizationId?: string | null
) {
  const currentValue = readPosLocalPrinterSettings(organizationId);
  const nextValue =
    typeof updater === "function"
      ? updater(currentValue)
      : {
          ...currentValue,
          ...updater,
        };

  return writePosLocalPrinterSettings(nextValue, organizationId);
}

function _clearSavedDeviceForConnection(
  connectionType: PosPrinterConnectionType,
  organizationId?: string | null
) {
  return patchPosLocalPrinterSettings(
    (currentValue) => ({
      ...currentValue,
      savedDevices: {
        ...currentValue.savedDevices,
        [connectionType]: null,
      },
    }),
    organizationId
  );
}

function subscribePosLocalPrinterSettings(
  listener: () => void,
  organizationId?: string | null
) {
  if (typeof window === "undefined") {
    return () => {};
  }

  const storageKey = getStorageKey(organizationId);

  const handleStorageChange = (event: StorageEvent) => {
    if (event.key === storageKey) {
      listener();
    }
  };

  const handleLocalSettingsUpdate = () => {
    listener();
  };

  window.addEventListener("storage", handleStorageChange);
  window.addEventListener(
    POS_PRINTER_SETTINGS_EVENT,
    handleLocalSettingsUpdate
  );

  return () => {
    window.removeEventListener("storage", handleStorageChange);
    window.removeEventListener(
      POS_PRINTER_SETTINGS_EVENT,
      handleLocalSettingsUpdate
    );
  };
}

export function usePosLocalPrinterSettings(organizationId?: string | null) {
  const [settings, setSettings] = useState<PosLocalPrinterSettings>(() =>
    readPosLocalPrinterSettings(organizationId)
  );

  useEffect(() => {
    setSettings(readPosLocalPrinterSettings(organizationId));
  }, [organizationId]);

  useEffect(
    () =>
      subscribePosLocalPrinterSettings(() => {
        setSettings(readPosLocalPrinterSettings(organizationId));
      }, organizationId),
    [organizationId]
  );

  const updateSettings = useCallback(
    (
      updater:
        | Partial<PosLocalPrinterSettings>
        | ((currentValue: PosLocalPrinterSettings) => PosLocalPrinterSettings)
    ) => {
      const nextValue = patchPosLocalPrinterSettings(updater, organizationId);
      setSettings(nextValue);
      return nextValue;
    },
    [organizationId]
  );

  const resetSettings = useCallback(() => {
    const nextValue = writePosLocalPrinterSettings(
      DEFAULT_POS_LOCAL_PRINTER_SETTINGS,
      organizationId
    );
    setSettings(nextValue);
    return nextValue;
  }, [organizationId]);

  return useMemo(
    () => ({
      settings,
      setSettings: updateSettings,
      resetSettings,
    }),
    [resetSettings, settings, updateSettings]
  );
}

export function getSavedDeviceForConnection(
  settings: PosLocalPrinterSettings,
  connectionType: PosPrinterConnectionType
) {
  return settings.savedDevices[connectionType];
}

export function isPosPrinterConnectionTypeSupported(
  connectionType: PosPrinterConnectionType
) {
  if (typeof navigator === "undefined") {
    return false;
  }

  switch (connectionType) {
    case "usb":
      return "usb" in navigator;
    case "serial":
      return "serial" in navigator;
    case "bluetooth":
      return "bluetooth" in navigator;
    default:
      return false;
  }
}

export function formatPosSavedPrinterDeviceLabel(
  device: PosSavedPrinterDevice | null | undefined
) {
  if (!device) {
    return "Sin impresora guardada";
  }

  if (device.type === "usb") {
    const parts = [device.manufacturerName, device.productName].filter(Boolean);
    if (parts.length > 0) {
      return `${parts.join(" ")} (${device.serialNumber ?? "sin serial"})`;
    }

    return `USB ${device.vendorId}:${device.productId}`;
  }

  if (device.type === "bluetooth") {
    return `${device.name ?? "Impresora Bluetooth"} (${device.id})`;
  }

  if (device.vendorId && device.productId) {
    return `Serial ${device.vendorId}:${device.productId}`;
  }

  return "Serial (sin identificador USB)";
}
