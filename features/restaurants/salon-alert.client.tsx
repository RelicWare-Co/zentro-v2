import { Button } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { useEffect, useRef } from "react";
import { navigate } from "vike/client/router";
import type { RestaurantKitchenTicketRow } from "@/features/restaurants/restaurants.shared";

const SALON_ALERT_STORAGE_KEY = "zentro:salon-alert-status:v1";

function getStorageKey(organizationId: string | null) {
  return organizationId
    ? `${SALON_ALERT_STORAGE_KEY}:${organizationId}`
    : SALON_ALERT_STORAGE_KEY;
}

type SalonAlertStatusMap = Record<string, string>;

function readSalonAlertStatuses(
  organizationId: string | null
): SalonAlertStatusMap {
  if (typeof window === "undefined") {
    return {};
  }

  try {
    const rawValue = window.localStorage.getItem(getStorageKey(organizationId));
    if (!rawValue) {
      return {};
    }

    const parsedValue = JSON.parse(rawValue) as unknown;
    if (
      !parsedValue ||
      typeof parsedValue !== "object" ||
      Array.isArray(parsedValue)
    ) {
      return {};
    }

    const statuses: SalonAlertStatusMap = {};
    for (const [key, value] of Object.entries(parsedValue)) {
      if (typeof value === "string") {
        statuses[key] = value;
      }
    }
    return statuses;
  } catch {
    return {};
  }
}

function writeSalonAlertStatuses(
  organizationId: string | null,
  statuses: SalonAlertStatusMap
) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(
      getStorageKey(organizationId),
      JSON.stringify(statuses)
    );
  } catch {
    /* Ignore write errors from private mode or storage quota */
  }
}

let audioContext: AudioContext | null = null;

/**
 * Campana de dos tonos sintetizada con WebAudio (sin assets). Best-effort:
 * si el navegador bloquea el AudioContext hasta la primera interacción, no
 * falla ni interrumpe la operación.
 */
export async function playSalonAlertBell() {
  if (typeof window === "undefined" || !window.AudioContext) {
    return;
  }

  try {
    audioContext ??= new window.AudioContext();
    if (audioContext.state === "suspended") {
      await audioContext.resume();
    }

    const startAt = audioContext.currentTime;
    const tones: [number, number][] = [
      [0, 880],
      [0.18, 1174.66],
    ];
    for (const [offset, frequency] of tones) {
      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();
      oscillator.type = "sine";
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0.0001, startAt + offset);
      gain.gain.exponentialRampToValueAtTime(0.22, startAt + offset + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, startAt + offset + 0.16);
      oscillator.connect(gain);
      gain.connect(audioContext.destination);
      oscillator.start(startAt + offset);
      oscillator.stop(startAt + offset + 0.2);
    }
  } catch {
    /* Best-effort alert */
  }
}

function notifyNewSalonOrder(ticket: RestaurantKitchenTicketRow) {
  const tableName = ticket.order?.table?.name ?? "Mesa";
  const areaName = ticket.order?.table?.area?.name ?? "";

  notifications.show({
    autoClose: 8000,
    color: "voltage",
    message: (
      <div className="space-y-2">
        <div>
          {areaName ? `${areaName} · ` : ""}
          {tableName} — comanda #{ticket.order?.orderNumber ?? ""}
        </div>
        <Button
          color="voltage"
          onClick={() => {
            navigate("/pedidos").catch(() => undefined);
          }}
          size="compact-sm"
          variant="light"
        >
          Ver pedidos
        </Button>
      </div>
    ),
    title: "Nuevo pedido del salón",
  });
}

/**
 * Alerta sonora + notificación para pedidos del salón nuevos.
 *
 * - Gate: solo máquinas con turno abierto (la caja); no depende de impresora.
 * - Anti-spam: el estado visto se persiste en localStorage por org y se poda
 *   al conjunto actual de tickets, así un requeue (`failed → pending`) vuelve
 *   a alertar. Al cargar con backlog suena una sola vez (un sonido por lote).
 */
export function useSalonAlert(params: {
  activeOrganizationId: string | null;
  enabled: boolean;
  tickets: RestaurantKitchenTicketRow[];
}) {
  const { activeOrganizationId, enabled, tickets } = params;
  const statusesRef = useRef<SalonAlertStatusMap>({});
  const initializedRef = useRef<string | null>(null);

  useEffect(() => {
    statusesRef.current = readSalonAlertStatuses(activeOrganizationId);
    initializedRef.current = activeOrganizationId;
  }, [activeOrganizationId]);

  useEffect(() => {
    if (
      !(enabled && initializedRef.current === activeOrganizationId) ||
      typeof window === "undefined"
    ) {
      return;
    }

    const previousStatuses = statusesRef.current;
    const nextStatuses: SalonAlertStatusMap = {};
    const newPendingTickets: RestaurantKitchenTicketRow[] = [];

    for (const ticket of tickets) {
      if (
        ticket.printStatus === "pending" &&
        previousStatuses[ticket.id] !== "pending"
      ) {
        newPendingTickets.push(ticket);
      }
      nextStatuses[ticket.id] = ticket.printStatus ?? "unknown";
    }

    statusesRef.current = nextStatuses;
    writeSalonAlertStatuses(activeOrganizationId, nextStatuses);

    if (newPendingTickets.length === 0) {
      return;
    }

    playSalonAlertBell().catch(() => undefined);
    for (const ticket of newPendingTickets.slice(0, 3)) {
      notifyNewSalonOrder(ticket);
    }
  }, [activeOrganizationId, enabled, tickets]);
}
