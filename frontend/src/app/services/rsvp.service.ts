import { Injectable } from '@angular/core';
import { type Guest } from '../data/guest';
import { apiUrl } from './api-url';

export interface RsvpInvite {
  familyName: string;
  guests: Guest[];
}

export class RsvpError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

@Injectable({ providedIn: 'root' })
export class RsvpService {
  getInvite(code: string): Promise<RsvpInvite> {
    return this.send(`/api/rsvp/${encodeURIComponent(code)}`);
  }

  submit(code: string, responses: Array<{ guestId: string; status: 'confirmed' | 'declined' }>): Promise<RsvpInvite> {
    return this.send(`/api/rsvp/${encodeURIComponent(code)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ responses })
    });
  }

  private async send(path: string, init?: RequestInit): Promise<RsvpInvite> {
    let response: Response;
    try {
      response = await fetch(apiUrl(path), init);
    } catch {
      throw new RsvpError('Não foi possível conectar. Tente novamente em instantes.', 0);
    }
    const result = (await response.json().catch(() => ({}))) as RsvpInvite & { error?: string };
    if (!response.ok) {
      throw new RsvpError(result.error || 'Não foi possível concluir a operação.', response.status);
    }
    return result;
  }
}
