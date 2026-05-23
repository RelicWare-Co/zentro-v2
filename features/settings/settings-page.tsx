import {
  Building2,
  CreditCard,
  Loader2,
  Monitor,
  Moon,
  Package,
  Plus,
  Save,
  Settings2,
  Store,
  Sun,
  Users,
} from "lucide-react";
import { lazy, Suspense, useId, useMemo, useState } from "react";
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
import { RestaurantModuleSettingsCard } from "@/features/restaurants/components/restaurant-module-settings-card";
import { useRestaurantConfiguration } from "@/features/restaurants/hooks/use-restaurants";
import {
  useSettings,
  useUpdateSettingsMutation,
} from "@/features/settings/hooks/use-settings";
import type { SettingsPageData } from "@/features/settings/organization-environment.shared";
import {
  normalizeOrganizationSettings,
  normalizePaymentMethodId,
  type OrganizationPaymentMethodSettings,
  type OrganizationSettings,
} from "@/features/settings/settings.shared";
import { type ThemeMode, useTheme } from "@/hooks/use-theme";
import { formatMoneyInput, parseMoneyInput } from "@/lib/utils";

const LocalPrinterSettingsCard = lazy(() =>
  import(
    "@/features/settings/components/local-printer-settings-card.client"
  ).then((mod) => ({ default: mod.LocalPrinterSettingsCard }))
);

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
        <Loader2 className="size-8 animate-spin text-[var(--color-voltage)]" />
      </div>
    );
  }

  if (settingsQuery.isError || !settingsQuery.data) {
    return (
      <div className="mx-auto max-w-3xl p-6 md:p-8">
        <Alert
          className="border-red-500/20 bg-red-500/10 text-red-100"
          variant="destructive"
        >
          <AlertTitle>No se pudo cargar configuración</AlertTitle>
          <AlertDescription>
            {getErrorMessage(
              settingsQuery.error,
              "Intenta recargar la página."
            )}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <SettingsForm
      data={settingsQuery.data}
      isSaving={updateSettingsMutation.isPending}
      key={JSON.stringify(settingsQuery.data.settings)}
      onSave={(settings) => updateSettingsMutation.mutateAsync({ settings })}
      saveError={updateSettingsMutation.error}
    />
  );
}

function LocalPrinterSettingsSection({
  organizationId,
}: {
  organizationId: string;
}) {
  return (
    <Suspense fallback={<LocalPrinterSettingsFallback />}>
      <LocalPrinterSettingsCard organizationId={organizationId} />
    </Suspense>
  );
}

function LocalPrinterSettingsFallback() {
  return (
    <Card className="border-zinc-800 bg-[var(--color-carbon)] text-[var(--color-photon)] shadow-none">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings2 className="size-4 text-[var(--color-voltage)]" />
          Impresión local
        </CardTitle>
        <CardDescription className="text-zinc-400">
          Cargando configuración de impresora…
        </CardDescription>
      </CardHeader>
    </Card>
  );
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
    normalizeOrganizationSettings(data.settings)
  );
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
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
    [data.settings]
  );
  const hasChanges = useMemo(
    () => JSON.stringify(draftSettings) !== JSON.stringify(persistedSettings),
    [draftSettings, persistedSettings]
  );
  const showSavedMessage = lastSavedAt !== null && !hasChanges;
  const newPaymentMethodSlug = useMemo(
    () => normalizePaymentMethodId(newPaymentMethodLabel),
    [newPaymentMethodLabel]
  );

  const handlePaymentMethodChange = (
    methodId: string,
    updates: Partial<OrganizationPaymentMethodSettings>
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
            : method
        ),
      },
    }));
  };

  const handleAddPaymentMethod = () => {
    const trimmedLabel = newPaymentMethodLabel.trim();
    if (!(trimmedLabel && newPaymentMethodSlug)) {
      setPaymentMethodDraftError(
        "Escribe un nombre válido para crear el método de pago."
      );
      return;
    }

    if (
      draftSettings.pos.paymentMethods.some(
        (paymentMethod) => paymentMethod.id === newPaymentMethodSlug
      )
    ) {
      setPaymentMethodDraftError(
        `Ya existe un método con el código ${newPaymentMethodSlug}.`
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
    if (!canManageSettings) {
      return;
    }
    await onSave(draftSettings);
    setLastSavedAt(Date.now());
  };

  const handleReset = () => {
    setDraftSettings(persistedSettings);
    setLastSavedAt(null);
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
            <h1 className="font-semibold text-3xl tracking-tight">
              Ajustes del negocio
            </h1>
            <p className="max-w-2xl text-sm text-zinc-400 md:text-base">
              Reglas operativas para caja, pagos, crédito, inventario y módulos.
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row">
          <Button
            className="border-zinc-700 bg-[var(--color-carbon)] text-zinc-200 hover:bg-white/5 hover:text-white"
            disabled={!(canManageSettings && hasChanges) || isSaving}
            onClick={handleReset}
            type="button"
            variant="outline"
          >
            Restablecer
          </Button>
          <Button
            className="bg-[var(--color-voltage)] text-black hover:bg-[#d9f15c]"
            disabled={!(canManageSettings && hasChanges) || isSaving}
            onClick={() => {
              handleSave().catch(() => undefined);
            }}
            type="button"
          >
            <Save className="size-4" />
            {isSaving ? "Guardando..." : "Guardar cambios"}
          </Button>
        </div>
      </section>

      {showSavedMessage ? (
        <Alert
          aria-live="polite"
          className="border-emerald-500/20 bg-emerald-500/10 text-emerald-100"
        >
          <AlertTitle>Cambios guardados</AlertTitle>
          <AlertDescription>
            Los próximos flujos usarán esta configuración.
          </AlertDescription>
        </Alert>
      ) : null}

      {canManageSettings ? null : (
        <Alert className="border-zinc-700 bg-[var(--color-carbon)] text-[var(--color-photon)]">
          <AlertTitle>Solo lectura</AlertTitle>
          <AlertDescription>
            Necesitas rol admin u owner para cambiar estos ajustes.
          </AlertDescription>
        </Alert>
      )}

      {saveError ? (
        <Alert
          aria-live="polite"
          className="border-red-500/20 bg-red-500/10 text-red-100"
          variant="destructive"
        >
          <AlertTitle>No se pudo guardar</AlertTitle>
          <AlertDescription>
            {getErrorMessage(
              saveError,
              "Revisa los campos e intenta otra vez."
            )}
          </AlertDescription>
        </Alert>
      ) : null}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          description={`Slug: ${data.organization.slug}`}
          icon={Building2}
          title="Organización activa"
          value={data.organization.name}
        />
        <SummaryCard
          description={`${data.stats.invitationsCount} invitaciones pendientes`}
          icon={Users}
          title="Equipo"
          value={`${data.stats.membersCount}`}
        />
        <SummaryCard
          description={`${data.stats.customersCount} clientes registrados`}
          icon={Package}
          title="Catálogo"
          value={`${data.stats.productsCount}`}
        />
        <SummaryCard
          description="Perfil de organización"
          icon={Settings2}
          title="Creada"
          value={dateFormatter.format(data.organization.createdAt)}
        />
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.1fr_1fr]">
        <div className="space-y-6">
          <ThemeSettingsCard />

          <Card className="border-zinc-800 bg-[var(--color-carbon)] text-[var(--color-photon)] shadow-none">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Store className="size-4 text-[var(--color-voltage)]" />
                Caja y POS
              </CardTitle>
              <CardDescription className="text-zinc-400">
                Valores por defecto para apertura de turno y checkout.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-2">
                <Label htmlFor={defaultTerminalNameId}>
                  Nombre por defecto de caja
                </Label>
                <Input
                  className="border-zinc-700 bg-black/20"
                  disabled={!canManageSettings}
                  id={defaultTerminalNameId}
                  onChange={(event) =>
                    setDraftSettings((currentValue) => ({
                      ...currentValue,
                      pos: {
                        ...currentValue.pos,
                        defaultTerminalName: event.target.value,
                      },
                    }))
                  }
                  value={draftSettings.pos.defaultTerminalName}
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor={defaultStartingCashId}>
                  Base inicial sugerida
                </Label>
                <Input
                  className="border-zinc-700 bg-black/20"
                  disabled={!canManageSettings}
                  id={defaultStartingCashId}
                  inputMode="numeric"
                  onChange={(event) =>
                    setDraftSettings((currentValue) => ({
                      ...currentValue,
                      pos: {
                        ...currentValue.pos,
                        defaultStartingCash: parseMoneyInput(
                          event.target.value
                        ),
                      },
                    }))
                  }
                  type="text"
                  value={formatMoneyInput(
                    draftSettings.pos.defaultStartingCash
                  )}
                />
              </div>

              <Separator className="bg-zinc-800" />

              <div className="space-y-4">
                <div>
                  <h3 className="font-medium text-white">Métodos de pago</h3>
                  <p className="mt-1 text-sm text-zinc-400">
                    Configura etiquetas, disponibilidad y referencia
                    obligatoria.
                  </p>
                </div>

                <div className="space-y-3">
                  {draftSettings.pos.paymentMethods.map((paymentMethod) => (
                    <div
                      className="rounded-2xl border border-zinc-800 bg-black/20 p-4"
                      key={paymentMethod.id}
                    >
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                        <div className="min-w-0 flex-1 space-y-3">
                          <div className="grid gap-2">
                            <Label
                              htmlFor={`payment-method-${paymentMethod.id}`}
                            >
                              Nombre visible
                            </Label>
                            <Input
                              className="border-zinc-700 bg-black/20"
                              disabled={!canManageSettings}
                              id={`payment-method-${paymentMethod.id}`}
                              onChange={(event) =>
                                handlePaymentMethodChange(paymentMethod.id, {
                                  label: event.target.value,
                                })
                              }
                              value={paymentMethod.label}
                            />
                          </div>
                          <p className="text-xs text-zinc-500">
                            Código interno:{" "}
                            <span className="text-zinc-400">
                              {paymentMethod.id}
                            </span>
                          </p>
                        </div>

                        <div className="flex flex-wrap items-center gap-6">
                          <ToggleControl
                            checked={paymentMethod.enabled}
                            disabled={
                              !canManageSettings || paymentMethod.id === "cash"
                            }
                            label="Activo"
                            onCheckedChange={(checked) =>
                              handlePaymentMethodChange(paymentMethod.id, {
                                enabled: checked,
                              })
                            }
                          />
                          <ToggleControl
                            checked={paymentMethod.requiresReference}
                            disabled={
                              !canManageSettings || paymentMethod.id === "cash"
                            }
                            label="Requiere referencia"
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

                <div className="rounded-2xl border border-zinc-700 border-dashed bg-black/10 p-4">
                  <div className="grid gap-3 lg:grid-cols-[1fr_auto] lg:items-end">
                    <div className="space-y-2">
                      <Label htmlFor={newPaymentMethodId}>
                        Agregar método personalizado
                      </Label>
                      <Input
                        className="border-zinc-700 bg-black/20"
                        disabled={!canManageSettings}
                        id={newPaymentMethodId}
                        onChange={(event) => {
                          if (paymentMethodDraftError) {
                            setPaymentMethodDraftError(null);
                          }
                          setNewPaymentMethodLabel(event.target.value);
                        }}
                        placeholder="Ej. Daviplata, QR, Zelle"
                        value={newPaymentMethodLabel}
                      />
                      <p className="text-xs text-zinc-500">
                        Código interno:{" "}
                        <span className="text-zinc-400">
                          {newPaymentMethodSlug || "Se genera automáticamente"}
                        </span>
                      </p>
                    </div>
                    <Button
                      className="border-zinc-700 bg-transparent text-zinc-200 hover:bg-white/5 hover:text-white"
                      disabled={!canManageSettings}
                      onClick={handleAddPaymentMethod}
                      type="button"
                      variant="outline"
                    >
                      <Plus className="size-4" />
                      Agregar
                    </Button>
                  </div>
                  {paymentMethodDraftError ? (
                    <p className="mt-3 text-red-400 text-sm">
                      {paymentMethodDraftError}
                    </p>
                  ) : null}
                </div>
              </div>
            </CardContent>
          </Card>

          <LocalPrinterSettingsSection organizationId={data.organization.id} />
        </div>

        <div className="space-y-6">
          <RestaurantConfigurationCard
            canManageSettings={canManageSettings}
            draftSettings={draftSettings}
            moduleAccess={data.modules.restaurants}
            onSettingsChange={setDraftSettings}
          />

          <Card className="border-zinc-800 bg-[var(--color-carbon)] text-[var(--color-photon)] shadow-none">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="size-4 text-[var(--color-voltage)]" />
                Crédito
              </CardTitle>
              <CardDescription className="text-zinc-400">
                Parámetros base para ventas fiadas y cartera.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <ToggleRow
                checked={draftSettings.credit.allowCreditSales}
                description="Controla si checkout puede dejar saldo pendiente."
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
                title="Permitir ventas a crédito"
              />
              <div className="grid gap-2">
                <Label htmlFor={defaultInterestRateId}>
                  Tasa de interés por defecto (%)
                </Label>
                <Input
                  className="border-zinc-700 bg-black/20"
                  disabled={!canManageSettings}
                  id={defaultInterestRateId}
                  max={100}
                  min={0}
                  onChange={(event) =>
                    setDraftSettings((currentValue) => ({
                      ...currentValue,
                      credit: {
                        ...currentValue.credit,
                        defaultInterestRate: Math.min(
                          100,
                          Math.max(0, Number(event.target.value) || 0)
                        ),
                      },
                    }))
                  }
                  type="number"
                  value={draftSettings.credit.defaultInterestRate}
                />
              </div>
            </CardContent>
          </Card>

          <Card className="border-zinc-800 bg-[var(--color-carbon)] text-[var(--color-photon)] shadow-none">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="size-4 text-[var(--color-voltage)]" />
                Inventario
              </CardTitle>
              <CardDescription className="text-zinc-400">
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
                    className="border-zinc-700 bg-black/20"
                    disabled={!canManageSettings}
                    id={lowStockThresholdId}
                    min={0}
                    onChange={(event) =>
                      setDraftSettings((currentValue) => ({
                        ...currentValue,
                        inventory: {
                          ...currentValue.inventory,
                          lowStockThreshold: Math.max(
                            0,
                            Number(event.target.value) || 0
                          ),
                        },
                      }))
                    }
                    type="number"
                    value={draftSettings.inventory.lowStockThreshold}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor={defaultTaxRateId}>
                    Impuesto por defecto (%)
                  </Label>
                  <Input
                    className="border-zinc-700 bg-black/20"
                    disabled={!canManageSettings}
                    id={defaultTaxRateId}
                    max={100}
                    min={0}
                    onChange={(event) =>
                      setDraftSettings((currentValue) => ({
                        ...currentValue,
                        inventory: {
                          ...currentValue.inventory,
                          defaultTaxRate: Math.min(
                            100,
                            Math.max(0, Number(event.target.value) || 0)
                          ),
                        },
                      }))
                    }
                    type="number"
                    value={draftSettings.inventory.defaultTaxRate}
                  />
                </div>
              </div>
              <ToggleRow
                checked={draftSettings.inventory.trackInventoryByDefault}
                description="Preferencia inicial para altas de productos."
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
                title="Controlar inventario en productos nuevos"
              />
              <ToggleRow
                checked={draftSettings.inventory.modifiersEnabledByDefault}
                description="Útil para extras y adiciones frecuentes."
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
                title="Permitir modificadores por defecto"
              />
            </CardContent>
          </Card>
        </div>
      </section>
    </main>
  );
}

function ThemeSettingsCard() {
  const { mode, setMode } = useTheme();

  const options: { value: ThemeMode; label: string; icon: typeof Sun }[] = [
    { value: "light", label: "Claro", icon: Sun },
    { value: "dark", label: "Oscuro", icon: Moon },
    { value: "auto", label: "Sistema", icon: Monitor },
  ];

  return (
    <Card className="border-zinc-800 bg-[var(--color-carbon)] text-[var(--color-photon)] shadow-none">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings2 className="size-4 text-[var(--color-voltage)]" />
          Apariencia
        </CardTitle>
        <CardDescription className="text-zinc-400">
          Elige el tema visual de la aplicación.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="inline-flex rounded-xl border border-zinc-700 bg-black/20 p-1">
          {options.map((option) => {
            const Icon = option.icon;
            const active = mode === option.value;
            return (
              <button
                className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 font-medium text-sm transition-colors ${
                  active
                    ? "bg-[var(--color-voltage)]/10 text-[var(--color-voltage)]"
                    : "text-zinc-400 hover:text-white"
                }`}
                key={option.value}
                onClick={() => setMode(option.value)}
                type="button"
              >
                <Icon className="size-4" />
                {option.label}
              </button>
            );
          })}
        </div>
      </CardContent>
    </Card>
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
    updater: (currentValue: OrganizationSettings) => OrganizationSettings
  ) => void;
}) {
  const { data: configuration } = useRestaurantConfiguration();

  return (
    <RestaurantModuleSettingsCard
      canManageSettings={canManageSettings}
      configuration={configuration ?? []}
      moduleAccess={moduleAccess}
      onSettingsChange={onSettingsChange}
      settings={draftSettings}
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
    <Card className="border-zinc-800 bg-[var(--color-carbon)] text-[var(--color-photon)] shadow-none">
      <CardHeader className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-2xl border border-[var(--color-voltage)]/20 bg-[var(--color-voltage)]/10 text-[var(--color-voltage)]">
            <Icon className="size-4" />
          </div>
          <div className="min-w-0 flex-1">
            <CardDescription className="text-zinc-400">{title}</CardDescription>
            <CardTitle className="mt-1 truncate font-semibold text-white text-xl tracking-tight">
              {value}
            </CardTitle>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <p className="text-sm text-zinc-400 leading-6">{description}</p>
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
      <span className="text-sm text-zinc-300">{label}</span>
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
    <div className="flex items-center justify-between gap-4 rounded-2xl border border-zinc-800 bg-black/20 p-4">
      <div>
        <Label className="font-medium text-white" htmlFor={id}>
          {title}
        </Label>
        <p className="mt-1 text-sm text-zinc-400">{description}</p>
      </div>
      <Switch
        checked={checked}
        disabled={disabled}
        id={id}
        onCheckedChange={onCheckedChange}
      />
    </div>
  );
}
