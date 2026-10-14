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

  responsibleName = '';
  phone = '';
  adultCount = 1;
  childAges: Array<{ id: number; age: number | null }> = [];
  isSubmitting = false;
  successMessage = false;
  errorMessage = '';
  private nextChildId = 0;

  addChild(): void {
    if (this.childAges.length < 30) {
      this.childAges = [...this.childAges, { id: this.nextChildId++, age: null }];
    }
  }

  removeChild(index: number): void {
    this.childAges = this.childAges.filter((_, position) => position !== index);
  }

  async submit(): Promise<void> {
    this.errorMessage = '';
    this.isSubmitting = true;
    try {
      await this.rsvpService.submitOpen({
        responsibleName: this.responsibleName,
        phone: this.phone,
        adultCount: Number(this.adultCount),
        childAges: this.childAges.map((child) => Number(child.age))
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
    this.adultCount = 1;
    this.childAges = [];
    this.successMessage = false;
    this.errorMessage = '';
  }
}
