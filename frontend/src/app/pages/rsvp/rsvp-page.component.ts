import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormsModule, type NgForm } from '@angular/forms';
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

  formatPhone(value: string): string {
    let digits = value.replace(/\D/g, '');
    const hasCountryCode = digits.startsWith('55') && (digits.length === 12 || digits.length === 13);
    if (hasCountryCode) {
      digits = digits.slice(2);
    } else {
      digits = digits.slice(0, 11);
    }

    const areaCode = digits.slice(0, 2);
    const number = digits.slice(2);
    let formatted = areaCode ? `(${areaCode}` : '';
    if (areaCode.length === 2) {
      formatted += ')';
    }
    if (number.length) {
      formatted += ` ${number.length > 8 ? number.slice(0, 5) : number.slice(0, 4)}`;
      if (number.length > (number.length > 8 ? 5 : 4)) {
        formatted += `-${number.slice(number.length > 8 ? 5 : 4)}`;
      }
    }
    return `${hasCountryCode ? '+55 ' : ''}${formatted}`;
  }

  isValidPhone(value: string): boolean {
    const digits = value.replace(/\D/g, '');
    const localDigits = digits.startsWith('55') && (digits.length === 12 || digits.length === 13)
      ? digits.slice(2)
      : digits;
    return localDigits.length === 10 || localDigits.length === 11;
  }

  hasFullName(value: string): boolean {
    return value.trim().split(/\s+/).filter(Boolean).length >= 2;
  }

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

  async submit(form: NgForm): Promise<void> {
    this.errorMessage = '';
    form.control.markAllAsTouched();
    const isValid = form.valid &&
      this.hasFullName(this.responsibleName) &&
      this.accompanyingAdults.every((adult) => this.hasFullName(adult.name)) &&
      this.children.every((child) => this.hasFullName(child.name) && child.age !== null && child.age >= 0 && child.age <= 17) &&
      this.isValidPhone(this.phone);
    if (!isValid) {
      return;
    }

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
