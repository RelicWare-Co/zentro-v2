import { Alert, Button, Divider, Switch, TextInput } from "@mantine/core";
import { Plus, Trash2, UtensilsCrossed } from "lucide-react";
import { useState } from "react";
import type { ModuleAccessState } from "@/features/modules/module-access.shared";
import type { RestaurantConfiguration } from "@/features/restaurants/hooks/use-restaurants";
import {
  useCreateRestaurantAreaMutation,
  useCreateRestaurantTableMutation,
  useDeleteRestaurantAreaMutation,
  useDeleteRestaurantTableMutation,
  useUpdateRestaurantTableMutation,
} from "@/features/restaurants/hooks/use-restaurants";
import type { OrganizationSettings } from "@/features/settings/settings.shared";

interface RestaurantModuleSettingsCardProps {
  canManageSettings: boolean;
  configuration: RestaurantConfiguration;
  moduleAccess: ModuleAccessState;
  onSettingsChange(
    updater: (currentValue: OrganizationSettings) => OrganizationSettings
  ): void;
  settings: OrganizationSettings;
}

export function RestaurantModuleSettingsCard(
  props: RestaurantModuleSettingsCardProps
) {
  const createRestaurantAreaMutation = useCreateRestaurantAreaMutation();
  const createRestaurantTableMutation = useCreateRestaurantTableMutation();
  const deleteRestaurantAreaMutation = useDeleteRestaurantAreaMutation();
  const deleteRestaurantTableMutation = useDeleteRestaurantTableMutation();
  const updateRestaurantTableMutation = useUpdateRestaurantTableMutation();
  const [newAreaName, setNewAreaName] = useState("");
  const [newTableDrafts, setNewTableDrafts] = useState<
    Record<string, { name: string; seats: string }>
  >({});

  const restaurantConfigMutationError = (() => {
    if (createRestaurantAreaMutation.error instanceof Error) {
      return createRestaurantAreaMutation.error.message;
    }
    if (createRestaurantTableMutation.error instanceof Error) {
      return createRestaurantTableMutation.error.message;
    }
    if (deleteRestaurantAreaMutation.error instanceof Error) {
      return deleteRestaurantAreaMutation.error.message;
    }
    if (deleteRestaurantTableMutation.error instanceof Error) {
      return deleteRestaurantTableMutation.error.message;
    }
    if (updateRestaurantTableMutation.error instanceof Error) {
      return updateRestaurantTableMutation.error.message;
    }
    return null;
  })();

  const handleCreateArea = async () => {
    const trimmedName = newAreaName.trim();
    if (!trimmedName) {
      return;
    }

    await createRestaurantAreaMutation.mutateAsync({
      name: trimmedName,
    });
    setNewAreaName("");
  };

  const handleCreateTable = async (areaId: string) => {
    const draft = newTableDrafts[areaId];
    const tableName = draft?.name?.trim() ?? "";
    if (!tableName) {
      return;
    }

    await createRestaurantTableMutation.mutateAsync({
      areaId,
      name: tableName,
      seats: Number(draft?.seats ?? 0) || 0,
    });
    setNewTableDrafts((currentValue) => ({
      ...currentValue,
      [areaId]: { name: "", seats: "" },
    }));
  };

  return (
    <div className="rounded-xl border border-zinc-800 bg-[var(--color-carbon)] p-6 text-[var(--color-photon)]">
      <div className="space-y-1.5">
        <h3 className="flex items-center gap-2 font-semibold">
          <UtensilsCrossed
            aria-hidden="true"
            className="size-4 text-[var(--color-voltage)]"
          />
          Restaurantes
        </h3>
        <p className="text-sm text-zinc-400">
          Activación del módulo, salida de cocina y estructura de mesas.
        </p>
      </div>
      <div className="mt-6 space-y-6">
        {props.moduleAccess.entitlementStatus === "blocked" ? (
          <Alert aria-live="polite" color="gray" title="Módulo bloqueado">
            Esta organización no tiene entitlement para restaurantes.
          </Alert>
        ) : null}

        {restaurantConfigMutationError ? (
          <Alert
            aria-live="polite"
            color="red"
            title="No se pudo actualizar restaurantes"
            variant="light"
          >
            {restaurantConfigMutationError}
          </Alert>
        ) : null}

        <div className="flex items-center justify-between rounded-lg border border-zinc-800 bg-black/10 p-4">
          <div>
            <p className="font-medium text-white">Activar módulo</p>
            <p className="text-sm text-zinc-400">
              Muestra rutas y habilita el flujo de mesas.
            </p>
          </div>
          <Switch
            checked={props.settings.modules.restaurants.enabled}
            color="voltage.5"
            disabled={!props.moduleAccess.canManageToggle}
            onChange={(event) => {
              const enabled = event.currentTarget.checked;
              props.onSettingsChange((currentValue) => ({
                ...currentValue,
                modules: {
                  ...currentValue.modules,
                  restaurants: {
                    ...currentValue.modules.restaurants,
                    enabled,
                  },
                },
              }));
            }}
          />
        </div>

        <div className="grid gap-3">
          <div className="flex items-center justify-between rounded-lg border border-zinc-800 bg-black/10 p-4">
            <div>
              <p className="font-medium text-white">Pantalla de cocina</p>
              <p className="text-sm text-zinc-400">
                Habilita la ruta interna de cocina.
              </p>
            </div>
            <Switch
              checked={props.settings.restaurants.kitchen.displayEnabled}
              color="voltage.5"
              disabled={!props.canManageSettings}
              onChange={(event) => {
                const displayEnabled = event.currentTarget.checked;
                props.onSettingsChange((currentValue) => ({
                  ...currentValue,
                  restaurants: {
                    ...currentValue.restaurants,
                    kitchen: {
                      ...currentValue.restaurants.kitchen,
                      displayEnabled,
                    },
                  },
                }));
              }}
            />
          </div>
          <div className="flex items-center justify-between rounded-lg border border-zinc-800 bg-black/10 p-4">
            <div>
              <p className="font-medium text-white">Imprimir comandas</p>
              <p className="text-sm text-zinc-400">
                Permite imprimir ticket de cocina al enviar.
              </p>
            </div>
            <Switch
              checked={props.settings.restaurants.kitchen.printTicketsEnabled}
              color="voltage.5"
              disabled={!props.canManageSettings}
              onChange={(event) => {
                const printTicketsEnabled = event.currentTarget.checked;
                props.onSettingsChange((currentValue) => ({
                  ...currentValue,
                  restaurants: {
                    ...currentValue.restaurants,
                    kitchen: {
                      ...currentValue.restaurants.kitchen,
                      printTicketsEnabled,
                    },
                  },
                }));
              }}
            />
          </div>
          <div className="flex items-center justify-between rounded-lg border border-zinc-800 bg-black/10 p-4">
            <div>
              <p className="font-medium text-white">Auto imprimir</p>
              <p className="text-sm text-zinc-400">
                Dispara impresión inmediata al enviar a cocina.
              </p>
            </div>
            <Switch
              checked={props.settings.restaurants.kitchen.autoPrintOnSend}
              color="voltage.5"
              disabled={
                !(
                  props.canManageSettings &&
                  props.settings.restaurants.kitchen.printTicketsEnabled
                )
              }
              onChange={(event) => {
                const autoPrintOnSend = event.currentTarget.checked;
                props.onSettingsChange((currentValue) => ({
                  ...currentValue,
                  restaurants: {
                    ...currentValue.restaurants,
                    kitchen: {
                      ...currentValue.restaurants.kitchen,
                      autoPrintOnSend,
                    },
                  },
                }));
              }}
            />
          </div>
        </div>

        <Divider color="dark.4" />

        <div className="space-y-4">
          <div className="grid items-end gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
            <TextInput
              autoComplete="off"
              disabled={!props.canManageSettings}
              label="Agregar zona"
              name="new-area-name"
              onChange={(event) => setNewAreaName(event.target.value)}
              placeholder="Ej. Salón, Terraza, Barra…"
              value={newAreaName}
            />
            <Button
              disabled={
                !props.canManageSettings ||
                createRestaurantAreaMutation.isPending
              }
              leftSection={<Plus aria-hidden="true" className="size-4" />}
              onClick={handleCreateArea}
              type="button"
              variant="outline"
            >
              Agregar zona
            </Button>
          </div>

          <div className="space-y-3">
            {props.configuration.map((area) => (
              <div
                className="rounded-lg border border-zinc-800 bg-black/10 p-4"
                key={area.id}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="font-medium text-white">{area.name}</div>
                  <Button
                    disabled={
                      !props.canManageSettings ||
                      deleteRestaurantAreaMutation.isPending ||
                      area.tables.length > 0
                    }
                    leftSection={
                      <Trash2 aria-hidden="true" className="size-4" />
                    }
                    onClick={() => {
                      deleteRestaurantAreaMutation.mutate({
                        id: area.id,
                      });
                    }}
                    type="button"
                    variant="outline"
                  >
                    Eliminar
                  </Button>
                </div>

                <div className="mt-4 space-y-2">
                  {area.tables.map((table) => (
                    <div
                      className="flex items-center justify-between gap-3 rounded-lg border border-zinc-800 px-3 py-2"
                      key={table.id}
                    >
                      <div className="min-w-0">
                        <div className="truncate">{table.name}</div>
                        <div className="text-xs text-zinc-400">
                          {table.seats > 0
                            ? `${table.seats} puestos`
                            : "Sin capacidad definida"}
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <Switch
                          checked={table.isActive}
                          color="voltage.5"
                          disabled={
                            !props.canManageSettings ||
                            updateRestaurantTableMutation.isPending
                          }
                          onChange={(event) => {
                            const isActive = event.currentTarget.checked;
                            updateRestaurantTableMutation.mutate({
                              id: table.id,
                              isActive,
                            });
                          }}
                        />
                        <Button
                          aria-label={`Eliminar ${table.name}`}
                          disabled={
                            !props.canManageSettings ||
                            deleteRestaurantTableMutation.isPending
                          }
                          onClick={() => {
                            deleteRestaurantTableMutation.mutate({
                              id: table.id,
                            });
                          }}
                          type="button"
                          variant="outline"
                        >
                          <Trash2 aria-hidden="true" className="size-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_120px_auto]">
                  <TextInput
                    autoComplete="off"
                    disabled={!props.canManageSettings}
                    name={`table-name-${area.id}`}
                    onChange={(event) =>
                      setNewTableDrafts((currentValue) => ({
                        ...currentValue,
                        [area.id]: {
                          name: event.target.value,
                          seats: currentValue[area.id]?.seats ?? "",
                        },
                      }))
                    }
                    placeholder="Nueva mesa…"
                    value={newTableDrafts[area.id]?.name ?? ""}
                  />
                  <TextInput
                    autoComplete="off"
                    disabled={!props.canManageSettings}
                    min={0}
                    name={`table-seats-${area.id}`}
                    onChange={(event) =>
                      setNewTableDrafts((currentValue) => ({
                        ...currentValue,
                        [area.id]: {
                          name: currentValue[area.id]?.name ?? "",
                          seats: event.target.value,
                        },
                      }))
                    }
                    placeholder="Puestos"
                    type="number"
                    value={newTableDrafts[area.id]?.seats ?? ""}
                  />
                  <Button
                    disabled={
                      !props.canManageSettings ||
                      createRestaurantTableMutation.isPending
                    }
                    leftSection={<Plus aria-hidden="true" className="size-4" />}
                    onClick={() => handleCreateTable(area.id)}
                    type="button"
                    variant="outline"
                  >
                    Agregar
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
