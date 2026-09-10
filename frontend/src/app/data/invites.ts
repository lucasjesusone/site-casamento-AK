export interface WeddingInvite {
  token: string;
  familyName: string;
  guestName: string;
  email: string;
  maxGuests: number;
  confirmedGuests: number;
  status: 'pending' | 'confirmed' | 'declined';
}

export const weddingInvites: WeddingInvite[] = [
  {
    token: 'familia-demo',
    familyName: 'Família Demo',
    guestName: 'Família Demo',
    email: 'familia-demo@email.com',
    maxGuests: 4,
    confirmedGuests: 2,
    status: 'pending'
  },
  {
    token: 'familia-santos',
    familyName: 'Família Santos',
    guestName: 'Família Santos',
    email: 'familia.santos@email.com',
    maxGuests: 4,
    confirmedGuests: 1,
    status: 'pending'
  },
  {
    token: 'familia-costa',
    familyName: 'Família Costa',
    guestName: 'Família Costa',
    email: 'familia.costa@email.com',
    maxGuests: 3,
    confirmedGuests: 0,
    status: 'pending'
  }
];
