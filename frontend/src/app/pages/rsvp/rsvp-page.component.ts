import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RsvpService } from '../../services/rsvp.service';

@Component({
  selector: 'app-rsvp-form',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './rsvp-page.component.html',
  styleUrls: ['./rsvp-page.component.scss']
})
export class RsvpFormComponent {
  private readonly rsvpService = inject(RsvpService);
  private nextPersonId = 0;

  responsibleName = '';
  phone = '';
  accompanyingAdults: Array<{ id: number; name: string }> = [];
  children: Array<{ id: number; name: string; age: number | null }> = [];
  isSubmitting = false;
  successMessage = false;
  errorMessage = '';

  addAdult(): void {
    if (this.accompanyingAdults.length < 29) {
      this.accompanyingAdults = [...this.accompanyingAdults, { id: this.nextPersonId++, name: '' }];
    }
  }

  removeAdult(index: number): void {
    this.accompanyingAdults = this.accompanyingAdults.filter((_, position) => position !== index);
  }

  addChild(): void {
    if (this.children.length < 30) {
      this.children = [...this.children, { id: this.nextPersonId++, name: '', age: null }];
    }
  }

  removeChild(index: number): void {
    this.children = this.children.filter((_, position) => position !== index);
  }

  async submit(): Promise<void> {
    this.errorMessage = '';
    this.isSubmitting = true;
    try {
      await this.rsvpService.submitOpen({
        responsibleName: this.responsibleName,
        phone: this.phone,
        accompanyingAdults: this.accompanyingAdults.map((adult) => adult.name),
        children: this.children.map((child) => ({ name: child.name, age: Number(child.age) }))
      });
      this.successMessage = true;
    } catch (error) {
      this.errorMessage = error instanceof Error ? error.message : 'Não foi possível salvar a confirmação.';
    } finally {
      this.isSubmitting = false;
    }
  }

  reset(): void {
    this.responsibleName = '';
    this.phone = '';
    this.accompanyingAdults = [];
    this.children = [];
    this.successMessage = false;
    this.errorMessage = '';
    this.nextPersonId = 0;
  }
}
