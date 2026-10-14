import { CommonModule } from '@angular/common';
import { Component, inject, OnInit } from '@angular/core';
import { RsvpService, type RsvpSubmission } from '../../services/rsvp.service';

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
  isLoading = true;
  error = '';

  get adultTotal(): number {
    return this.submissions.reduce((total, item) => total + item.adultCount, 0);
  }

  get childTotal(): number {
    return this.submissions.reduce((total, item) => total + item.childAges.length, 0);
  }

  ngOnInit(): void {
    void this.load();
  }

  formatChildren(ages: number[]): string {
    return ages.length ? ages.map((age) => `${age} ${age === 1 ? 'ano' : 'anos'}`).join(', ') : 'Nenhuma';
  }

  formatDate(value: string): string {
    return new Date(value).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
  }

  exportCsv(): void {
    const header = ['Responsável', 'Telefone', 'Adultos', 'Idades das crianças', 'Enviado em'];
    const rows = this.submissions.map((item) => [
      item.responsibleName,
      item.phone,
      item.adultCount,
      this.formatChildren(item.childAges),
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
    } catch (error) {
      this.error = error instanceof Error ? error.message : 'Não foi possível carregar as confirmações.';
    } finally {
      this.isLoading = false;
    }
  }
}
