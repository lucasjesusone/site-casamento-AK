import { Injectable } from '@angular/core';
import { type CloudinaryImage, type Gift } from '../data/gift';
import { apiUrl } from './api-url';

@Injectable({ providedIn: 'root' })
export class GiftService {
  private readonly sessionKey = 'sitecasamento-admin-token';

  async loadPublicGifts(): Promise<Gift[]> {
    const response = await fetch(apiUrl('/api/gifts'));
    if (!response.ok) {
      return [];
    }
    return (await response.json()) as Gift[];
  }

  async createCheckout(items: Array<{ giftId: string; quantity: number }>): Promise<{ orderId: string; checkoutUrl: string }> {
    const response = await fetch(apiUrl('/api/checkout'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items })
    });
    const result = (await response.json()) as { orderId?: string; checkoutUrl?: string; error?: string };
    if (!response.ok || !result.orderId || !result.checkoutUrl) {
      throw new Error(result.error || 'Não foi possível iniciar o pagamento.');
    }
    return { orderId: result.orderId, checkoutUrl: result.checkoutUrl };
  }

  async getOrderStatus(orderId: string): Promise<{ id: string; status: string; total: number }> {
    const response = await fetch(apiUrl(`/api/orders/${encodeURIComponent(orderId)}`));
    const result = (await response.json()) as { id?: string; status?: string; total?: number; error?: string };
    if (!response.ok || !result.id || !result.status || typeof result.total !== 'number') {
      throw new Error(result.error || 'Não foi possível consultar o pedido.');
    }
    return { id: result.id, status: result.status, total: result.total };
  }

  async login(password: string): Promise<void> {
    const response = await fetch(apiUrl('/api/admin/login'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password })
    });
    const result = (await response.json()) as { token?: string; error?: string };
    if (!response.ok || !result.token) {
      throw new Error(result.error || 'Não foi possível entrar.');
    }
    this.setToken(result.token);
  }

  logout(): void {
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.removeItem(this.sessionKey);
    }
  }

  isLoggedIn(): boolean {
    return !!this.getToken();
  }

  async loadAdminGifts(): Promise<Gift[]> {
    return this.request<Gift[]>(apiUrl('/api/admin/gifts'));
  }

  async loadImages(): Promise<CloudinaryImage[]> {
    return this.request<CloudinaryImage[]>(apiUrl('/api/admin/images'));
  }

  async saveGift(gift: Partial<Gift>): Promise<Gift> {
    return this.request<Gift>(apiUrl('/api/admin/gifts'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(gift)
    });
  }

  async deleteGift(id: string): Promise<void> {
    await this.request<void>(apiUrl(`/api/admin/gifts/${encodeURIComponent(id)}`), { method: 'DELETE' });
  }

  async uploadImage(file: File): Promise<string> {
    const signature = await this.request<{
      cloudName: string;
      apiKey: string;
      timestamp: number;
      folder: string;
      signature: string;
    }>(apiUrl('/api/admin/images/signature'), { method: 'POST' });

    const formData = new FormData();
    formData.set('file', file);
    formData.set('api_key', signature.apiKey);
    formData.set('timestamp', String(signature.timestamp));
    formData.set('folder', signature.folder);
    formData.set('signature', signature.signature);

    const response = await fetch(`https://api.cloudinary.com/v1_1/${encodeURIComponent(signature.cloudName)}/image/upload`, {
      method: 'POST',
      body: formData
    });
    const result = (await response.json()) as { secure_url?: string; error?: { message?: string } };
    if (!response.ok || !result.secure_url) {
      throw new Error(result.error?.message || 'Não foi possível enviar a foto.');
    }
    return result.secure_url;
  }

  private async request<T>(url: string, init: RequestInit = {}): Promise<T> {
    const token = this.getToken();
    const response = await fetch(url, {
      ...init,
      headers: {
        ...init.headers,
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      }
    });
    const result = response.status === 204 ? undefined : await response.json();
    if (!response.ok) {
      if (response.status === 401) {
        this.logout();
      }
      throw new Error((result as { error?: string } | undefined)?.error || 'Não foi possível concluir a operação.');
    }
    return result as T;
  }

  private setToken(token: string): void {
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.setItem(this.sessionKey, token);
    }
  }

  private getToken(): string | null {
    return typeof sessionStorage === 'undefined' ? null : sessionStorage.getItem(this.sessionKey);
  }
}
