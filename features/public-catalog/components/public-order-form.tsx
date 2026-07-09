import {
  Alert,
  Anchor,
  Button,
  SegmentedControl,
  Stack,
  Text,
  Textarea,
  TextInput,
} from "@mantine/core";
import { MapPin, Phone } from "lucide-react";
import { useState } from "react";
import type { PublicCatalogItem } from "@/features/orders/orders.schema";
import { formatCurrency } from "@/lib/format-currency.shared";

interface CartLine {
  product: PublicCatalogItem;
  quantity: number;
}

interface PublicOrderFormProps {
  cartLines: CartLine[];
  cartTotal: number;
  isSubmitting: boolean;
  onSubmit: (data: {
    fulfillment: "takeaway" | "delivery";
    contactName: string;
    contactPhone: string;
    deliveryAddress: string;
    deliveryNotes: string;
    notes: string;
  }) => void;
  slug: string;
  submitError: string | null;
}

export function PublicOrderForm({
  cartLines,
  cartTotal,
  isSubmitting,
  onSubmit,
  slug,
  submitError,
}: PublicOrderFormProps) {
  const [fulfillment, setFulfillment] = useState<"takeaway" | "delivery">(
    "takeaway"
  );
  const [contactName, setContactName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [deliveryNotes, setDeliveryNotes] = useState("");
  const [notes, setNotes] = useState("");

  const canSubmit =
    cartLines.length > 0 &&
    contactName.trim().length > 0 &&
    contactPhone.trim().length > 0 &&
    (fulfillment === "takeaway" || deliveryAddress.trim().length > 0) &&
    !isSubmitting;

  return (
    <Stack gap="md">
      <SegmentedControl<"takeaway" | "delivery">
        color="voltage.5"
        data={[
          { label: "Para llevar", value: "takeaway" },
          { label: "A domicilio", value: "delivery" },
        ]}
        fullWidth
        onChange={setFulfillment}
        radius="md"
        value={fulfillment}
      />

      <TextInput
        label="Nombre"
        onChange={(e) => setContactName(e.target.value)}
        placeholder="Tu nombre"
        radius="md"
        required
        value={contactName}
      />
      <TextInput
        label="Teléfono"
        leftSection={<Phone className="size-4" />}
        onChange={(e) => setContactPhone(e.target.value)}
        placeholder="300 000 0000"
        radius="md"
        required
        value={contactPhone}
      />

      {fulfillment === "delivery" ? (
        <>
          <Textarea
            label="Dirección de entrega"
            leftSection={<MapPin className="size-4" />}
            minRows={2}
            onChange={(e) => setDeliveryAddress(e.target.value)}
            placeholder="Calle 123 #45-67, Apto 301"
            radius="md"
            required
            value={deliveryAddress}
          />
          <Textarea
            label="Notas del domicilio"
            minRows={1}
            onChange={(e) => setDeliveryNotes(e.target.value)}
            placeholder="Tocar timbre 2B, dejar en portería…"
            radius="md"
            value={deliveryNotes}
          />
        </>
      ) : null}

      <Textarea
        label="Notas del pedido"
        minRows={1}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Sin cebolla, extra salsa…"
        radius="md"
        value={notes}
      />

      {submitError ? (
        <Alert color="red" variant="light">
          {submitError}
        </Alert>
      ) : null}

      <Button
        color="voltage.5"
        disabled={!canSubmit}
        fullWidth
        loading={isSubmitting}
        onClick={() =>
          onSubmit({
            fulfillment,
            contactName,
            contactPhone,
            deliveryAddress,
            deliveryNotes,
            notes,
          })
        }
        radius="md"
        size="lg"
      >
        {isSubmitting
          ? "Enviando pedido…"
          : `Enviar pedido — ${formatCurrency(cartTotal)}`}
      </Button>

      <Text c="zinc.5" size="xs" ta="center">
        El pago se realiza al recibir el pedido. El negocio confirmará tu pedido
        al teléfono indicado.
      </Text>

      <Anchor href={`/o/${slug}`} size="xs" ta="center">
        Volver al catálogo
      </Anchor>
    </Stack>
  );
}
