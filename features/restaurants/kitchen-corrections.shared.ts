export interface KitchenCorrectionModifier {
  name: string;
  quantity: number;
}

function formatComment(value: string | null | undefined) {
  return value?.trim() || "Sin comentario";
}

function formatModifiers(modifiers: KitchenCorrectionModifier[]) {
  if (modifiers.length === 0) {
    return "Sin modificadores";
  }
  return modifiers
    .map((modifier) => `+ ${modifier.quantity} × ${modifier.name}`)
    .join(", ");
}

function haveSameModifiers(
  previousModifiers: KitchenCorrectionModifier[],
  modifiers: KitchenCorrectionModifier[]
) {
  if (previousModifiers.length !== modifiers.length) {
    return false;
  }

  return previousModifiers.every((modifier, index) => {
    const nextModifier = modifiers[index];
    return (
      nextModifier?.name === modifier.name &&
      nextModifier.quantity === modifier.quantity
    );
  });
}

export function getKitchenModificationDetails(input: {
  modifiers: KitchenCorrectionModifier[];
  notes: string | null | undefined;
  previousModifiers: KitchenCorrectionModifier[];
  previousNotes: string | null | undefined;
  previousQuantity: number | null | undefined;
  quantity: number;
}) {
  const details: string[] = [];

  if (
    input.previousQuantity !== null &&
    input.previousQuantity !== undefined &&
    input.previousQuantity !== input.quantity
  ) {
    const direction =
      input.quantity < input.previousQuantity ? "reducida" : "aumentada";
    details.push(
      `Cantidad ${direction}: ${input.previousQuantity} → ${input.quantity}`
    );
  }

  if (input.previousNotes !== input.notes) {
    details.push(
      `Comentario: ${formatComment(input.previousNotes)} → ${formatComment(input.notes)}`
    );
  }

  if (!haveSameModifiers(input.previousModifiers, input.modifiers)) {
    details.push(
      `Modificadores: ${formatModifiers(input.previousModifiers)} → ${formatModifiers(input.modifiers)}`
    );
  }

  return details;
}
