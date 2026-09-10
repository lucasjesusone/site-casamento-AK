import { Injectable } from '@angular/core';

export interface MediaImage {
  title: string;
  accent: 'rose' | 'gold' | 'sage';
  imageUrl: string;
}

@Injectable({
  providedIn: 'root'
})
export class MediaService {
  private readonly defaultGallery: MediaImage[] = [
    {
      title: 'Nosso começo',
      accent: 'rose',
      imageUrl:
        'https://images.unsplash.com/photo-1520854221256-17451cc331bf?auto=format&fit=crop&w=900&q=80'
    },
    {
      title: 'Amor em família',
      accent: 'gold',
      imageUrl:
        'https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&w=900&q=80'
    },
    {
      title: 'Momentos felizes',
      accent: 'sage',
      imageUrl:
        'https://images.unsplash.com/photo-1522673607200-164d1b6ce486?auto=format&fit=crop&w=900&q=80'
    }
  ];

  getGallery(): MediaImage[] {
    return this.defaultGallery;
  }

  getImageUrl(url?: string): string {
    return url || 'https://images.unsplash.com/photo-1520854221256-17451cc331bf?auto=format&fit=crop&w=900&q=80';
  }
}
