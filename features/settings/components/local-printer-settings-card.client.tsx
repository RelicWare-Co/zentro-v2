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
import {
  connectPosPrinter,
  disconnectPosPrinter,
  openPosCashDrawer,
  printPosPrinterTestDocument,
  reconnectPosPrinter,
} from "@/features/pos/printing/print-thermal-receipt.client";
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
      <Alert className="border-amber-500/20 bg-amber-500/10 text-amber-100">
        <AlertTitle>Canal unidireccional</AlertTitle>
        <AlertDescription>
          Esta impresora permite imprimir, pero no reporta estado de
          papel/tapa/caja.
        </AlertDescription>
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
    <Alert className="border-zinc-700 bg-black/20 text-zinc-200">
      <AlertTitle>Estado del driver</AlertTitle>
      <AlertDescription>{message}</AlertDescription>
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
        <Alert className="border-emerald-500/20 bg-emerald-500/10 text-emerald-100">
          <AlertTitle>Operación exitosa</AlertTitle>
          <AlertDescription>{feedbackMessage}</AlertDescription>
        </Alert>
      ) : null}
      {feedbackError ? (
        <Alert
          className="border-red-500/20 bg-red-500/10 text-red-100"
          variant="destructive"
        >
          <AlertTitle>No se pudo completar</AlertTitle>
          <AlertDescription>{feedbackError}</AlertDescription>
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
      <div className="grid gap-2">
        <Label>Tipo de conexión</Label>
        <NativeSelect
          className="w-full"
          onChange={(event) =>
            setConnectionSettings((currentValue) => ({
              ...currentValue,
              connectionType: event.target
                .value as PosLocalPrinterSettings["connectionType"],
            }))
          }
          value={settings.connectionType}
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
          className="w-full"
          onChange={(event) =>
            setConnectionSettings((currentValue) => ({
              ...currentValue,
              language: event.target
                .value as PosLocalPrinterSettings["language"],
            }))
          }
          value={settings.language}
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
          className="border-zinc-700 bg-black/20"
          onChange={(event) =>
            setConnectionSettings((currentValue) => ({
              ...currentValue,
              codepageMapping: event.target.value,
            }))
          }
          placeholder="epson"
          value={settings.codepageMapping}
        />
      </div>

      <div className="grid gap-2">
        <Label>Modo de salida</Label>
        <NativeSelect
          className="w-full"
          onChange={(event) =>
            setConnectionSettings((currentValue) => ({
              ...currentValue,
              outputMode: event.target
                .value as PosLocalPrinterSettings["outputMode"],
            }))
          }
          value={settings.outputMode}
        >
          {POS_PRINTER_OUTPUT_MODES.map((outputMode) => (
            <NativeSelectOption key={outputMode} value={outputMode}>
              {outputMode === "pdf" ? "PDF" : "Impresora"}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </div>
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
      <Separator className="border-zinc-800" />
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
            value={settings.serial.bufferSize}
          />
          <div className="grid gap-2">
            <Label>Data bits</Label>
            <NativeSelect
              className="w-full"
              onChange={(event) =>
                setConnectionSettings((currentValue) => ({
                  ...currentValue,
                  serial: {
                    ...currentValue.serial,
                    dataBits: event.target.value === "7" ? 7 : 8,
                  },
                }))
              }
              value={String(settings.serial.dataBits)}
            >
              <NativeSelectOption value="8">8</NativeSelectOption>
              <NativeSelectOption value="7">7</NativeSelectOption>
            </NativeSelect>
          </div>
          <div className="grid gap-2">
            <Label>Paridad</Label>
            <NativeSelect
              className="w-full"
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
              value={settings.serial.parity}
            >
              <NativeSelectOption value="none">none</NativeSelectOption>
              <NativeSelectOption value="even">even</NativeSelectOption>
              <NativeSelectOption value="odd">odd</NativeSelectOption>
            </NativeSelect>
          </div>
          <div className="grid gap-2">
            <Label>Flow control</Label>
            <NativeSelect
              className="w-full"
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
              value={settings.serial.flowControl}
            >
              <NativeSelectOption value="none">none</NativeSelectOption>
              <NativeSelectOption value="hardware">hardware</NativeSelectOption>
            </NativeSelect>
          </div>
          <div className="grid gap-2">
            <Label>Stop bits</Label>
            <NativeSelect
              className="w-full"
              onChange={(event) =>
                setConnectionSettings((currentValue) => ({
                  ...currentValue,
                  serial: {
                    ...currentValue.serial,
                    stopBits: event.target.value === "2" ? 2 : 1,
                  },
                }))
              }
              value={String(settings.serial.stopBits)}
            >
              <NativeSelectOption value="1">1</NativeSelectOption>
              <NativeSelectOption value="2">2</NativeSelectOption>
            </NativeSelect>
          </div>
        </div>
      </div>
    </>
  );
}

function ActionButtonsGrid({
  isBusy,
  connectionSupported,
  savedDevice,
  runtimeState,
  organizationId,
  executeAction,
  resetSettings,
  setFeedbackMessage,
  setFeedbackError,
}: {
  isBusy: boolean;
  connectionSupported: boolean;
  savedDevice: unknown;
  runtimeState: ReturnType<typeof usePosPrinterRuntimeState>;
  organizationId: string;
  executeAction: (
    action: () => Promise<unknown>,
    successMessage: string
  ) => Promise<void>;
  resetSettings: () => void;
  setFeedbackMessage: (message: string | null) => void;
  setFeedbackError: (error: string | null) => void;
}) {
  return (
    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
      <Button
        className="bg-[var(--color-voltage)] text-black hover:bg-[#d9f15c]"
        disabled={isBusy || !connectionSupported}
        onClick={() =>
          executeAction(
            () => connectPosPrinter(organizationId),
            "Impresora conectada."
          )
        }
        type="button"
      >
        <ScanLine className="size-4" />
        Conectar
      </Button>
      <Button
        className="border-zinc-700 bg-transparent text-zinc-200 hover:bg-white/5 hover:text-white"
        disabled={isBusy || !connectionSupported || !savedDevice}
        onClick={() =>
          executeAction(
            () => reconnectPosPrinter({}, organizationId),
            "Reconexión finalizada."
          )
        }
        type="button"
        variant="outline"
      >
        <RefreshCcw className="size-4" />
        Reconectar
      </Button>
      <Button
        className="border-zinc-700 bg-transparent text-zinc-200 hover:bg-white/5 hover:text-white"
        disabled={isBusy || runtimeState.status !== "connected"}
        onClick={() =>
          executeAction(() => disconnectPosPrinter(), "Impresora desconectada.")
        }
        type="button"
        variant="outline"
      >
        <Settings2 className="size-4" />
        Desconectar
      </Button>
      <Button
        className="border-zinc-700 bg-transparent text-zinc-200 hover:bg-white/5 hover:text-white"
        disabled={isBusy}
        onClick={() =>
          executeAction(
            () => printPosPrinterTestDocument(organizationId),
            "Ticket de prueba enviado."
          )
        }
        type="button"
        variant="outline"
      >
        <TestTube2 className="size-4" />
        Imprimir prueba
      </Button>
      <Button
        className="border-zinc-700 bg-transparent text-zinc-200 hover:bg-white/5 hover:text-white"
        disabled={isBusy || !connectionSupported}
        onClick={() =>
          executeAction(
            () => openPosCashDrawer(organizationId),
            "Pulso de caja enviado."
          )
        }
        type="button"
        variant="outline"
      >
        <Usb className="size-4" />
        Abrir caja
      </Button>
      <Button
        className="border-zinc-700 bg-transparent text-zinc-200 hover:bg-white/5 hover:text-white"
        disabled={isBusy}
        onClick={() => {
          resetSettings();
          setFeedbackMessage("Configuración local restablecida.");
          setFeedbackError(null);
        }}
        type="button"
        variant="outline"
      >
        <RefreshCcw className="size-4" />
        Restablecer local
      </Button>
    </div>
  );
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
    settings.connectionType
  );
  const savedDevice = getSavedDeviceForConnection(
    settings,
    settings.connectionType
  );
  const savedDeviceLabel = useMemo(
    () => formatPosSavedPrinterDeviceLabel(savedDevice),
    [savedDevice]
  );

  const setConnectionSettings = (
    updater: (currentValue: PosLocalPrinterSettings) => PosLocalPrinterSettings
  ) => {
    setSettings((currentValue) => updater(currentValue));
    setFeedbackMessage(null);
    setFeedbackError(null);
  };

  const executeAction = async (
    action: () => Promise<unknown>,
    successMessage: string
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
          : "No se pudo completar la operación con la impresora."
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

        <PrinterStatusDisplay runtimeState={runtimeState} />
        <DriverStatusAlert message={runtimeState.message} />
        <FeedbackAlerts
          feedbackError={feedbackError}
          feedbackMessage={feedbackMessage}
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

        <Separator className="border-zinc-800" />

        <div className="rounded-2xl border border-zinc-800 bg-black/20 p-4 text-sm text-zinc-300">
          <p className="font-medium text-zinc-100">Impresora guardada</p>
          <p className="mt-1 text-xs text-zinc-400">{savedDeviceLabel}</p>
        </div>

        {connectionSupported ? null : (
          <Alert
            className="border-red-500/20 bg-red-500/10 text-red-100"
            variant="destructive"
          >
            <AlertTitle>Navegador sin soporte</AlertTitle>
            <AlertDescription>
              Este navegador no soporta {settings.connectionType.toUpperCase()}{" "}
              para impresión directa. Cambia a PDF o usa otro navegador
              compatible.
            </AlertDescription>
          </Alert>
        )}

        <ActionButtonsGrid
          connectionSupported={connectionSupported}
          executeAction={executeAction}
          isBusy={isBusy}
          organizationId={organizationId}
          resetSettings={resetSettings}
          runtimeState={runtimeState}
          savedDevice={savedDevice}
          setFeedbackError={setFeedbackError}
          setFeedbackMessage={setFeedbackMessage}
        />
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
        className="border-zinc-700 bg-black/20"
        inputMode="numeric"
        onChange={(event) => onChange(event.target.value)}
        type="number"
        value={value}
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
        <p className="font-medium text-sm text-white">{title}</p>
        <p className="text-xs text-zinc-400">{description}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  );
}
