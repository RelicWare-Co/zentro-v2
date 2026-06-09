import {
  Printer,
  RefreshCcw,
  ScanLine,
  Settings2,
  TestTube2,
  Usb,
} from "lucide-react";
import { useId } from "react";
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
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import type { usePosPrinterRuntimeState } from "@/features/pos/printing/printer-manager.client";
import {
  POS_PRINTER_CONNECTION_TYPES,
  POS_PRINTER_LANGUAGES,
  POS_PRINTER_OUTPUT_MODES,
  type PosLocalPrinterSettings,
} from "@/features/pos/printing/printer-settings.local.client";
import { usePrinterSettings } from "@/features/pos/printing/printer-settings-context.client";
import {
  POS_RECEIPT_FONT_SCALES,
  POS_RECEIPT_PAPER_WIDTHS,
} from "@/features/pos/printing/receipt-layout.shared";

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

const settingsSelectTriggerClassName =
  "h-10 w-full rounded-lg border-zinc-800 bg-black/20 text-white";

const settingsSelectContentClassName =
  "border-zinc-800 bg-[var(--color-carbon)] text-white";

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
  const connectionTypeId = useId();
  const languageId = useId();
  const codepageId = useId();
  const outputModeId = useId();
  const receiptPaperWidthId = useId();
  const receiptFontScaleId = useId();
  return (
    <div className="grid gap-3 md:grid-cols-2">
      <div className="grid gap-2">
        <Label htmlFor={connectionTypeId}>Tipo de conexión</Label>
        <Select
          onValueChange={(value) =>
            setConnectionSettings((currentValue) => ({
              ...currentValue,
              connectionType:
                value as PosLocalPrinterSettings["connectionType"],
            }))
          }
          value={settings.connectionType}
        >
          <SelectTrigger
            className={settingsSelectTriggerClassName}
            id={connectionTypeId}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent className={settingsSelectContentClassName}>
            {POS_PRINTER_CONNECTION_TYPES.map((connectionType) => (
              <SelectItem key={connectionType} value={connectionType}>
                {connectionType.toUpperCase()}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-2">
        <Label htmlFor={languageId}>Lenguaje de fallback</Label>
        <Select
          onValueChange={(value) =>
            setConnectionSettings((currentValue) => ({
              ...currentValue,
              language: value as PosLocalPrinterSettings["language"],
            }))
          }
          value={settings.language}
        >
          <SelectTrigger
            className={settingsSelectTriggerClassName}
            id={languageId}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent className={settingsSelectContentClassName}>
            {POS_PRINTER_LANGUAGES.map((language) => (
              <SelectItem key={language} value={language}>
                {language}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-2">
        <Label htmlFor={codepageId}>Mapping de codepage</Label>
        <Input
          className="border-zinc-700 bg-black/20"
          id={codepageId}
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
        <Label htmlFor={outputModeId}>Modo de salida</Label>
        <Select
          onValueChange={(value) =>
            setConnectionSettings((currentValue) => ({
              ...currentValue,
              outputMode: value as PosLocalPrinterSettings["outputMode"],
            }))
          }
          value={settings.outputMode}
        >
          <SelectTrigger
            className={settingsSelectTriggerClassName}
            id={outputModeId}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent className={settingsSelectContentClassName}>
            {POS_PRINTER_OUTPUT_MODES.map((outputMode) => (
              <SelectItem key={outputMode} value={outputMode}>
                {outputMode === "pdf" ? "PDF" : "Impresora"}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-2">
        <Label htmlFor={receiptPaperWidthId}>Ancho de papel</Label>
        <Select
          onValueChange={(value) =>
            setConnectionSettings((currentValue) => ({
              ...currentValue,
              receiptPaperWidth:
                value as PosLocalPrinterSettings["receiptPaperWidth"],
            }))
          }
          value={settings.receiptPaperWidth}
        >
          <SelectTrigger
            className={settingsSelectTriggerClassName}
            id={receiptPaperWidthId}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent className={settingsSelectContentClassName}>
            {POS_RECEIPT_PAPER_WIDTHS.map((paperWidth) => (
              <SelectItem key={paperWidth} value={paperWidth}>
                {getReceiptPaperWidthLabel(paperWidth)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-2">
        <Label htmlFor={receiptFontScaleId}>Tamaño de letra</Label>
        <Select
          onValueChange={(value) =>
            setConnectionSettings((currentValue) => ({
              ...currentValue,
              receiptFontScale:
                value as PosLocalPrinterSettings["receiptFontScale"],
            }))
          }
          value={settings.receiptFontScale}
        >
          <SelectTrigger
            className={settingsSelectTriggerClassName}
            id={receiptFontScaleId}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent className={settingsSelectContentClassName}>
            {POS_RECEIPT_FONT_SCALES.map((fontScale) => (
              <SelectItem key={fontScale} value={fontScale}>
                {getReceiptFontScaleLabel(fontScale)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
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
  const dataBitsId = useId();
  const parityId = useId();
  const flowControlId = useId();
  const stopBitsId = useId();
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
          <div className="grid gap-2">
            <Label htmlFor={dataBitsId}>Data bits</Label>
            <Select
              onValueChange={(value) =>
                setConnectionSettings((currentValue) => ({
                  ...currentValue,
                  serial: {
                    ...currentValue.serial,
                    dataBits: value === "7" ? 7 : 8,
                  },
                }))
              }
              value={String(settings.serial.dataBits)}
            >
              <SelectTrigger
                className={settingsSelectTriggerClassName}
                id={dataBitsId}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent className={settingsSelectContentClassName}>
                <SelectItem value="8">8</SelectItem>
                <SelectItem value="7">7</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor={parityId}>Paridad</Label>
            <Select
              onValueChange={(value) =>
                setConnectionSettings((currentValue) => ({
                  ...currentValue,
                  serial: {
                    ...currentValue.serial,
                    parity:
                      value as PosLocalPrinterSettings["serial"]["parity"],
                  },
                }))
              }
              value={settings.serial.parity}
            >
              <SelectTrigger
                className={settingsSelectTriggerClassName}
                id={parityId}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent className={settingsSelectContentClassName}>
                <SelectItem value="none">none</SelectItem>
                <SelectItem value="even">even</SelectItem>
                <SelectItem value="odd">odd</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor={flowControlId}>Flow control</Label>
            <Select
              onValueChange={(value) =>
                setConnectionSettings((currentValue) => ({
                  ...currentValue,
                  serial: {
                    ...currentValue.serial,
                    flowControl:
                      value as PosLocalPrinterSettings["serial"]["flowControl"],
                  },
                }))
              }
              value={settings.serial.flowControl}
            >
              <SelectTrigger
                className={settingsSelectTriggerClassName}
                id={flowControlId}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent className={settingsSelectContentClassName}>
                <SelectItem value="none">none</SelectItem>
                <SelectItem value="hardware">hardware</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor={stopBitsId}>Stop bits</Label>
            <Select
              onValueChange={(value) =>
                setConnectionSettings((currentValue) => ({
                  ...currentValue,
                  serial: {
                    ...currentValue.serial,
                    stopBits: value === "2" ? 2 : 1,
                  },
                }))
              }
              value={String(settings.serial.stopBits)}
            >
              <SelectTrigger
                className={settingsSelectTriggerClassName}
                id={stopBitsId}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent className={settingsSelectContentClassName}>
                <SelectItem value="1">1</SelectItem>
                <SelectItem value="2">2</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>
    </>
  );
}

function ActionButtonsGrid() {
  const { actions, meta, state } = usePrinterSettings();

  return (
    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
      <Button
        className="bg-[var(--color-voltage)] text-black hover:bg-[#d9f15c]"
        disabled={state.isBusy || !state.connectionSupported}
        onClick={() => {
          actions.connect();
        }}
        type="button"
      >
        <ScanLine className="size-4" />
        Conectar
      </Button>
      <Button
        className="border-zinc-700 bg-transparent text-zinc-200 hover:bg-white/5 hover:text-white"
        disabled={
          state.isBusy || !state.connectionSupported || !meta.savedDevice
        }
        onClick={() => {
          actions.reconnect();
        }}
        type="button"
        variant="outline"
      >
        <RefreshCcw className="size-4" />
        Reconectar
      </Button>
      <Button
        className="border-zinc-700 bg-transparent text-zinc-200 hover:bg-white/5 hover:text-white"
        disabled={state.isBusy || meta.runtimeState.status !== "connected"}
        onClick={() => {
          actions.disconnect();
        }}
        type="button"
        variant="outline"
      >
        <Settings2 className="size-4" />
        Desconectar
      </Button>
      <Button
        className="border-zinc-700 bg-transparent text-zinc-200 hover:bg-white/5 hover:text-white"
        disabled={state.isBusy}
        onClick={() => {
          actions.printTest();
        }}
        type="button"
        variant="outline"
      >
        <TestTube2 className="size-4" />
        Imprimir prueba
      </Button>
      <Button
        className="border-zinc-700 bg-transparent text-zinc-200 hover:bg-white/5 hover:text-white"
        disabled={state.isBusy || !state.connectionSupported}
        onClick={() => {
          actions.openDrawer();
        }}
        type="button"
        variant="outline"
      >
        <Usb className="size-4" />
        Abrir caja
      </Button>
      <Button
        className="border-zinc-700 bg-transparent text-zinc-200 hover:bg-white/5 hover:text-white"
        disabled={state.isBusy}
        onClick={actions.resetLocalSettings}
        type="button"
        variant="outline"
      >
        <RefreshCcw className="size-4" />
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
          <Badge className="border-zinc-700 bg-black/20 text-zinc-300">
            Papel: {getReceiptPaperWidthLabel(settings.receiptPaperWidth)}
          </Badge>
          <Badge className="border-zinc-700 bg-black/20 text-zinc-300">
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

        <Separator className="border-zinc-800" />

        <div className="rounded-2xl border border-zinc-800 bg-black/20 p-4 text-sm text-zinc-300">
          <p className="font-medium text-zinc-100">Impresora guardada</p>
          <p className="mt-1 text-xs text-zinc-400">{state.savedDeviceLabel}</p>
        </div>

        {state.connectionSupported ? null : (
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

        <ActionButtonsGrid />
      </CardContent>
    </Card>
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
  const id = useId();
  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        className="border-zinc-700 bg-black/20"
        id={id}
        inputMode="numeric"
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
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
