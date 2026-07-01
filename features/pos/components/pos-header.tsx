import { Button, Divider } from "@mantine/core";
import { ArrowLeftRight, Lock, Plus, Printer, Unlock, Zap } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import type { ActiveShift, PosCustomer } from "../types";
import { CustomerPicker } from "./customer-picker";

interface PosHeaderProps {
  activeShift: ActiveShift | null;
  customers: PosCustomer[];
  defaultTerminalName: string;
  headerActions?: ReactNode;
  isQuickSaleMode?: boolean;
  onCashMovement: () => void;
  onCloseShift: () => void;
  onCreateCustomer: () => void;
  onCustomerChange: (customerId: string) => void;
  onOpenDrawer: () => void;
  onOpenShift: () => void;
  onToggleQuickSaleMode?: () => void;
  selectedCustomerId: string;
}

export function PosHeader({
  activeShift,
  defaultTerminalName,
  customers,
  headerActions,
  selectedCustomerId,
  onCustomerChange,
  onOpenShift,
  onCashMovement,
  onOpenDrawer,
  onCloseShift,
  onCreateCustomer,
  isQuickSaleMode,
  onToggleQuickSaleMode,
}: PosHeaderProps) {
  return (
    <header className="z-10 shrink-0 border-zinc-800 border-b bg-[var(--color-carbon)] px-3 py-3 md:px-4 md:py-2">
      <div className="flex min-h-10 flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 flex-1 flex-col gap-3 md:flex-row md:items-center">
          <div className="flex shrink-0 items-center gap-2 whitespace-nowrap text-sm">
            <span
              className={`size-2.5 rounded-full ${
                activeShift
                  ? "bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]"
                  : "bg-zinc-500"
              }`}
            />
            <span className="font-semibold text-white">
              {activeShift?.terminalName || defaultTerminalName}
            </span>
            <span className="rounded-md bg-zinc-800 px-1.5 py-0.5 text-xs text-zinc-400">
              {activeShift ? "Abierto" : "Cerrado"}
            </span>
          </div>

          <Divider
            className="hidden h-5 md:block"
            color="dark.4"
            orientation="vertical"
          />

          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900/50 px-3 py-2 transition-colors focus-within:border-[var(--color-voltage)] focus-within:ring-1 focus-within:ring-[var(--color-voltage)]/20">
            <CustomerPicker
              buttonClassName="h-auto min-h-7 flex-1 border-0 bg-transparent px-0 py-0 hover:bg-transparent"
              contentClassName="w-[min(320px,calc(100vw-2rem))]"
              customers={customers}
              onCustomerChange={onCustomerChange}
              selectedCustomerId={selectedCustomerId}
            />
            <Button
              className="shrink-0 text-[var(--color-voltage)]! hover:bg-[var(--color-voltage)]/10 hover:text-[var(--color-voltage)]!"
              leftSection={<Plus className="size-3.5" />}
              onClick={onCreateCustomer}
              size="compact-sm"
              type="button"
              variant="subtle"
            >
              Cliente
            </Button>
          </div>
        </div>

        <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center sm:justify-end lg:w-auto">
          <Button
            className={cn(
              "h-9 w-9 shrink-0 p-0",
              isQuickSaleMode
                ? "border-[var(--color-voltage)]/40! bg-[var(--color-voltage)]/15! text-[var(--color-voltage)]! hover:bg-[var(--color-voltage)]/25"
                : "border-zinc-700! bg-zinc-900/50! text-zinc-500! hover:border-zinc-600 hover:bg-zinc-800 hover:text-zinc-300"
            )}
            onClick={onToggleQuickSaleMode}
            size="sm"
            title={
              isQuickSaleMode
                ? "Desactivar venta rápida"
                : "Activar venta rápida"
            }
            variant="outline"
          >
            <Zap className="size-4" />
          </Button>
          {headerActions}
          <Button
            className="whitespace-nowrap border-zinc-700! bg-zinc-900/50! text-zinc-300! hover:border-zinc-600 hover:bg-zinc-800 hover:text-white!"
            disabled={!activeShift}
            leftSection={<ArrowLeftRight className="size-4" />}
            onClick={onCashMovement}
            size="sm"
            variant="outline"
          >
            <span className="sm:hidden">Caja</span>
            <span className="hidden sm:inline">Movimiento de Caja</span>
          </Button>
          <Button
            className="whitespace-nowrap border-zinc-700! bg-zinc-900/50! text-zinc-300! hover:border-zinc-600 hover:bg-zinc-800 hover:text-white!"
            leftSection={<Printer className="size-4" />}
            onClick={onOpenDrawer}
            size="sm"
            variant="outline"
          >
            <span className="sm:hidden">Abrir</span>
            <span className="hidden sm:inline">Abrir Caja</span>
          </Button>
          <Button
            className={cn(
              "whitespace-nowrap",
              activeShift
                ? "border-red-900/30! bg-red-900/10! text-red-400! hover:border-red-900/50 hover:bg-red-900/30 hover:text-red-300!"
                : "border-[var(--color-voltage)]/40! bg-[var(--color-voltage)]/10! text-[var(--color-voltage)]! hover:bg-[var(--color-voltage)]/20"
            )}
            leftSection={
              activeShift ? (
                <Lock className="size-4" />
              ) : (
                <Unlock className="size-4" />
              )
            }
            onClick={activeShift ? onCloseShift : onOpenShift}
            size="sm"
            variant="outline"
          >
            <span className="sm:hidden">Turno</span>
            <span className="hidden sm:inline">
              {activeShift ? "Cerrar Turno" : "Abrir Turno"}
            </span>
          </Button>
        </div>
      </div>
    </header>
  );
}
