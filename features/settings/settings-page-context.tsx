import {
  createContext,
  type ReactNode,
  use,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  useSettings,
  useUpdateSettingsMutation,
} from "@/features/settings/hooks/use-settings";
import type { SettingsPageData } from "@/features/settings/organization-environment.shared";
import {
  normalizeOrganizationSettings,
  type OrganizationPaymentMethodSettings,
  type OrganizationSettings,
} from "@/features/settings/settings.shared";
import {
  addPaymentMethodToDraft,
  derivePaymentMethodSlug,
  updatePaymentMethodInDraft,
} from "@/features/settings/settings-form.shared";

export interface SettingsPageState {
  canManageSettings: boolean;
  data: SettingsPageData | undefined;
  draftSettings: OrganizationSettings;
  error: unknown;
  hasChanges: boolean;
  isError: boolean;
  isPending: boolean;
  isSaving: boolean;
  newPaymentMethodLabel: string;
  newPaymentMethodSlug: string;
  paymentMethodDraftError: string | null;
  showSavedMessage: boolean;
}

export interface SettingsPageActions {
  addPaymentMethod: () => void;
  resetDraft: () => void;
  save: () => Promise<void>;
  setDraftSettings: (
    updater: (currentValue: OrganizationSettings) => OrganizationSettings
  ) => void;
  setNewPaymentMethodLabel: (value: string) => void;
  updateCredit: (partial: Partial<OrganizationSettings["credit"]>) => void;
  updateInventory: (
    partial: Partial<OrganizationSettings["inventory"]>
  ) => void;
  updatePaymentMethod: (
    methodId: string,
    updates: Partial<OrganizationPaymentMethodSettings>
  ) => void;
  updatePosField: <K extends keyof OrganizationSettings["pos"]>(
    field: K,
    value: OrganizationSettings["pos"][K]
  ) => void;
}

export interface SettingsPageMeta {
  persistedSettings: OrganizationSettings;
  saveError: unknown;
}

export interface SettingsPageContextValue {
  actions: SettingsPageActions;
  meta: SettingsPageMeta;
  state: SettingsPageState;
}

const SettingsPageContext = createContext<SettingsPageContextValue | null>(
  null
);

export function useSettingsPage() {
  const context = use(SettingsPageContext);
  if (!context) {
    throw new Error(
      "useSettingsPage must be used within SettingsPageProvider."
    );
  }
  return context;
}

export function SettingsPageProvider({ children }: { children: ReactNode }) {
  const settingsQuery = useSettings();
  const updateSettingsMutation = useUpdateSettingsMutation();

  const persistedSettings = useMemo(
    () =>
      settingsQuery.data
        ? normalizeOrganizationSettings(settingsQuery.data.settings)
        : normalizeOrganizationSettings({}),
    [settingsQuery.data]
  );

  const [draftSettings, setDraftSettingsState] =
    useState<OrganizationSettings>(persistedSettings);
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  const [newPaymentMethodLabel, setNewPaymentMethodLabelState] = useState("");
  const [paymentMethodDraftError, setPaymentMethodDraftError] = useState<
    string | null
  >(null);

  useEffect(() => {
    setDraftSettingsState(persistedSettings);
    setLastSavedAt(null);
    setPaymentMethodDraftError(null);
  }, [persistedSettings]);

  const hasChanges = useMemo(
    () => JSON.stringify(draftSettings) !== JSON.stringify(persistedSettings),
    [draftSettings, persistedSettings]
  );

  const showSavedMessage = lastSavedAt !== null && !hasChanges;
  const newPaymentMethodSlug = useMemo(
    () => derivePaymentMethodSlug(newPaymentMethodLabel),
    [newPaymentMethodLabel]
  );

  const canManageSettings =
    settingsQuery.data?.viewer.canManageSettings ?? false;

  const setDraftSettings = useCallback(
    (updater: (currentValue: OrganizationSettings) => OrganizationSettings) => {
      setDraftSettingsState(updater);
    },
    []
  );

  const updatePosField = useCallback(
    <K extends keyof OrganizationSettings["pos"]>(
      field: K,
      value: OrganizationSettings["pos"][K]
    ) => {
      setDraftSettingsState((currentValue) => ({
        ...currentValue,
        pos: {
          ...currentValue.pos,
          [field]: value,
        },
      }));
    },
    []
  );

  const updatePaymentMethod = useCallback(
    (methodId: string, updates: Partial<OrganizationPaymentMethodSettings>) => {
      setDraftSettingsState((currentValue) =>
        updatePaymentMethodInDraft(currentValue, methodId, updates)
      );
    },
    []
  );

  const setNewPaymentMethodLabel = useCallback((value: string) => {
    setPaymentMethodDraftError(null);
    setNewPaymentMethodLabelState(value);
  }, []);

  const addPaymentMethod = useCallback(() => {
    setDraftSettingsState((currentDraft) => {
      const result = addPaymentMethodToDraft(
        currentDraft,
        newPaymentMethodLabel,
        newPaymentMethodSlug
      );

      if ("error" in result && result.error) {
        setPaymentMethodDraftError(result.error);
        return currentDraft;
      }

      if (!result.settings) {
        return currentDraft;
      }

      setNewPaymentMethodLabelState("");
      setPaymentMethodDraftError(null);
      return result.settings;
    });
  }, [newPaymentMethodLabel, newPaymentMethodSlug]);

  const updateCredit = useCallback(
    (partial: Partial<OrganizationSettings["credit"]>) => {
      setDraftSettingsState((currentValue) => ({
        ...currentValue,
        credit: {
          ...currentValue.credit,
          ...partial,
        },
      }));
    },
    []
  );

  const updateInventory = useCallback(
    (partial: Partial<OrganizationSettings["inventory"]>) => {
      setDraftSettingsState((currentValue) => ({
        ...currentValue,
        inventory: {
          ...currentValue.inventory,
          ...partial,
        },
      }));
    },
    []
  );

  const resetDraft = useCallback(() => {
    setDraftSettingsState(persistedSettings);
    setLastSavedAt(null);
    setPaymentMethodDraftError(null);
  }, [persistedSettings]);

  const save = useCallback(async () => {
    if (!canManageSettings) {
      return;
    }
    await updateSettingsMutation.mutateAsync({ settings: draftSettings });
    setLastSavedAt(Date.now());
  }, [canManageSettings, draftSettings, updateSettingsMutation]);

  const value = useMemo<SettingsPageContextValue>(
    () => ({
      state: {
        data: settingsQuery.data,
        canManageSettings,
        draftSettings,
        error: settingsQuery.error,
        hasChanges,
        showSavedMessage,
        isPending: settingsQuery.isPending,
        isError: settingsQuery.isError || !settingsQuery.data,
        isSaving: updateSettingsMutation.isPending,
        newPaymentMethodLabel,
        newPaymentMethodSlug,
        paymentMethodDraftError,
      },
      actions: {
        save,
        resetDraft,
        setDraftSettings,
        updatePosField,
        updatePaymentMethod,
        addPaymentMethod,
        setNewPaymentMethodLabel,
        updateCredit,
        updateInventory,
      },
      meta: {
        saveError: updateSettingsMutation.error,
        persistedSettings,
      },
    }),
    [
      settingsQuery.data,
      settingsQuery.error,
      settingsQuery.isPending,
      settingsQuery.isError,
      canManageSettings,
      draftSettings,
      hasChanges,
      showSavedMessage,
      updateSettingsMutation.isPending,
      updateSettingsMutation.error,
      newPaymentMethodLabel,
      newPaymentMethodSlug,
      paymentMethodDraftError,
      save,
      resetDraft,
      setDraftSettings,
      updatePosField,
      updatePaymentMethod,
      addPaymentMethod,
      setNewPaymentMethodLabel,
      updateCredit,
      updateInventory,
      persistedSettings,
    ]
  );

  return <SettingsPageContext value={value}>{children}</SettingsPageContext>;
}
