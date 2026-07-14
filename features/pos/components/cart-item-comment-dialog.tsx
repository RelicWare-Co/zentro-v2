import { Button, Group, Modal, Stack, Text, Textarea } from "@mantine/core";
import { useEffect, useState } from "react";
import type { CartItem } from "@/features/pos/types";

interface CartItemCommentDialogProps {
  item: CartItem | null;
  onClose: () => void;
  onSave: (cartItemId: string, notes: string | null) => Promise<void>;
}

export function CartItemCommentDialog({
  item,
  onClose,
  onSave,
}: CartItemCommentDialogProps) {
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setNotes(item?.notes ?? "");
    setError(null);
  }, [item]);

  const handleClose = () => {
    if (!isSaving) {
      onClose();
    }
  };

  const handleSave = async () => {
    if (!item) {
      return;
    }

    setError(null);
    setIsSaving(true);
    try {
      await onSave(item.id, notes.trim() || null);
      onClose();
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "No se pudo guardar el comentario."
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal
      centered
      onClose={handleClose}
      opened={Boolean(item)}
      title={`Comentario para ${item?.product.name ?? "el producto"}`}
    >
      <Stack gap="md">
        <Text c="dimmed" size="sm">
          Esta indicación se mostrará al equipo de cocina en la comanda.
        </Text>
        <Textarea
          autosize
          data-autofocus
          disabled={isSaving}
          error={error}
          label="Comentario para cocina"
          minRows={3}
          onChange={(event) => setNotes(event.currentTarget.value)}
          placeholder="Ej. Sin cebolla"
          value={notes}
        />
        <Group justify="flex-end">
          <Button
            disabled={isSaving}
            onClick={handleClose}
            type="button"
            variant="default"
          >
            Cancelar
          </Button>
          <Button loading={isSaving} onClick={handleSave} type="button">
            Guardar comentario
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
