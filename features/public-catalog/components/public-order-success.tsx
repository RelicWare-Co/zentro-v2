import { Alert, Button, Stack, Text, Title } from "@mantine/core";
import { CheckCircle2, Info } from "lucide-react";

interface PublicOrderSuccessProps {
  onNewOrder: () => void;
  orderNumber: number;
  organizationName: string;
}

export function PublicOrderSuccess({
  onNewOrder,
  orderNumber,
  organizationName,
}: PublicOrderSuccessProps) {
  return (
    <Stack align="center" gap="md" py="xl">
      <CheckCircle2 className="size-16 text-emerald-500" />
      <Title order={2} ta="center">
        ¡Pedido enviado!
      </Title>
      <Text size="lg" ta="center">
        Tu pedido <strong>#{orderNumber}</strong> ha sido recibido por{" "}
        <strong>{organizationName}</strong>.
      </Text>
      <Alert
        color="voltage"
        icon={<Info className="size-4" />}
        variant="light"
        w="100%"
      >
        Te contactaremos al teléfono proporcionado para confirmar el pedido y la
        entrega.
      </Alert>
      <Button onClick={onNewOrder} size="md" variant="light">
        Hacer otro pedido
      </Button>
    </Stack>
  );
}
