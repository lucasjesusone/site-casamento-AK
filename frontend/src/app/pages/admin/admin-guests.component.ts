import { CommonModule } from '@angular/common';
import { Component, EventEmitter, inject, OnInit, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  guestCategoryLabels,
  guestCategoryWeights,
  type Family,
  type Guest,
  type GuestCategory,
  type GuestStatus
} from '../../data/guest';
import { apiUrl } from '../../services/api-url';
import { GiftService } from '../../services/gift.service';

type Filter = 'all' | GuestStatus;

interface GuestDraft {
  id?: string;
  name: string;
  category: GuestCategory;
}

@Component({
  selector: 'app-admin-guests',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-guests.component.html',
  styleUrls: ['./admin-guests.component.scss']
})
export class AdminGuestsComponent implements OnInit {
  private readonly giftService = inject(GiftService);

  @Output() readonly unauthorized = new EventEmitter<void>();

  readonly categoryLabels = guestCategoryLabels;
  readonly categories = Object.keys(guestCategoryLabels) as GuestCategory[];
  readonly inviteLimit = 150;
  families: Family[] = [];
  filter: Filter = 'all';
  isLoading = false;
  isSaving = false;
  message = '';
  error = '';
  editingId = '';
  familyName = '';
  drafts: GuestDraft[] = [this.emptyDraft()];

  ngOnInit(): void {
    void this.load();
  }

  get allGuests(): Guest[] {
    return this.families.flatMap((family) => family.guests);
  }

  get totals() {
    const guests = this.allGuests;
    const count = (status: GuestStatus) => guests.filter((guest) => guest.status === status).length;
    const weight = (list: Guest[]) => list.reduce((sum, guest) => sum + guestCategoryWeights[guest.category], 0);
    const confirmed = guests.filter((guest) => guest.status === 'confirmed');
    return {
      families: this.families.length,
      guests: guests.length,
      confirmed: count('confirmed'),
      declined: count('declined'),
      pending: count('pending'),
      payingConfirmed: weight(confirmed),
      payingTotal: weight(guests.filter((guest) => guest.status !== 'declined'))
    };
  }

  get breakdown() {
    const guests = this.allGuests;
    return this.categories.map((category) => {
      const list = guests.filter((guest) => guest.category === category);
      const count = (status: GuestStatus) => list.filter((guest) => guest.status === status).length;
      return {
        label: this.categoryLabels[category],
        confirmed: count('confirmed'),
        pending: count('pending'),
        declined: count('declined'),
        total: list.length
      };
    });
  }

  get visibleFamilies(): Array<{ family: Family; guests: Guest[] }> {
    return this.families
      .map((family) => ({
        family,
        guests: this.filter === 'all' ? family.guests : family.guests.filter((guest) => guest.status === this.filter)
      }))
      .filter((item) => item.guests.length > 0 || (this.filter === 'all' && item.family.guests.length === 0));
  }

  statusLabel(status: GuestStatus): string {
    return { pending: 'Pendente', confirmed: 'Confirmado', declined: 'Não vai' }[status];
  }

  inviteLink(family: Family): string {
    return new URL(`rsvp/${family.code}`, document.baseURI).href;
  }

  async copyLink(family: Family): Promise<void> {
    try {
      await navigator.clipboard.writeText(this.inviteLink(family));
      this.flash(`Link de ${family.name} copiado.`);
    } catch {
      window.prompt('Copie o link do convite:', this.inviteLink(family));
    }
  }

  addDraft(): void {
    this.drafts = [...this.drafts, this.emptyDraft()];
  }

  removeDraft(index: number): void {
    this.drafts = this.drafts.filter((_, position) => position !== index);
    if (!this.drafts.length) {
      this.drafts = [this.emptyDraft()];
    }
  }

  edit(family: Family): void {
    this.editingId = family.id;
    this.familyName = family.name;
    this.drafts = family.guests.map((guest) => ({ id: guest.id, name: guest.name, category: guest.category }));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  resetForm(): void {
    this.editingId = '';
    this.familyName = '';
    this.drafts = [this.emptyDraft()];
  }

  async save(): Promise<void> {
    this.error = '';
    this.message = '';
    this.isSaving = true;
    try {
      const guests = this.drafts
        .map((draft) => ({ ...draft, name: draft.name.trim() }))
        .filter((draft) => draft.name);
      const saved = await this.giftService.request<Family>(apiUrl('/api/admin/families'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...(this.editingId ? { id: this.editingId } : {}), name: this.familyName, guests })
      });
      this.families = this.upsert(saved);
      this.flash(this.editingId ? 'Família atualizada.' : 'Família adicionada. Use "Copiar link" para enviar o convite.');
      this.resetForm();
    } catch (error) {
      this.fail(error);
    } finally {
      this.isSaving = false;
    }
  }

  async regenerate(family: Family): Promise<void> {
    if (!window.confirm(`Gerar um novo link para ${family.name}? O link antigo deixará de funcionar.`)) {
      return;
    }
    try {
      const updated = await this.giftService.request<Family>(
        apiUrl(`/api/admin/families/${encodeURIComponent(family.id)}/regenerate-link`),
        { method: 'POST' }
      );
      this.families = this.upsert(updated);
      this.flash('Novo link gerado.');
    } catch (error) {
      this.fail(error);
    }
  }

  async remove(family: Family): Promise<void> {
    if (!window.confirm(`Remover a família "${family.name}" e seus integrantes?`)) {
      return;
    }
    try {
      await this.giftService.request<void>(apiUrl(`/api/admin/families/${encodeURIComponent(family.id)}`), { method: 'DELETE' });
      this.families = this.families.filter((item) => item.id !== family.id);
      if (this.editingId === family.id) {
        this.resetForm();
      }
    } catch (error) {
      this.fail(error);
    }
  }

  exportCsv(): void {
    const header = ['Família', 'Convidado', 'Categoria', 'Status', 'Respondido em'];
    const rows = this.families.flatMap((family) =>
      family.guests.map((guest) => [
        family.name,
        guest.name,
        guestCategoryLabels[guest.category],
        this.statusLabel(guest.status),
        guest.respondedAt ? new Date(guest.respondedAt).toLocaleString('pt-BR') : ''
      ])
    );
    const csv = [header, ...rows]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(';'))
      .join('\r\n');
    const url = URL.createObjectURL(new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'convidados.csv';
    link.click();
    URL.revokeObjectURL(url);
  }

  private async load(): Promise<void> {
    this.isLoading = true;
    try {
      this.families = await this.giftService.request<Family[]>(apiUrl('/api/admin/families'));
    } catch (error) {
      this.fail(error);
    } finally {
      this.isLoading = false;
    }
  }

  private upsert(family: Family): Family[] {
    const exists = this.families.some((item) => item.id === family.id);
    const next = exists ? this.families.map((item) => (item.id === family.id ? family : item)) : [...this.families, family];
    return next.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  }

  private emptyDraft(): GuestDraft {
    return { name: '', category: 'adult' };
  }

  private flash(message: string): void {
    this.message = message;
    this.error = '';
  }

  private fail(error: unknown): void {
    this.error = error instanceof Error ? error.message : 'Não foi possível concluir a operação.';
    if (!this.giftService.isLoggedIn()) {
      this.unauthorized.emit();
    }
  }
}
