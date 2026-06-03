"use client";

import { Code2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  openZentroDesktopDevTools,
  useIsZentroDesktop,
} from "@/lib/zentro-desktop.client";

export function DesktopDevtoolsSettingsCard() {
  const isDesktop = useIsZentroDesktop();
  const [isOpening, setIsOpening] = useState(false);

  if (!isDesktop) {
    return null;
  }

  const handleOpenDevTools = () => {
    setIsOpening(true);
    openZentroDesktopDevTools().finally(() => {
      setIsOpening(false);
    });
  };

  return (
    <Card className="border-zinc-800 bg-[var(--color-carbon)] text-[var(--color-photon)] shadow-none">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Code2 className="size-4 text-[var(--color-voltage)]" />
          App de escritorio
        </CardTitle>
        <CardDescription className="text-zinc-400">
          Herramientas de depuración para la ventana de Zentro Desktop.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button
          className="border-zinc-700 bg-black/20"
          disabled={isOpening}
          onClick={handleOpenDevTools}
          type="button"
          variant="outline"
        >
          {isOpening ? "Abriendo…" : "Abrir herramientas de desarrollo"}
        </Button>
      </CardContent>
    </Card>
  );
}
