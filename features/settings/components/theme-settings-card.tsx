import { Monitor, Moon, Settings2, Sun } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { type ThemeMode, useTheme } from "@/hooks/use-theme";

export function ThemeSettingsCard() {
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
