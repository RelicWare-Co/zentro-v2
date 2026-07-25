import { Button, Group, Modal, Stack, Text, Textarea } from "@mantine/core";
import { useEffect, useState } from "react";

const MAX_ORDER_NOTE_LENGTH = 500;

interface CartOrderNoteDialogProps {
  notes: string | null;
  onClose: () => void;
  onSave: (notes: string | null) => Promise<void>;
  opened: boolean;
  orderId: string | null;
}

export function CartOrderNoteDialog({
  notes: savedNotes,
  onClose,
  onSave,
  opened,
  orderId,
}: CartOrderNoteDialogProps) {
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!opened) {
      return;
    }
    setNotes(savedNotes ?? "");
    setError(null);
  }, [opened, savedNotes]);

  const handleClose = () => {
    if (!isSaving) {
      onClose();
    }
  };

  const handleSave = async () => {
    if (!orderId) {
      return;
    }

    setError(null);
    setIsSaving(true);
    try {
      await onSave(notes.trim() || null);
      onClose();
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "No se pudo guardar la nota de la orden."
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal
      centered
      onClose={handleClose}
      opened={opened && Boolean(orderId)}
      title="Nota de la orden"
    >
      <Stack gap="md">
        <Text c="dimmed" size="sm">
          Guarda indicaciones generales, datos de entrega o la dirección del
          cliente. La nota quedará asociada a esta orden.
        </Text>
        <Textarea
          autosize
          bottomSection={
            <Text c="dimmed" size="xs">
              {notes.length}/{MAX_ORDER_NOTE_LENGTH}
            </Text>
          }
          data-autofocus
          disabled={isSaving}
          error={error}
          label="Nota general o dirección"
          maxLength={MAX_ORDER_NOTE_LENGTH}
          maxRows={6}
          minRows={3}
          onChange={(event) => setNotes(event.currentTarget.value)}
          placeholder="Ej. Entregar en Calle 10 #20-30, casa azul"
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
            Guardar nota
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
