import { CommonModule } from '@angular/common';
import { Component, inject, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { type CloudinaryImage, type Gift } from '../../data/gift';
import { GiftService } from '../../services/gift.service';

@Component({
  selector: 'app-admin-page',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './admin-page.component.html',
  styleUrls: ['./admin-page.component.scss']
})
export class AdminPageComponent implements OnInit {
  private readonly giftService = inject(GiftService);

  isAuthenticated = false;
  isLoading = false;
  isSaving = false;
  loginPassword = '';
  message = '';
  error = '';
  gifts: Gift[] = [];
  images: CloudinaryImage[] = [];
  editingId = '';
  form = this.emptyForm();

  ngOnInit(): void {
    this.isAuthenticated = this.giftService.isLoggedIn();
    if (this.isAuthenticated) {
      void this.loadDashboard();
    }
  }

  async login(): Promise<void> {
    this.error = '';
    this.isLoading = true;
    try {
      await this.giftService.login(this.loginPassword);
      this.isAuthenticated = true;
      this.loginPassword = '';
      await this.loadDashboard();
    } catch (error) {
      this.error = this.errorMessage(error);
    } finally {
      this.isLoading = false;
    }
  }

  async saveGift(): Promise<void> {
    this.error = '';
    this.message = '';
    this.isSaving = true;
    try {
      const saved = await this.giftService.saveGift({
        ...(this.editingId ? { id: this.editingId } : {}),
        title: this.form.title,
        description: this.form.description,
        amount: this.parseAmount(this.form.amount),
        imageUrl: this.form.imageUrl
      });
      const existingIndex = this.gifts.findIndex((gift) => gift.id === saved.id);
      this.gifts = existingIndex < 0
        ? [...this.gifts, saved]
        : this.gifts.map((gift) => gift.id === saved.id ? saved : gift);
      this.message = this.editingId ? 'Presente atualizado.' : 'Presente adicionado.';
      this.resetForm();
    } catch (error) {
      this.error = this.errorMessage(error);
    } finally {
      this.isSaving = false;
    }
  }

  editGift(gift: Gift): void {
    this.editingId = gift.id;
    this.form = {
      title: gift.title,
      description: gift.description,
      amount: String(gift.amount).replace('.', ','),
      imageUrl: gift.imageUrl
    };
    this.message = '';
    this.error = '';
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async removeGift(gift: Gift): Promise<void> {
    if (!window.confirm(`Remover o presente "${gift.title}"?`)) {
      return;
    }

    this.error = '';
    this.message = '';
    try {
      await this.giftService.deleteGift(gift.id);
      this.gifts = this.gifts.filter((item) => item.id !== gift.id);
      if (this.editingId === gift.id) {
        this.resetForm();
      }
      this.message = 'Presente removido.';
    } catch (error) {
      this.error = this.errorMessage(error);
    }
  }

  async chooseUpload(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) {
      return;
    }
    this.error = '';
    this.isSaving = true;
    try {
      this.form.imageUrl = await this.giftService.uploadImage(file);
      this.message = 'Foto enviada para a pasta Gifts.';
      await this.loadImages();
    } catch (error) {
      this.error = this.errorMessage(error);
    } finally {
      this.isSaving = false;
      input.value = '';
    }
  }

  selectImage(image: CloudinaryImage): void {
    this.form.imageUrl = image.imageUrl;
  }

  logout(): void {
    this.giftService.logout();
    this.isAuthenticated = false;
    this.gifts = [];
    this.images = [];
    this.resetForm();
  }

  resetForm(): void {
    this.editingId = '';
    this.form = this.emptyForm();
  }

  private async loadDashboard(): Promise<void> {
    this.isLoading = true;
    this.error = '';
    try {
      [this.gifts, this.images] = await Promise.all([
        this.giftService.loadAdminGifts(),
        this.giftService.loadImages()
      ]);
    } catch (error) {
      this.error = this.errorMessage(error);
      this.isAuthenticated = this.giftService.isLoggedIn();
    } finally {
      this.isLoading = false;
    }
  }

  private async loadImages(): Promise<void> {
    try {
      this.images = await this.giftService.loadImages();
    } catch {
      this.images = [];
    }
  }

  private parseAmount(value: string): number {
    const text = value.trim();
    return Number(text.includes(',') ? text.replace(/\./g, '').replace(',', '.') : text);
  }

  private emptyForm(): { title: string; description: string; amount: string; imageUrl: string } {
    return { title: '', description: '', amount: '', imageUrl: '' };
  }

  private errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : 'Ocorreu um erro inesperado.';
  }
}
