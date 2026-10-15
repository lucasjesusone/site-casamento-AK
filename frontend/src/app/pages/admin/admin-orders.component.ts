import { CommonModule } from '@angular/common';
import { Component, inject, OnInit } from '@angular/core';
import { GiftService, type GiftOrder } from '../../services/gift.service';

type StatusTone = 'paid' | 'waiting' | 'failed';

@Component({
  selector: 'app-admin-orders',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './admin-orders.component.html',
  styleUrls: ['./admin-orders.component.scss']
})
export class AdminOrdersComponent implements OnInit {
  private readonly giftService = inject(GiftService);

  orders: GiftOrder[] = [];
  isLoading = true;
  error = '';

  get paidOrders(): GiftOrder[] {
    return this.orders.filter((order) => order.status === 'approved');
  }

  get paidTotal(): number {
    return this.paidOrders.reduce((total, order) => total + order.total, 0);
  }

  get messageCount(): number {
    return this.paidOrders.filter((order) => order.message).length;
  }

  get waitingCount(): number {
    return this.orders.filter((order) => this.tone(order.status) === 'waiting').length;
  }

  ngOnInit(): void {
    void this.load();
  }

  tone(status: string): StatusTone {
    if (status === 'approved') {
      return 'paid';
    }
    return ['pending', 'in_process', 'authorized'].includes(status) ? 'waiting' : 'failed';
  }

  statusLabel(status: string): string {
    const labels: Record<string, string> = {
      approved: 'Pago',
      pending: 'Aguardando pagamento',
      in_process: 'Em análise',
      authorized: 'Em análise',
      rejected: 'Não aprovado',
      cancelled: 'Cancelado',
      refunded: 'Estornado',
      charged_back: 'Estornado'
    };
    return labels[status] || status;
  }

  methodLabel(method: string | null): string {
    if (!method) {
      return '—';
    }
    return method === 'pix' ? 'Pix' : 'Cartão';
  }

  formatDate(value: string): string {
    return new Date(value).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
  }

  formatItems(order: GiftOrder): string {
    return order.items.map((item) => `${item.quantity}x ${item.title}`).join(', ');
  }

  exportCsv(): void {
    const header = ['Quem presenteou', 'Presentes', 'Valor', 'Mensagem', 'Forma de pagamento', 'Status', 'Data'];
    const rows = this.orders.map((order) => [
      order.buyerName || 'Não informado',
      this.formatItems(order),
      order.total.toFixed(2).replace('.', ','),
      order.message || '',
      this.methodLabel(order.paymentMethod),
      this.statusLabel(order.status),
      this.formatDate(order.createdAt)
    ]);
    const csv = [header, ...rows]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(';'))
      .join('\r\n');
    const url = URL.createObjectURL(new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'presentes-recebidos.csv';
    link.click();
    URL.revokeObjectURL(url);
  }

  async load(): Promise<void> {
    this.error = '';
    this.isLoading = true;
    try {
      this.orders = await this.giftService.getOrders();
    } catch (error) {
      this.error = error instanceof Error ? error.message : 'Não foi possível carregar os presentes recebidos.';
    } finally {
      this.isLoading = false;
    }
  }
}
