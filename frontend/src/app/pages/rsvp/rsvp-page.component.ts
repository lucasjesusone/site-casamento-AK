import { CommonModule, isPlatformBrowser } from '@angular/common';
import { Component, inject, OnInit, PLATFORM_ID } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { guestCategoryLabels, type Guest } from '../../data/guest';
import { RsvpError, RsvpService } from '../../services/rsvp.service';

type Choice = 'confirmed' | 'declined' | 'pending';

@Component({
  selector: 'app-rsvp-page',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './rsvp-page.component.html',
  styleUrls: ['./rsvp-page.component.scss']
})
export class RsvpPageComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly rsvpService = inject(RsvpService);
  private readonly platformId = inject(PLATFORM_ID);
  private code = '';

  readonly categoryLabels = guestCategoryLabels;
  familyName = '';
  guests: Guest[] = [];
  choices: Record<string, Choice> = {};
  isLoading = true;
  isNotFound = false;
  isSubmitting = false;
  successMessage = '';
  errorMessage = '';

  ngOnInit(): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    this.code = this.route.snapshot.paramMap.get('token') ?? '';
    void this.load();
  }

  get canSubmit(): boolean {
    return this.guests.length > 0 && this.guests.every((guest) => this.choices[guest.id] !== 'pending');
  }

  choose(guest: Guest, choice: 'confirmed' | 'declined'): void {
    this.choices = { ...this.choices, [guest.id]: choice };
    this.successMessage = '';
  }

  async submit(): Promise<void> {
    this.errorMessage = '';
    this.successMessage = '';
    this.isSubmitting = true;
    try {
      const invite = await this.rsvpService.submit(
        this.code,
        this.guests.map((guest) => ({ guestId: guest.id, status: this.choices[guest.id] as 'confirmed' | 'declined' }))
      );
      this.apply(invite.familyName, invite.guests);
      this.successMessage = 'Respostas salvas! Você pode voltar a este link para alterar, se precisar.';
    } catch (error) {
      this.errorMessage = error instanceof Error ? error.message : 'Não foi possível salvar.';
    } finally {
      this.isSubmitting = false;
    }
  }

  private async load(): Promise<void> {
    try {
      const invite = await this.rsvpService.getInvite(this.code);
      this.apply(invite.familyName, invite.guests);
    } catch (error) {
      if (error instanceof RsvpError && error.status === 404) {
        this.isNotFound = true;
      } else {
        this.errorMessage = error instanceof Error ? error.message : 'Não foi possível carregar o convite.';
      }
    } finally {
      this.isLoading = false;
    }
  }

  private apply(familyName: string, guests: Guest[]): void {
    this.familyName = familyName;
    this.guests = guests;
    this.choices = Object.fromEntries(guests.map((guest) => [guest.id, guest.status as Choice]));
  }
}
