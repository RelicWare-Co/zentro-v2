import { ActionIcon } from "@mantine/core";
import { ArrowLeftRight, Lock, Printer } from "lucide-react";
import type { ActiveShift } from "@/features/pos/types";
import {
  posV2AccentSoftBg,
  posV2AccentText,
  posV2MutedText,
  posV2OrderCanvasBg,
  posV2OrderHoverSurface,
} from "@/features/posv2/components/pos-v2-order-styles";
import { cn } from "@/lib/utils";

interface PosV2HeaderProps {
  activeShift: ActiveShift | null;
  defaultTerminalName: string;
  onCashMovement: () => void;
  onCloseShift: () => void;
  onOpenDrawer: () => void;
}

export function PosV2Header({
  activeShift,
  defaultTerminalName: _defaultTerminalName,
  onCashMovement,
  onOpenDrawer,
  onCloseShift,
}: PosV2HeaderProps) {
  return (
    <header
      className={cn("shrink-0 px-4 py-3 md:px-6 md:py-4", posV2OrderCanvasBg)}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="font-extrabold text-white text-xl tracking-tight md:text-2xl">
            Zentro
          </span>
          <span
            className={cn(
              "rounded px-1.5 py-0.5 font-bold text-[10px] uppercase tracking-wider md:text-xs",
              posV2AccentSoftBg,
              posV2AccentText
            )}
          >
            POS
          </span>
        </div>

        <div className="flex items-center gap-2">
          <ActionIcon
            aria-label="Movimiento de efectivo"
            className={cn(
              "size-9 hover:text-white md:h-10 md:w-10",
              posV2MutedText,
              posV2OrderHoverSurface
            )}
            color="gray"
            disabled={!activeShift}
            onClick={onCashMovement}
            variant="subtle"
          >
            <ArrowLeftRight className="size-4 md:h-5 md:w-5" />
          </ActionIcon>
          <ActionIcon
            aria-label="Imprimir"
            className={cn(
              "size-9 hover:text-white md:h-10 md:w-10",
              posV2MutedText,
              posV2OrderHoverSurface
            )}
            color="gray"
            onClick={onOpenDrawer}
            variant="subtle"
          >
            <Printer className="size-4 md:h-5 md:w-5" />
          </ActionIcon>
          <ActionIcon
            aria-label="Cerrar turno"
            className="size-9 text-[#ef4444]! hover:bg-[rgba(239,68,68,0.1)] hover:text-red-400! md:h-10 md:w-10"
            color="red"
            disabled={!activeShift}
            onClick={onCloseShift}
            variant="subtle"
          >
            <Lock className="size-4 md:h-5 md:w-5" />
          </ActionIcon>
        </div>
      </div>
    </header>
  );
}
