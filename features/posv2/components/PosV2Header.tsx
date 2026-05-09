import { ArrowLeftRight, Lock, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ActiveShift } from "@/features/pos/types";

interface PosV2HeaderProps {
  activeShift: ActiveShift | null;
  defaultTerminalName: string;
  onCashMovement: () => void;
  onOpenDrawer: () => void;
  onCloseShift: () => void;
}

export function PosV2Header({
  activeShift,
  defaultTerminalName,
  onCashMovement,
  onOpenDrawer,
  onCloseShift,
}: PosV2HeaderProps) {
  return (
    <header className="shrink-0 px-4 py-3 md:px-6 md:py-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xl md:text-2xl font-extrabold tracking-tight text-[var(--color-foreground)]">
            Zentra
          </span>
          <span className="text-[10px] md:text-xs font-bold uppercase tracking-wider text-[var(--color-voltage)] bg-[var(--color-voltage)]/10 px-1.5 py-0.5 rounded">
            POS
          </span>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={onCashMovement}
            disabled={!activeShift}
            className="h-9 w-9 md:h-10 md:w-10 rounded-lg text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)] hover:bg-[var(--color-muted)] disabled:opacity-40"
          >
            <ArrowLeftRight className="h-4 w-4 md:h-5 md:w-5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={onOpenDrawer}
            disabled={!activeShift}
            className="h-9 w-9 md:h-10 md:w-10 rounded-lg text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)] hover:bg-[var(--color-muted)] disabled:opacity-40"
          >
            <Printer className="h-4 w-4 md:h-5 md:w-5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={onCloseShift}
            disabled={!activeShift}
            className="h-9 w-9 md:h-10 md:w-10 rounded-lg text-red-500 hover:text-red-400 hover:bg-red-500/10 disabled:opacity-40"
          >
            <Lock className="h-4 w-4 md:h-5 md:w-5" />
          </Button>
        </div>
      </div>
    </header>
  );
}
