import {
  Button,
  Group,
  Modal,
  NativeSelect,
  Stack,
  Text,
  TextInput,
} from "@mantine/core";
import { Plus, UtensilsCrossed } from "lucide-react";
import { useEffect, useState } from "react";
import {
  useCreateRestaurantAreaMutation,
  useCreateRestaurantTableMutation,
} from "@/features/restaurants/hooks/use-restaurants";
import type { RestaurantAreaSummary } from "@/features/restaurants/restaurants-ui.shared";
import { suggestNextTableName } from "@/features/restaurants/restaurants-ui.shared";

interface CreateAreaDialogProps {
  onOpenChange: (open: boolean) => void;
  open: boolean;
}

export function CreateRestaurantAreaDialog({
  open,
  onOpenChange,
}: CreateAreaDialogProps) {
  const createAreaMutation = useCreateRestaurantAreaMutation();
  const [name, setName] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const resetForm = () => {
    setName("");
    setErrorMessage(null);
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      resetForm();
    }
    onOpenChange(nextOpen);
  };

  const handleSubmit = async () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      setErrorMessage("Escribe un nombre para la zona.");
      return;
    }

    setErrorMessage(null);
    try {
      await createAreaMutation.mutateAsync({ name: trimmedName });
      resetForm();
      onOpenChange(false);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "No se pudo crear la zona."
      );
    }
  };

  return (
    <Modal
      centered
      onClose={() => handleOpenChange(false)}
      opened={open}
      title="Nueva zona"
    >
      <Stack gap="md">
        <Text c="dimmed" size="sm">
          Agrupa mesas por salón, terraza, barra u otro espacio.
        </Text>
        <TextInput
          autoComplete="off"
          error={errorMessage}
          label="Nombre"
          onChange={(event) => setName(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              handleSubmit();
            }
          }}
          placeholder="Ej. Salón principal"
          value={name}
        />
        <Group justify="flex-end">
          <Button
            onClick={() => handleOpenChange(false)}
            type="button"
            variant="default"
          >
            Cancelar
          </Button>
          <Button
            c="black"
            color="voltage.5"
            loading={createAreaMutation.isPending}
            onClick={handleSubmit}
            type="button"
          >
            Crear zona
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}

interface CreateTableDialogProps {
  areas: RestaurantAreaSummary[];
  defaultAreaId?: string | null;
  onOpenChange: (open: boolean) => void;
  open: boolean;
}

export function CreateRestaurantTableDialog({
  areas,
  defaultAreaId,
  open,
  onOpenChange,
}: CreateTableDialogProps) {
  const createTableMutation = useCreateRestaurantTableMutation();
  const [areaId, setAreaId] = useState(defaultAreaId ?? areas[0]?.id ?? "");
  const [name, setName] = useState("");
  const [seats, setSeats] = useState("4");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const selectedArea = areas.find((area) => area.id === areaId) ?? areas[0];

  useEffect(() => {
    if (!open) {
      setErrorMessage(null);
      return;
    }
    const resolvedAreaId = defaultAreaId ?? areas[0]?.id ?? "";
    setAreaId(resolvedAreaId);
    const area = areas.find((item) => item.id === resolvedAreaId);
    setName(area ? suggestNextTableName(area.tables) : "Mesa 1");
    setSeats("4");
  }, [areas, defaultAreaId, open]);

  useEffect(() => {
    if (!(open && selectedArea)) {
      return;
    }
    setName((currentName) => {
      if (currentName.trim().length === 0) {
        return suggestNextTableName(selectedArea.tables);
      }
      return currentName;
    });
  }, [open, selectedArea]);

  const handleSubmit = async () => {
    const trimmedName = name.trim();
    if (!(trimmedName && areaId)) {
      setErrorMessage("Completa el nombre y selecciona una zona.");
      return;
    }

    setErrorMessage(null);
    try {
      await createTableMutation.mutateAsync({
        areaId,
        name: trimmedName,
        seats: Number(seats) || 0,
      });
      onOpenChange(false);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "No se pudo crear la mesa."
      );
    }
  };

  return (
    <Modal
      centered
      onClose={() => onOpenChange(false)}
      opened={open}
      title={
        <span className="flex items-center gap-2">
          <UtensilsCrossed
            aria-hidden="true"
            className="size-4 text-[var(--color-voltage)]"
          />
          Nueva mesa
        </span>
      }
    >
      <div className="space-y-5 py-2">
        <p className="text-sm text-zinc-400">
          Agrega una mesa a la zona activa. Aparecerá de inmediato en el plano.
        </p>

        <div className="space-y-4 rounded-lg border border-zinc-800 bg-black/20 p-4">
          <NativeSelect
            data={areas.map((area) => ({ value: area.id, label: area.name }))}
            label="Zona"
            onChange={(event) => setAreaId(event.target.value)}
            value={areaId}
          />
          <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_120px]">
            <TextInput
              autoComplete="off"
              label="Nombre"
              onChange={(event) => setName(event.target.value)}
              placeholder="Mesa 1"
              value={name}
            />
            <TextInput
              autoComplete="off"
              label="Puestos"
              min={0}
              onChange={(event) => setSeats(event.target.value)}
              placeholder="4"
              type="number"
              value={seats}
            />
          </div>
        </div>

        {errorMessage ? (
          <p className="text-red-300 text-sm">{errorMessage}</p>
        ) : null}

        <div className="-mx-6 flex justify-end gap-3 border-zinc-800 border-t px-6 pt-4">
          <Button
            className="border-zinc-700! text-zinc-300! hover:border-zinc-500 hover:text-white!"
            onClick={() => onOpenChange(false)}
            type="button"
            variant="outline"
          >
            Cancelar
          </Button>
          <Button
            c="black"
            color="voltage.5"
            disabled={areas.length === 0}
            loading={createTableMutation.isPending}
            onClick={handleSubmit}
            type="button"
          >
            Crear mesa
          </Button>
        </div>
      </div>
    </Modal>
  );
}

interface QuickAddTableCardProps {
  onClick: () => void;
}

export function QuickAddTableCard({ onClick }: QuickAddTableCardProps) {
  return (
    <button
      className="group flex min-h-[132px] flex-col items-center justify-center gap-2 rounded-2xl border-2 border-zinc-800 border-dashed bg-black/5 p-4 text-zinc-400 transition-colors hover:border-[var(--color-voltage)]/50 hover:bg-black/10 hover:text-[var(--color-voltage)]"
      onClick={onClick}
      type="button"
    >
      <span className="flex size-10 items-center justify-center rounded-full border border-zinc-700 bg-black/20 transition-colors group-hover:border-[var(--color-voltage)]/40">
        <Plus aria-hidden="true" className="size-5" />
      </span>
      <span className="font-medium text-sm">Agregar mesa</span>
    </button>
  );
}
