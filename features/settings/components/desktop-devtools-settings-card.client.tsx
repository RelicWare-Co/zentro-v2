"use client";

import { Button } from "@mantine/core";
import { Code2 } from "lucide-react";
import { useState } from "react";
import { SettingsCard } from "@/features/settings/components/settings-ui-primitives";
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
    <SettingsCard
      description="Herramientas de depuración para la ventana de Zentro Desktop."
      icon={Code2}
      title="App de escritorio"
    >
      <Button
        color="gray"
        loading={isOpening}
        onClick={handleOpenDevTools}
        type="button"
        variant="outline"
      >
        Abrir herramientas de desarrollo
      </Button>
    </SettingsCard>
  );
}
