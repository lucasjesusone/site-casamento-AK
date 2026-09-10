import { Injectable } from '@angular/core';
import { weddingInvites, type WeddingInvite } from '../data/invites';

export interface RsvpSubmission {
  name: string;
  email: string;
  attending: 'sim' | 'nao';
  guests: number;
  message?: string;
}

interface StoredSubmission {
  token: string;
  name: string;
  email: string;
  attending: 'sim' | 'nao';
  guests: number;
  message: string;
  createdAt: string;
}

@Injectable({
  providedIn: 'root'
})
export class RsvpService {
  private readonly storageKey = 'sitecasamento-rsvp-submissions';

  getInvite(token: string): WeddingInvite | undefined {
    return weddingInvites.find((invite) => invite.token === token);
  }

  getRemainingSlots(token: string): number {
    const invite = this.getInvite(token);
    if (!invite) {
      return 0;
    }

    const usedSlots = invite.confirmedGuests + this.getStoredGuestCount(token);
    return Math.max(invite.maxGuests - usedSlots, 0);
  }

  validateInvitation(token: string): boolean {
    return !!this.getInvite(token);
  }

  submitResponse(token: string, payload: RsvpSubmission): { success: boolean; message: string; remainingSlots: number } {
    const invite = this.getInvite(token);
    if (!invite) {
      return {
        success: false,
        message: 'Esse link de convite não é válido.',
        remainingSlots: 0
      };
    }

    const stored = this.getStoredSubmissions(token);
    const usedSlots = invite.confirmedGuests + stored.reduce((sum, item) => sum + (item.attending === 'sim' ? item.guests : 0), 0);
    const remaining = Math.max(invite.maxGuests - usedSlots, 0);

    if (payload.attending === 'sim' && payload.guests > remaining) {
      return {
        success: false,
        message: `Esse convite ainda tem ${remaining} vaga(s) disponível(is) para sua família.`,
        remainingSlots: remaining
      };
    }

    const record: StoredSubmission = {
      token,
      name: payload.name.trim(),
      email: payload.email.trim(),
      attending: payload.attending,
      guests: payload.attending === 'sim' ? Math.max(payload.guests, 0) : 0,
      message: payload.message?.trim() ?? '',
      createdAt: new Date().toISOString()
    };

    const nextEntries = [...stored, record];
    this.persist(nextEntries);

    const finalRemaining = this.getRemainingSlots(token);
    return {
      success: true,
      message:
        payload.attending === 'sim'
          ? 'Sua confirmação foi registrada com sucesso. Estamos muito felizes em celebrar com vocês!'
          : 'Sua resposta foi registrada. Agradecemos muito pelo carinho e pela atenção.',
      remainingSlots: finalRemaining
    };
  }

  private getStoredSubmissions(token: string): StoredSubmission[] {
    if (typeof window === 'undefined') {
      return [];
    }

    try {
      const raw = window.localStorage.getItem(this.storageKey);
      if (!raw) {
        return [];
      }

      const parsed = JSON.parse(raw) as StoredSubmission[];
      return parsed.filter((entry) => entry.token === token);
    } catch {
      return [];
    }
  }

  private getStoredGuestCount(token: string): number {
    return this.getStoredSubmissions(token).reduce((sum, item) => sum + (item.attending === 'sim' ? item.guests : 0), 0);
  }

  private persist(entries: StoredSubmission[]): void {
    if (typeof window === 'undefined') {
      return;
    }

    window.localStorage.setItem(this.storageKey, JSON.stringify(entries));
  }
}
