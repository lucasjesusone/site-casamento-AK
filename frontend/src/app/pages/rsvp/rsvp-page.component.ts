import { MonogramLoaderComponent } from '../../components/monogram-loader.component';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { Component, inject, OnInit, PLATFORM_ID } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { guestCategoryLabels, type Guest } from '../../data/guest';
import { RsvpError, RsvpService } from '../../services/rsvp.service';

type Choice = 'confirmed' | 'declined' | 'pending';

@Component({
  selector: 'app-rsvp-form',
  standalone: true,
  imports: [MonogramLoaderComponent, CommonModule],
  templateUrl: './rsvp-page.component.html',
  styleUrls: ['./rsvp-page.component.scss']
})
export class RsvpFormComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly rsvpService = inject(RsvpService);
  private readonly platformId = inject(PLATFORM_ID);
  code = '';

  readonly categoryLabels = guestCategoryLabels;
  familyName = '';
  guests: Guest[] = [];
  choices: Record<string, Choice> = {};
  isLoading = true;
  isNotFound = false;
  isSubmitting = false;
  successMessage = '';
  errorMessage = '';
  searchResults: Array<{ code: string; familyName: string }> = [];
  searchDone = false;
  isSearching = false;
  searchError = '';

  ngOnInit(): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    this.code = (this.route.snapshot.queryParamMap.get('c') ?? '').trim();
    if (this.code) {
      void this.load();
    }
  }

  async search(term: string): Promise<void> {
    this.searchError = '';
    this.searchDone = false;
    this.isSearching = true;
    try {
      this.searchResults = await this.rsvpService.search(term);
      this.searchDone = true;
    } catch (error) {
      this.searchResults = [];
      this.searchError = error instanceof Error ? error.message : 'Não foi possível buscar.';
    } finally {
      this.isSearching = false;
    }
  }

  async select(code: string): Promise<void> {
    this.code = code;
    this.isNotFound = false;
    this.errorMessage = '';
    this.isLoading = true;
    await this.load(false);
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
      this.successMessage = 'Respostas salvas! Se precisar alterar, é só procurar seu nome aqui de novo.';
    } catch (error) {
      this.errorMessage = error instanceof Error ? error.message : 'Não foi possível salvar.';
    } finally {
      this.isSubmitting = false;
    }
  }

  private async load(scroll = true): Promise<void> {
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
      if (scroll) {
        setTimeout(() => document.getElementById('rsvp')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
      }
    }
  }

  private apply(familyName: string, guests: Guest[]): void {
    this.familyName = familyName;
    this.guests = guests;
    this.choices = Object.fromEntries(guests.map((guest) => [guest.id, guest.status as Choice]));
  }
}
