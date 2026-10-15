import { CommonModule } from '@angular/common';
import { Component, inject, OnInit } from '@angular/core';
import { RsvpService, type RsvpCapacity, type RsvpSubmission } from '../../services/rsvp.service';
import { DEFAULT_GUEST_LIMIT, formatInvites, inviteWeightForChild } from '../../data/invites';

@Component({
  selector: 'app-admin-rsvps',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './admin-rsvps.component.html',
  styleUrls: ['./admin-rsvps.component.scss']
})
export class AdminRsvpsComponent implements OnInit {
  private readonly rsvpService = inject(RsvpService);

  submissions: RsvpSubmission[] = [];
  capacity?: RsvpCapacity;
  isLoading = true;
  error = '';

  get adultTotal(): number {
    return this.submissions.reduce((total, item) => total + item.adultCount, 0);
  }

  get childTotal(): number {
    return this.submissions.reduce((total, item) => total + item.children.length, 0);
  }

  get limit(): number {
    return this.capacity?.limit ?? DEFAULT_GUEST_LIMIT;
  }

  get usedInvites(): number {
    return this.submissions.reduce((total, item) => total + this.invitesFor(item), 0);
  }

  get remainingInvites(): number {
    return Math.max(0, this.limit - this.usedInvites);
  }

  get usagePercent(): number {
    return Math.min(100, Math.round((this.usedInvites / this.limit) * 100));
  }

  get fullCount(): number {
    return this.countChildren((age) => age >= 13) + this.adultTotal;
  }

  get halfCount(): number {
    return this.countChildren((age) => age >= 7 && age <= 12);
  }

  get freeCount(): number {
    return this.countChildren((age) => age <= 6);
  }

  invitesFor(item: RsvpSubmission): number {
    return item.adultCount + item.children.reduce((total, child) => total + inviteWeightForChild(child.age), 0);
  }

  formatInvites(value: number): string {
    return formatInvites(value);
  }

  childNote(age: number): string {
    const weight = inviteWeightForChild(age);
    return weight === 1 ? '1 convite' : (weight === 0.5 ? 'meio convite' : 'isento');
  }

  private countChildren(match: (age: number) => boolean): number {
    return this.submissions.reduce((total, item) => total + item.children.filter((child) => match(child.age)).length, 0);
  }

  ngOnInit(): void {
    void this.load();
  }

  formatChildren(children: Array<{ name: string; age: number }>): string {
    return children.length
      ? children.map((child) => `${child.name || 'Nome não informado'} (${child.age} ${child.age === 1 ? 'ano' : 'anos'})`).join(', ')
      : 'Nenhuma';
  }

  formatDate(value: string): string {
    return new Date(value).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
  }

  exportCsv(): void {
    const header = ['Responsável', 'Telefone', 'Nomes dos adultos', 'Nomes e idades das crianças', 'Convites', 'Enviado em'];
    const rows = this.submissions.map((item) => [
      item.responsibleName,
      item.phone,
      item.adultNames.join(', '),
      this.formatChildren(item.children),
      formatInvites(this.invitesFor(item)),
      this.formatDate(item.createdAt)
    ]);
    const csv = [header, ...rows]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(';'))
      .join('\r\n');
    const url = URL.createObjectURL(new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'confirmacoes-presenca.csv';
    link.click();
    URL.revokeObjectURL(url);
  }

  async load(): Promise<void> {
    this.error = '';
    this.isLoading = true;
    try {
      this.submissions = await this.rsvpService.getSubmissions();
      this.capacity = await this.rsvpService.getCapacity().catch(() => undefined);
    } catch (error) {
      this.error = error instanceof Error ? error.message : 'Não foi possível carregar as confirmações.';
    } finally {
      this.isLoading = false;
    }
  }
}
