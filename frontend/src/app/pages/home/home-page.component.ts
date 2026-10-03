import { CommonModule, isPlatformBrowser } from '@angular/common';
import { Component, ElementRef, inject, OnDestroy, OnInit, PLATFORM_ID, ViewChild } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { weddingData } from '../../data/wedding-data';
import { type Gift } from '../../data/gift';
import { GiftService } from '../../services/gift.service';
import { MediaService } from '../../services/media.service';

interface GiftCartItem {
  gift: Gift;
  quantity: number;
}

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './home-page.component.html',
  styleUrls: ['./home-page.component.scss']
})
export class HomePageComponent implements OnInit, OnDestroy {
  private readonly mediaService = inject(MediaService);
  private readonly giftService = inject(GiftService);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly route = inject(ActivatedRoute);
  @ViewChild('giftPagesViewport') private giftPagesViewport?: ElementRef<HTMLDivElement>;
  private galleryTimer?: ReturnType<typeof setInterval>;

  readonly title = weddingData.couple.names;
  readonly shortName = weddingData.couple.short;
  readonly weddingDate = weddingData.couple.date;
  readonly headline = weddingData.couple.headline;
  readonly subtitle = weddingData.couple.subtitle;
  readonly confirmEmail = weddingData.couple.confirmEmail;
  readonly location = weddingData.location;
  readonly rsvp = weddingData.rsvp;
  readonly highlights = weddingData.highlights;
  readonly story = weddingData.story;
  readonly timeline = weddingData.timeline;
  gallery = weddingData.gallery.length ? weddingData.gallery : this.mediaService.getGallery();
  galleryIndex = 0;
  gifts: Gift[] = [];
  giftsPage = 0;
  giftsLoading = true;
  cartItems: GiftCartItem[] = [];
  isCartOpen = false;
  checkoutError = '';
  isCheckoutLoading = false;
  paymentReturnMessage = '';
  paymentReturnStatus: 'success' | 'pending' | 'failure' | '' = '';
  paymentReturnTotal = 0;
  private readonly cartStorageKey = 'sitecasamento-gift-cart';

  ngOnInit(): void {
    this.startGalleryAutoplay();

    if (isPlatformBrowser(this.platformId)) {
      this.restoreCart();
      void this.loadPaymentReturn();
      void this.mediaService.loadGallery().then((gallery) => {
        this.gallery = gallery;
        this.galleryIndex = 0;
        this.startGalleryAutoplay();
      });
      void this.giftService.loadPublicGifts().then((gifts) => {
        this.gifts = gifts;
        this.giftsLoading = false;
      }).catch(() => {
        this.giftsLoading = false;
      });
    } else {
      this.giftsLoading = false;
    }
  }

  ngOnDestroy(): void {
    this.stopGalleryAutoplay();
  }

  get activeGalleryItem() {
    return this.gallery[this.galleryIndex];
  }

  get cartItemCount(): number {
    return this.cartItems.reduce((total, item) => total + item.quantity, 0);
  }

  get cartTotal(): number {
    return this.cartItems.reduce((total, item) => total + item.gift.amount * item.quantity, 0);
  }

  get giftPages(): Gift[][] {
    const pages: Gift[][] = [];
    for (let index = 0; index < this.gifts.length; index += 4) {
      pages.push(this.gifts.slice(index, index + 4));
    }
    return pages;
  }

  get giftsPageCount(): number {
    return Math.ceil(this.gifts.length / 4);
  }

  showPreviousGifts(): void {
    this.scrollToGiftsPage(Math.max(0, this.giftsPage - 1));
  }

  showNextGifts(): void {
    this.scrollToGiftsPage(Math.min(this.giftsPageCount - 1, this.giftsPage + 1));
  }

  onGiftPagesScroll(event: Event): void {
    const viewport = event.currentTarget as HTMLDivElement;
    if (viewport.clientWidth > 0) {
      this.giftsPage = Math.min(
        this.giftsPageCount - 1,
        Math.round(viewport.scrollLeft / viewport.clientWidth)
      );
    }
  }

  private scrollToGiftsPage(page: number): void {
    this.giftsPage = page;
    this.giftPagesViewport?.nativeElement.scrollTo({
      left: page * this.giftPagesViewport.nativeElement.clientWidth,
      behavior: 'smooth'
    });
  }

  addGiftToCart(gift: Gift): void {
    const existing = this.cartItems.find((item) => item.gift.id === gift.id);
    this.cartItems = existing
      ? this.cartItems.map((item) => item.gift.id === gift.id ? { ...item, quantity: item.quantity + 1 } : item)
      : [...this.cartItems, { gift, quantity: 1 }];
    this.persistCart();
    this.checkoutError = '';
    this.isCartOpen = true;
  }

  continueShopping(): void {
    this.checkoutError = '';
    this.isCartOpen = false;
  }

  async finalizePurchase(): Promise<void> {
    this.checkoutError = '';
    this.isCheckoutLoading = true;
    try {
      const checkout = await this.giftService.createCheckout(
        this.cartItems.map(({ gift, quantity }) => ({ giftId: gift.id, quantity }))
      );
      window.location.assign(checkout.checkoutUrl);
    } catch (error) {
      this.checkoutError = error instanceof Error ? error.message : 'Não foi possível iniciar o pagamento.';
      this.isCheckoutLoading = false;
    }
  }

  private async loadPaymentReturn(): Promise<void> {
    const orderId = this.route.snapshot.queryParamMap.get('order_id');
    if (!orderId) {
      return;
    }

    const paymentResult = this.route.snapshot.queryParamMap.get('payment');
    if (paymentResult === 'failure') {
      this.paymentReturnStatus = 'failure';
      this.paymentReturnMessage = 'O pagamento não foi concluído. Seus presentes continuam no carrinho.';
      return;
    }

    for (let attempt = 0; attempt < 6; attempt += 1) {
      try {
        const order = await this.giftService.getOrderStatus(orderId);
        this.paymentReturnTotal = order.total;
        if (order.status === 'approved') {
          this.paymentReturnStatus = 'success';
          this.paymentReturnMessage = 'Pagamento aprovado! Obrigado pelo carinho com a gente.';
          this.cartItems = [];
          this.persistCart();
          return;
        }
        if (['rejected', 'cancelled', 'refunded', 'charged_back'].includes(order.status)) {
          this.paymentReturnStatus = 'failure';
          this.paymentReturnMessage = 'O pagamento não foi aprovado. Seus presentes continuam no carrinho.';
          return;
        }
      } catch {
        this.paymentReturnStatus = 'pending';
        this.paymentReturnMessage = 'Estamos consultando o status do pagamento. Confira novamente em instantes.';
        return;
      }

      if (attempt < 5) {
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    }

    this.paymentReturnStatus = 'pending';
    this.paymentReturnMessage = 'Pagamento em processamento. A confirmação será atualizada assim que o Mercado Pago notificar o site.';
  }

  changeGiftQuantity(giftId: string, difference: number): void {
    this.cartItems = this.cartItems
      .map((item) => item.gift.id === giftId ? { ...item, quantity: item.quantity + difference } : item)
      .filter((item) => item.quantity > 0);
    this.persistCart();
  }

  removeGiftFromCart(giftId: string): void {
    this.cartItems = this.cartItems.filter((item) => item.gift.id !== giftId);
    this.persistCart();
  }

  private restoreCart(): void {
    try {
      const stored = window.localStorage.getItem(this.cartStorageKey);
      if (stored) {
        this.cartItems = JSON.parse(stored) as GiftCartItem[];
      }
    } catch {
      this.cartItems = [];
    }
  }

  private persistCart(): void {
    if (isPlatformBrowser(this.platformId)) {
      window.localStorage.setItem(this.cartStorageKey, JSON.stringify(this.cartItems));
    }
  }

  showPreviousPhoto(): void {
    this.galleryIndex = (this.galleryIndex - 1 + this.gallery.length) % this.gallery.length;
  }

  showNextPhoto(): void {
    this.galleryIndex = (this.galleryIndex + 1) % this.gallery.length;
  }

  selectPhoto(index: number): void {
    this.galleryIndex = index;
  }

  pauseGallery(): void {
    this.stopGalleryAutoplay();
  }

  resumeGallery(): void {
    this.startGalleryAutoplay();
  }

  onGalleryFocusOut(event: FocusEvent): void {
    const carousel = event.currentTarget as HTMLElement;
    if (!carousel.contains(event.relatedTarget as Node | null)) {
      this.resumeGallery();
    }
  }

  private startGalleryAutoplay(): void {
    if (!isPlatformBrowser(this.platformId) || this.gallery.length < 2) {
      return;
    }

    this.stopGalleryAutoplay();
    this.galleryTimer = setInterval(() => this.showNextPhoto(), 5000);
  }

  private stopGalleryAutoplay(): void {
    if (this.galleryTimer) {
      clearInterval(this.galleryTimer);
      this.galleryTimer = undefined;
    }
  }

  getImageUrl(url?: string): string {
    return this.mediaService.getImageUrl(url);
  }
}
