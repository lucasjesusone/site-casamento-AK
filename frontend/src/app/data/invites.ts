export const DEFAULT_GUEST_LIMIT = 180;

// Adulto e jovem a partir de 13 anos = 1 convite; 7 a 12 anos = meio convite; até 6 anos = isento.
export function inviteWeightForChild(age: number): number {
  if (age >= 13) {
    return 1;
  }
  return age >= 7 ? 0.5 : 0;
}

export function formatInvites(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1).replace('.', ',');
}
