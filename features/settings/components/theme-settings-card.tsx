import { Monitor, Moon, Settings2, Sun } from "lucide-react";
import { SettingsCard } from "@/features/settings/components/settings-ui-primitives";
import { type ThemeMode, useTheme } from "@/hooks/use-theme";

export function ThemeSettingsCard() {
  const { mode, setMode } = useTheme();

  const options: { value: ThemeMode; label: string; icon: typeof Sun }[] = [
    { value: "light", label: "Claro", icon: Sun },
    { value: "dark", label: "Oscuro", icon: Moon },
    { value: "auto", label: "Sistema", icon: Monitor },
  ];

  return (
    <SettingsCard
      description="Elige el tema visual de la aplicación."
      icon={Settings2}
      title="Apariencia"
    >
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
    </SettingsCard>
  );
}
