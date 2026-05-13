import { Plus, Trash2, UtensilsCrossed } from "lucide-react";
import { useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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

  const restaurantConfigMutationError =
    createRestaurantAreaMutation.error instanceof Error
      ? createRestaurantAreaMutation.error.message
      : createRestaurantTableMutation.error instanceof Error
        ? createRestaurantTableMutation.error.message
        : deleteRestaurantAreaMutation.error instanceof Error
          ? deleteRestaurantAreaMutation.error.message
          : deleteRestaurantTableMutation.error instanceof Error
            ? deleteRestaurantTableMutation.error.message
            : updateRestaurantTableMutation.error instanceof Error
              ? updateRestaurantTableMutation.error.message
              : null;

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
    <Card className="border-zinc-800 bg-[var(--color-carbon)] text-[var(--color-photon)] shadow-none">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <UtensilsCrossed
            aria-hidden="true"
            className="size-4 text-[var(--color-voltage)]"
          />
          Restaurantes
        </CardTitle>
        <CardDescription className="text-zinc-400">
          Activación del módulo, salida de cocina y estructura de mesas.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {props.moduleAccess.entitlementStatus === "blocked" ? (
          <Alert
            aria-live="polite"
            className="border-zinc-700 bg-black/10 text-[var(--color-photon)]"
          >
            <AlertTitle>Módulo bloqueado</AlertTitle>
            <AlertDescription>
              Esta organización no tiene entitlement para restaurantes.
            </AlertDescription>
          </Alert>
        ) : null}

        {restaurantConfigMutationError ? (
          <Alert
            aria-live="polite"
            className="border-red-500/20 bg-red-500/10 text-red-100"
            variant="destructive"
          >
            <AlertTitle>No se pudo actualizar restaurantes</AlertTitle>
            <AlertDescription>{restaurantConfigMutationError}</AlertDescription>
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
            disabled={!props.moduleAccess.canManageToggle}
            onCheckedChange={(checked) =>
              props.onSettingsChange((currentValue) => ({
                ...currentValue,
                modules: {
                  ...currentValue.modules,
                  restaurants: {
                    ...currentValue.modules.restaurants,
                    enabled: checked,
                  },
                },
              }))
            }
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
              disabled={!props.canManageSettings}
              onCheckedChange={(checked) =>
                props.onSettingsChange((currentValue) => ({
                  ...currentValue,
                  restaurants: {
                    ...currentValue.restaurants,
                    kitchen: {
                      ...currentValue.restaurants.kitchen,
                      displayEnabled: checked,
                    },
                  },
                }))
              }
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
              disabled={!props.canManageSettings}
              onCheckedChange={(checked) =>
                props.onSettingsChange((currentValue) => ({
                  ...currentValue,
                  restaurants: {
                    ...currentValue.restaurants,
                    kitchen: {
                      ...currentValue.restaurants.kitchen,
                      printTicketsEnabled: checked,
                    },
                  },
                }))
              }
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
              disabled={
                !(
                  props.canManageSettings &&
                  props.settings.restaurants.kitchen.printTicketsEnabled
                )
              }
              onCheckedChange={(checked) =>
                props.onSettingsChange((currentValue) => ({
                  ...currentValue,
                  restaurants: {
                    ...currentValue.restaurants,
                    kitchen: {
                      ...currentValue.restaurants.kitchen,
                      autoPrintOnSend: checked,
                    },
                  },
                }))
              }
            />
          </div>
        </div>

        <Separator className="border-zinc-800" />

        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
            <div className="grid gap-2">
              <Label htmlFor="new-area-name">Agregar zona</Label>
              <Input
                autoComplete="off"
                className="border-zinc-700 bg-black/20"
                disabled={!props.canManageSettings}
                id="new-area-name"
                name="new-area-name"
                onChange={(event) => setNewAreaName(event.target.value)}
                placeholder="Ej. Salón, Terraza, Barra…"
                value={newAreaName}
              />
            </div>
            <div className="flex items-end">
              <Button
                className="border-zinc-700 bg-transparent text-zinc-100 hover:bg-white/5"
                disabled={
                  !props.canManageSettings ||
                  createRestaurantAreaMutation.isPending
                }
                onClick={handleCreateArea}
                type="button"
                variant="outline"
              >
                <Plus aria-hidden="true" className="size-4" />
                Agregar zona
              </Button>
            </div>
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
                    className="border-zinc-700 bg-transparent text-zinc-100 hover:bg-white/5"
                    disabled={
                      !props.canManageSettings ||
                      deleteRestaurantAreaMutation.isPending ||
                      area.tables.length > 0
                    }
                    onClick={() => {
                      const confirmed = window.confirm(
                        "¿Eliminar esta zona? Solo funciona si ya no tiene mesas."
                      );
                      if (!confirmed) {
                        return;
                      }
                      deleteRestaurantAreaMutation.mutate({
                        id: area.id,
                      });
                    }}
                    type="button"
                    variant="outline"
                  >
                    <Trash2 aria-hidden="true" className="size-4" />
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
                          disabled={
                            !props.canManageSettings ||
                            updateRestaurantTableMutation.isPending
                          }
                          onCheckedChange={(checked) =>
                            updateRestaurantTableMutation.mutate({
                              id: table.id,
                              isActive: checked,
                            })
                          }
                        />
                        <Button
                          aria-label={`Eliminar ${table.name}`}
                          className="border-zinc-700 bg-transparent text-zinc-100 hover:bg-white/5"
                          disabled={
                            !props.canManageSettings ||
                            deleteRestaurantTableMutation.isPending
                          }
                          onClick={() => {
                            const confirmed = window.confirm(
                              "¿Eliminar esta mesa? Si ya tiene historial, la operación será rechazada."
                            );
                            if (!confirmed) {
                              return;
                            }
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
                  <Input
                    autoComplete="off"
                    className="border-zinc-700 bg-black/20"
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
                  <Input
                    autoComplete="off"
                    className="border-zinc-700 bg-black/20"
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
                    className="border-zinc-700 bg-transparent text-zinc-100 hover:bg-white/5"
                    disabled={
                      !props.canManageSettings ||
                      createRestaurantTableMutation.isPending
                    }
                    onClick={() => handleCreateTable(area.id)}
                    type="button"
                    variant="outline"
                  >
                    <Plus aria-hidden="true" className="size-4" />
                    Agregar
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
