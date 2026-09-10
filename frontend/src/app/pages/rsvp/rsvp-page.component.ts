import { CommonModule } from '@angular/common';
import { Component, inject, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { type WeddingInvite } from '../../data/invites';
import { RsvpService, type RsvpSubmission } from '../../services/rsvp.service';

@Component({
  selector: 'app-rsvp-page',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './rsvp-page.component.html',
  styleUrls: ['./rsvp-page.component.scss']
})
export class RsvpPageComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  readonly rsvpService = inject(RsvpService);

  invite: WeddingInvite | null = null;
  form: RsvpSubmission = {
    name: '',
    email: '',
    attending: 'sim',
    guests: 1,
    message: ''
  };
  isSubmitted = false;
  errorMessage = '';
  successMessage = '';
  isSubmitting = false;

  ngOnInit(): void {
    const token = this.route.snapshot.paramMap.get('token') ?? 'familia-demo';
    const invite = this.rsvpService.getInvite(token);

    if (!invite) {
      this.invite = null;
      return;
    }

    this.invite = invite;
    this.form.name = invite.guestName;
    this.form.email = invite.email;
    this.form.guests = Math.min(1, this.rsvpService.getRemainingSlots(invite.token) || 1);
  }

  submit(): void {
    if (!this.invite) {
      this.errorMessage = 'Este convite não está mais disponível.';
      return;
    }

    this.isSubmitting = true;
    this.errorMessage = '';
    this.successMessage = '';

    const result = this.rsvpService.submitResponse(this.invite.token, this.form);
    this.isSubmitting = false;

    if (!result.success) {
      this.errorMessage = result.message;
      return;
    }

    this.isSubmitted = true;
    this.successMessage = result.message;
  }
}
