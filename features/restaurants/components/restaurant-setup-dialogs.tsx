import { Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
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
    <Dialog onOpenChange={handleOpenChange} open={open}>
      <DialogContent className="border-zinc-800 bg-[var(--color-carbon)] text-[var(--color-photon)]">
        <DialogHeader>
          <DialogTitle>Nueva zona</DialogTitle>
          <DialogDescription className="text-zinc-400">
            Agrupa mesas por salón, terraza, barra u otro espacio.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-2">
          <Label htmlFor="restaurant-new-area-name">Nombre</Label>
          <Input
            autoComplete="off"
            className="border-zinc-700 bg-black/20"
            id="restaurant-new-area-name"
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
          {errorMessage ? (
            <p className="text-red-300 text-sm">{errorMessage}</p>
          ) : null}
        </div>
        <DialogFooter>
          <Button
            className="border-zinc-700 bg-transparent text-zinc-100 hover:bg-white/5"
            onClick={() => handleOpenChange(false)}
            type="button"
            variant="outline"
          >
            Cancelar
          </Button>
          <Button
            className="bg-[var(--color-voltage)] text-black hover:bg-[#d9f15c]"
            disabled={createAreaMutation.isPending}
            onClick={handleSubmit}
            type="button"
          >
            {createAreaMutation.isPending ? "Creando…" : "Crear zona"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="border-zinc-800 bg-[var(--color-carbon)] text-[var(--color-photon)]">
        <DialogHeader>
          <DialogTitle>Nueva mesa</DialogTitle>
          <DialogDescription className="text-zinc-400">
            Agrega una mesa a la zona activa. Aparecerá de inmediato en el
            plano.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="restaurant-new-table-area">Zona</Label>
            <NativeSelect
              className="border-zinc-700 bg-black/20"
              id="restaurant-new-table-area"
              onChange={(event) => setAreaId(event.target.value)}
              value={areaId}
            >
              {areas.map((area) => (
                <NativeSelectOption key={area.id} value={area.id}>
                  {area.name}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </div>
          <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_120px]">
            <div className="grid gap-2">
              <Label htmlFor="restaurant-new-table-name">Nombre</Label>
              <Input
                autoComplete="off"
                className="border-zinc-700 bg-black/20"
                id="restaurant-new-table-name"
                onChange={(event) => setName(event.target.value)}
                placeholder="Mesa 1"
                value={name}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="restaurant-new-table-seats">Puestos</Label>
              <Input
                autoComplete="off"
                className="border-zinc-700 bg-black/20"
                id="restaurant-new-table-seats"
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
        </div>
        <DialogFooter>
          <Button
            className="border-zinc-700 bg-transparent text-zinc-100 hover:bg-white/5"
            onClick={() => onOpenChange(false)}
            type="button"
            variant="outline"
          >
            Cancelar
          </Button>
          <Button
            className="bg-[var(--color-voltage)] text-black hover:bg-[#d9f15c]"
            disabled={createTableMutation.isPending || areas.length === 0}
            onClick={handleSubmit}
            type="button"
          >
            {createTableMutation.isPending ? "Creando…" : "Crear mesa"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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
