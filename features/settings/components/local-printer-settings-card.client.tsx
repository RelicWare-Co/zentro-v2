import {
  Alert,
  Badge,
  Button,
  Divider,
  Select,
  Switch,
  TextInput,
} from "@mantine/core";
import {
  Loader2,
  Printer,
  RefreshCcw,
  ScanLine,
  Search,
  Settings2,
  TestTube2,
  Usb,
} from "lucide-react";
import { useState } from "react";
import type { usePosPrinterRuntimeState } from "@/features/pos/printing/printer-manager.client";
import {
  POS_PRINTER_CONNECTION_TYPES,
  POS_PRINTER_LANGUAGES,
  POS_PRINTER_OUTPUT_MODES,
  type PosLocalPrinterSettings,
} from "@/features/pos/printing/printer-settings.local.client";
import { usePrinterSettings } from "@/features/pos/printing/printer-settings-context.client";
import { listQzPrinters } from "@/features/pos/printing/qz-tray-receipt-printer.client";
import {
  POS_RECEIPT_FONT_SCALES,
  POS_RECEIPT_PAPER_WIDTHS,
} from "@/features/pos/printing/receipt-layout.shared";
import { SettingsCard } from "@/features/settings/components/settings-ui-primitives";
import { darkInputStyles, darkSelectStyles } from "@/lib/mantine-dark";

function toIntegerInRange(
  value: string,
  fallback: number,
  minimum: number,
  maximum: number
) {
  const parsedValue = Number(value);
  if (!Number.isFinite(parsedValue)) {
    return fallback;
  }

  return Math.min(maximum, Math.max(minimum, Math.round(parsedValue)));
}

function buildStatusBadgeLabel(
  status: ReturnType<typeof usePosPrinterRuntimeState>["status"]
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
  status: ReturnType<typeof usePosPrinterRuntimeState>["status"]
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

function getCashDrawerLabel(value: boolean | null) {
  if (value === null) {
    return "sin dato";
  }
  if (value) {
    return "abierta";
  }
  return "cerrada";
}

function getReceiptPaperWidthLabel(
  value: PosLocalPrinterSettings["receiptPaperWidth"]
) {
  return value === "58mm" ? "58 mm" : "80 mm";
}

function getReceiptFontScaleLabel(
  value: PosLocalPrinterSettings["receiptFontScale"]
) {
  return value === "large" ? "Grande" : "Normal";
}

function PrinterStatusDisplay({
  runtimeState,
}: {
  runtimeState: ReturnType<typeof usePosPrinterRuntimeState>;
}) {
  if (runtimeState.printerStatus) {
    return (
      <div className="rounded-2xl border border-zinc-800 bg-black/20 p-3 text-xs text-zinc-300">
        <p>
          Estado impresora:{" "}
          {runtimeState.printerStatus.online ? "Online" : "Offline"}· Papel{" "}
          {runtimeState.printerStatus.paperLoaded ? "ok" : "sin papel"}· Tapa{" "}
          {runtimeState.printerStatus.coverOpened ? "abierta" : "cerrada"}
        </p>
        <p>
          Papel bajo: {runtimeState.printerStatus.paperLow ? "sí" : "no"} ·
          Caja: {getCashDrawerLabel(runtimeState.cashDrawerOpened)}
        </p>
      </div>
    );
  }
  if (runtimeState.supportsTwoWay === false) {
    return (
      <Alert color="yellow" title="Canal unidireccional" variant="light">
        Esta impresora permite imprimir, pero no reporta estado de
        papel/tapa/caja.
      </Alert>
    );
  }
  return null;
}

function DriverStatusAlert({ message }: { message: string | null }) {
  if (!message) {
    return null;
  }
  return (
    <Alert color="gray" title="Estado del driver">
      {message}
    </Alert>
  );
}

function FeedbackAlerts({
  feedbackMessage,
  feedbackError,
}: {
  feedbackMessage: string | null;
  feedbackError: string | null;
}) {
  return (
    <>
      {feedbackMessage ? (
        <Alert color="teal" title="Operación exitosa" variant="light">
          {feedbackMessage}
        </Alert>
      ) : null}
      {feedbackError ? (
        <Alert color="red" title="No se pudo completar" variant="light">
          {feedbackError}
        </Alert>
      ) : null}
    </>
  );
}

function ConnectionSettingsForm({
  settings,
  setConnectionSettings,
}: {
  settings: PosLocalPrinterSettings;
  setConnectionSettings: (
    updater: (currentValue: PosLocalPrinterSettings) => PosLocalPrinterSettings
  ) => void;
}) {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      <Select
        data={POS_PRINTER_CONNECTION_TYPES.map((connectionType) => ({
          value: connectionType,
          label: connectionType.toUpperCase(),
        }))}
        label="Tipo de conexión"
        onChange={(value) => {
          if (value) {
            setConnectionSettings((currentValue) => ({
              ...currentValue,
              connectionType:
                value as PosLocalPrinterSettings["connectionType"],
            }));
          }
        }}
        styles={darkSelectStyles}
        value={settings.connectionType}
      />

      <Select
        data={[...POS_PRINTER_LANGUAGES]}
        label="Lenguaje de fallback"
        onChange={(value) => {
          if (value) {
            setConnectionSettings((currentValue) => ({
              ...currentValue,
              language: value as PosLocalPrinterSettings["language"],
            }));
          }
        }}
        styles={darkSelectStyles}
        value={settings.language}
      />

      <TextInput
        label="Mapping de codepage"
        onChange={(event) =>
          setConnectionSettings((currentValue) => ({
            ...currentValue,
            codepageMapping: event.target.value,
          }))
        }
        placeholder="epson"
        styles={darkInputStyles}
        value={settings.codepageMapping}
      />

      <Select
        data={POS_PRINTER_OUTPUT_MODES.map((outputMode) => ({
          value: outputMode,
          label: outputMode === "pdf" ? "PDF" : "Impresora",
        }))}
        label="Modo de salida"
        onChange={(value) => {
          if (value) {
            setConnectionSettings((currentValue) => ({
              ...currentValue,
              outputMode: value as PosLocalPrinterSettings["outputMode"],
            }));
          }
        }}
        styles={darkSelectStyles}
        value={settings.outputMode}
      />

      <Select
        data={POS_RECEIPT_PAPER_WIDTHS.map((paperWidth) => ({
          value: paperWidth,
          label: getReceiptPaperWidthLabel(paperWidth),
        }))}
        label="Ancho de papel"
        onChange={(value) => {
          if (value) {
            setConnectionSettings((currentValue) => ({
              ...currentValue,
              receiptPaperWidth:
                value as PosLocalPrinterSettings["receiptPaperWidth"],
            }));
          }
        }}
        styles={darkSelectStyles}
        value={settings.receiptPaperWidth}
      />

      <Select
        data={POS_RECEIPT_FONT_SCALES.map((fontScale) => ({
          value: fontScale,
          label: getReceiptFontScaleLabel(fontScale),
        }))}
        label="Tamaño de letra"
        onChange={(value) => {
          if (value) {
            setConnectionSettings((currentValue) => ({
              ...currentValue,
              receiptFontScale:
                value as PosLocalPrinterSettings["receiptFontScale"],
            }));
          }
        }}
        styles={darkSelectStyles}
        value={settings.receiptFontScale}
      />
    </div>
  );
}

function SerialParametersSection({
  settings,
  setConnectionSettings,
}: {
  settings: PosLocalPrinterSettings;
  setConnectionSettings: (
    updater: (currentValue: PosLocalPrinterSettings) => PosLocalPrinterSettings
  ) => void;
}) {
  if (settings.connectionType !== "serial") {
    return null;
  }
  return (
    <>
      <Divider color="dark.4" />
      <div className="space-y-3 rounded-2xl border border-zinc-800 bg-black/20 p-4">
        <div className="flex items-center gap-2 font-medium text-sm text-zinc-200">
          <Usb className="size-4 text-[var(--color-voltage)]" />
          Parámetros Serial
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          <NumberField
            label="Baud rate"
            onChange={(value) =>
              setConnectionSettings((currentValue) => ({
                ...currentValue,
                serial: {
                  ...currentValue.serial,
                  baudRate: toIntegerInRange(value, 9600, 300, 115_200),
                },
              }))
            }
            placeholder="9600"
            value={settings.serial.baudRate}
          />
          <NumberField
            label="Buffer"
            onChange={(value) =>
              setConnectionSettings((currentValue) => ({
                ...currentValue,
                serial: {
                  ...currentValue.serial,
                  bufferSize: toIntegerInRange(value, 255, 64, 4096),
                },
              }))
            }
            placeholder="255"
            value={settings.serial.bufferSize}
          />
          <Select
            data={["8", "7"]}
            label="Data bits"
            onChange={(value) =>
              setConnectionSettings((currentValue) => ({
                ...currentValue,
                serial: {
                  ...currentValue.serial,
                  dataBits: value === "7" ? 7 : 8,
                },
              }))
            }
            styles={darkSelectStyles}
            value={String(settings.serial.dataBits)}
          />
          <Select
            data={["none", "even", "odd"]}
            label="Paridad"
            onChange={(value) => {
              if (value) {
                setConnectionSettings((currentValue) => ({
                  ...currentValue,
                  serial: {
                    ...currentValue.serial,
                    parity:
                      value as PosLocalPrinterSettings["serial"]["parity"],
                  },
                }));
              }
            }}
            styles={darkSelectStyles}
            value={settings.serial.parity}
          />
          <Select
            data={["none", "hardware"]}
            label="Flow control"
            onChange={(value) => {
              if (value) {
                setConnectionSettings((currentValue) => ({
                  ...currentValue,
                  serial: {
                    ...currentValue.serial,
                    flowControl:
                      value as PosLocalPrinterSettings["serial"]["flowControl"],
                  },
                }));
              }
            }}
            styles={darkSelectStyles}
            value={settings.serial.flowControl}
          />
          <Select
            data={["1", "2"]}
            label="Stop bits"
            onChange={(value) =>
              setConnectionSettings((currentValue) => ({
                ...currentValue,
                serial: {
                  ...currentValue.serial,
                  stopBits: value === "2" ? 2 : 1,
                },
              }))
            }
            styles={darkSelectStyles}
            value={String(settings.serial.stopBits)}
          />
        </div>
      </div>
    </>
  );
}

function QzParametersSection({
  settings,
  setConnectionSettings,
}: {
  settings: PosLocalPrinterSettings;
  setConnectionSettings: (
    updater: (currentValue: PosLocalPrinterSettings) => PosLocalPrinterSettings
  ) => void;
}) {
  const [printers, setPrinters] = useState<string[]>([]);
  const [isLoadingPrinters, setIsLoadingPrinters] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);

  if (settings.connectionType !== "qz") {
    return null;
  }

  const handleSearchPrinters = async () => {
    setIsLoadingPrinters(true);
    setLookupError(null);
    try {
      const foundPrinters = await listQzPrinters(settings.qz);
      setPrinters(foundPrinters);
      if (foundPrinters.length === 0) {
        setLookupError("QZ Tray no reportó impresoras disponibles.");
      }
    } catch (error) {
      setLookupError(
        error instanceof Error
          ? error.message
          : "No se pudo conectar con QZ Tray. ¿Está abierto?"
      );
    }
    setIsLoadingPrinters(false);
  };

  const selectablePrinters =
    settings.qz.printerName && !printers.includes(settings.qz.printerName)
      ? [settings.qz.printerName, ...printers]
      : printers;

  return (
    <>
      <Divider color="dark.4" />
      <div className="space-y-3 rounded-2xl border border-zinc-800 bg-black/20 p-4">
        <div className="flex items-center gap-2 font-medium text-sm text-zinc-200">
          <Printer className="size-4 text-[var(--color-voltage)]" />
          Parámetros QZ Tray
        </div>
        <p className="text-xs text-zinc-400">
          Requiere la app QZ Tray instalada y abierta en este equipo. La primera
          vez QZ pedirá permiso para imprimir desde el navegador.
        </p>
        <div className="grid gap-3 md:grid-cols-2">
          <TextInput
            label="Host (opcional)"
            onChange={(event) =>
              setConnectionSettings((currentValue) => ({
                ...currentValue,
                qz: {
                  ...currentValue.qz,
                  host: event.target.value,
                },
              }))
            }
            placeholder="localhost"
            styles={darkInputStyles}
            value={settings.qz.host}
          />

          <div>
            <div className="flex items-end gap-2">
              <Select
                className="flex-1"
                data={selectablePrinters}
                disabled={selectablePrinters.length === 0}
                label="Impresora"
                onChange={(value) =>
                  setConnectionSettings((currentValue) => ({
                    ...currentValue,
                    qz: {
                      ...currentValue.qz,
                      printerName: value ?? "",
                    },
                  }))
                }
                placeholder="Predeterminada de QZ"
                styles={darkSelectStyles}
                value={settings.qz.printerName ?? ""}
              />
              <Button
                color="gray"
                disabled={isLoadingPrinters}
                leftSection={
                  isLoadingPrinters ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Search className="size-4" />
                  )
                }
                onClick={handleSearchPrinters}
                type="button"
                variant="outline"
              >
                Buscar
              </Button>
            </div>
          </div>
        </div>

        <ToggleRow
          checked={settings.qz.usingSecure}
          description="Usa conexión segura (wss). Desactívalo si QZ Tray no tiene certificado SSL configurado."
          onCheckedChange={(checked) =>
            setConnectionSettings((currentValue) => ({
              ...currentValue,
              qz: {
                ...currentValue.qz,
                usingSecure: checked,
              },
            }))
          }
          title="Conexión segura (wss)"
        />

        {lookupError ? (
          <Alert color="red" title="QZ Tray" variant="light">
            {lookupError}
          </Alert>
        ) : null}
      </div>
    </>
  );
}

function ActionButtonsGrid() {
  const { actions, meta, state } = usePrinterSettings();

  return (
    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
      <Button
        c="black"
        color="voltage.5"
        disabled={state.isBusy || !state.connectionSupported}
        leftSection={<ScanLine className="size-4" />}
        onClick={() => {
          actions.connect();
        }}
        type="button"
      >
        Conectar
      </Button>
      <Button
        color="gray"
        disabled={
          state.isBusy || !state.connectionSupported || !meta.savedDevice
        }
        leftSection={<RefreshCcw className="size-4" />}
        onClick={() => {
          actions.reconnect();
        }}
        type="button"
        variant="outline"
      >
        Reconectar
      </Button>
      <Button
        color="gray"
        disabled={state.isBusy || meta.runtimeState.status !== "connected"}
        leftSection={<Settings2 className="size-4" />}
        onClick={() => {
          actions.disconnect();
        }}
        type="button"
        variant="outline"
      >
        Desconectar
      </Button>
      <Button
        color="gray"
        disabled={state.isBusy}
        leftSection={<TestTube2 className="size-4" />}
        onClick={() => {
          actions.printTest();
        }}
        type="button"
        variant="outline"
      >
        Imprimir prueba
      </Button>
      <Button
        color="gray"
        disabled={state.isBusy || !state.connectionSupported}
        leftSection={<Usb className="size-4" />}
        onClick={() => {
          actions.openDrawer();
        }}
        type="button"
        variant="outline"
      >
        Abrir caja
      </Button>
      <Button
        color="gray"
        disabled={state.isBusy}
        leftSection={<RefreshCcw className="size-4" />}
        onClick={actions.resetLocalSettings}
        type="button"
        variant="outline"
      >
        Reiniciar ajustes
      </Button>
    </div>
  );
}

export function LocalPrinterSettingsCard() {
  const { actions, meta, state } = usePrinterSettings();
  const { settings } = state;
  const { runtimeState } = meta;

  const setConnectionSettings = (
    updater: (currentValue: PosLocalPrinterSettings) => PosLocalPrinterSettings
  ) => {
    actions.setConnectionSettings(updater);
  };

  return (
    <SettingsCard
      description="Configura impresión por USB, Bluetooth, Serial o QZ Tray en este dispositivo."
      icon={Printer}
      title="Impresión local"
    >
      <div className="flex flex-wrap items-center gap-2">
        <Badge
          className={buildStatusBadgeClassName(runtimeState.status)}
          tt="none"
        >
          {buildStatusBadgeLabel(runtimeState.status)}
        </Badge>
        <Badge className="border-zinc-700 bg-black/20 text-zinc-300" tt="none">
          Modo: {settings.outputMode === "pdf" ? "PDF" : "Impresora POS"}
        </Badge>
        <Badge className="border-zinc-700 bg-black/20 text-zinc-300" tt="none">
          Canal: {settings.connectionType.toUpperCase()}
        </Badge>
        <Badge className="border-zinc-700 bg-black/20 text-zinc-300" tt="none">
          Papel: {getReceiptPaperWidthLabel(settings.receiptPaperWidth)}
        </Badge>
        <Badge className="border-zinc-700 bg-black/20 text-zinc-300" tt="none">
          Letra: {getReceiptFontScaleLabel(settings.receiptFontScale)}
        </Badge>
      </div>

      <PrinterStatusDisplay runtimeState={runtimeState} />
      <DriverStatusAlert message={runtimeState.message} />
      <FeedbackAlerts
        feedbackError={state.feedbackError}
        feedbackMessage={state.feedbackMessage}
      />

      <div className="space-y-3 rounded-2xl border border-zinc-800 bg-black/20 p-4">
        <ToggleRow
          checked={settings.outputMode === "device"}
          description="Cuando está activo, el POS intenta imprimir directo al dispositivo."
          onCheckedChange={(checked) =>
            setConnectionSettings((currentValue) => ({
              ...currentValue,
              outputMode: checked ? "device" : "pdf",
            }))
          }
          title="Usar impresora POS"
        />
        <ToggleRow
          checked={settings.autoReconnect}
          description="Intenta reconectar automáticamente a la última impresora guardada."
          onCheckedChange={(checked) =>
            setConnectionSettings((currentValue) => ({
              ...currentValue,
              autoReconnect: checked,
            }))
          }
          title="Reconectar al abrir"
        />
        <ToggleRow
          checked={settings.openDrawerAfterPrint}
          description="Si la impresora soporta DK, envía pulso automático al terminar un recibo."
          onCheckedChange={(checked) =>
            setConnectionSettings((currentValue) => ({
              ...currentValue,
              openDrawerAfterPrint: checked,
            }))
          }
          title="Abrir caja tras imprimir"
        />
      </div>

      <ConnectionSettingsForm
        setConnectionSettings={setConnectionSettings}
        settings={settings}
      />

      <SerialParametersSection
        setConnectionSettings={setConnectionSettings}
        settings={settings}
      />

      <QzParametersSection
        setConnectionSettings={setConnectionSettings}
        settings={settings}
      />

      <Divider color="dark.4" />

      <div className="rounded-2xl border border-zinc-800 bg-black/20 p-4 text-sm text-zinc-300">
        <p className="font-medium text-zinc-100">Impresora guardada</p>
        <p className="mt-1 text-xs text-zinc-400">{state.savedDeviceLabel}</p>
      </div>

      {state.connectionSupported ? null : (
        <Alert color="red" title="Navegador sin soporte" variant="light">
          Este navegador no soporta {settings.connectionType.toUpperCase()} para
          impresión directa. Cambia a PDF o usa otro navegador compatible.
        </Alert>
      )}

      <ActionButtonsGrid />
    </SettingsCard>
  );
}

function NumberField({
  label,
  placeholder,
  value,
  onChange,
}: {
  label: string;
  placeholder?: string;
  value: number;
  onChange: (value: string) => void;
}) {
  return (
    <TextInput
      inputMode="numeric"
      label={label}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      styles={darkInputStyles}
      type="number"
      value={value}
    />
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
        <p className="font-medium text-sm text-white">{title}</p>
        <p className="text-xs text-zinc-400">{description}</p>
      </div>
      <Switch
        checked={checked}
        color="voltage.5"
        onChange={(event) => onCheckedChange(event.currentTarget.checked)}
      />
    </div>
  );
}
