import {
  createContext,
  type ReactNode,
  use,
  useCallback,
  useMemo,
  useState,
} from "react";
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
  type PosLocalPrinterSettings,
  usePosLocalPrinterSettings,
} from "@/features/pos/printing/printer-settings.local.client";

export interface PrinterSettingsState {
  connectionSupported: boolean;
  feedbackError: string | null;
  feedbackMessage: string | null;
  isBusy: boolean;
  savedDeviceLabel: string;
  settings: PosLocalPrinterSettings;
}

export interface PrinterSettingsActions {
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  openDrawer: () => Promise<void>;
  printTest: () => Promise<void>;
  reconnect: () => Promise<void>;
  resetLocalSettings: () => void;
  setConnectionSettings: (
    updater: (currentValue: PosLocalPrinterSettings) => PosLocalPrinterSettings
  ) => void;
}

export interface PrinterSettingsMeta {
  organizationId: string;
  runtimeState: ReturnType<typeof usePosPrinterRuntimeState>;
  savedDevice: ReturnType<typeof getSavedDeviceForConnection>;
}

export interface PrinterSettingsContextValue {
  actions: PrinterSettingsActions;
  meta: PrinterSettingsMeta;
  state: PrinterSettingsState;
}

const PrinterSettingsContext =
  createContext<PrinterSettingsContextValue | null>(null);

export function usePrinterSettings() {
  const context = use(PrinterSettingsContext);
  if (!context) {
    throw new Error(
      "usePrinterSettings must be used within PrinterSettingsProvider."
    );
  }
  return context;
}

export function PrinterSettingsProvider({
  children,
  organizationId,
}: {
  children: ReactNode;
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

  const setConnectionSettings = useCallback(
    (
      updater: (
        currentValue: PosLocalPrinterSettings
      ) => PosLocalPrinterSettings
    ) => {
      setSettings(updater);
    },
    [setSettings]
  );

  const executeAction = useCallback(
    async (action: () => Promise<unknown>, successMessage: string) => {
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
    },
    []
  );

  const value = useMemo<PrinterSettingsContextValue>(
    () => ({
      state: {
        connectionSupported,
        feedbackError,
        feedbackMessage,
        isBusy,
        savedDeviceLabel,
        settings,
      },
      actions: {
        connect: () =>
          executeAction(
            () => connectPosPrinter(organizationId),
            "Impresora conectada."
          ),
        disconnect: () =>
          executeAction(
            () => disconnectPosPrinter(),
            "Impresora desconectada."
          ),
        openDrawer: () =>
          executeAction(
            () => openPosCashDrawer(organizationId),
            "Pulso de caja enviado."
          ),
        printTest: () =>
          executeAction(
            () => printPosPrinterTestDocument(organizationId),
            "Ticket de prueba enviado."
          ),
        reconnect: () =>
          executeAction(
            () => reconnectPosPrinter({}, organizationId),
            "Reconexión completada."
          ),
        resetLocalSettings: () => {
          resetSettings();
          setFeedbackMessage("Configuración local restablecida.");
          setFeedbackError(null);
        },
        setConnectionSettings,
      },
      meta: {
        organizationId,
        runtimeState,
        savedDevice,
      },
    }),
    [
      connectionSupported,
      executeAction,
      feedbackError,
      feedbackMessage,
      isBusy,
      organizationId,
      resetSettings,
      runtimeState,
      savedDevice,
      savedDeviceLabel,
      setConnectionSettings,
      settings,
    ]
  );

  return (
    <PrinterSettingsContext value={value}>{children}</PrinterSettingsContext>
  );
}
