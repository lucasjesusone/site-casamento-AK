export type GuestCategory = 'adult' | 'child_half' | 'child_free';
export type GuestStatus = 'pending' | 'confirmed' | 'declined';

export interface Guest {
  id: string;
  name: string;
  category: GuestCategory;
  status: GuestStatus;
  respondedAt: string | null;
}

export interface Family {
  id: string;
  name: string;
  code: string;
  createdAt: string;
  guests: Guest[];
}

export const guestCategoryLabels: Record<GuestCategory, string> = {
  adult: 'Adulto',
  child_half: 'Criança de 7 a 12 anos (meia)',
  child_free: 'Criança até 6 anos (isenta)'
};

export const guestCategoryWeights: Record<GuestCategory, number> = {
  adult: 1,
  child_half: 0.5,
  child_free: 0
};
