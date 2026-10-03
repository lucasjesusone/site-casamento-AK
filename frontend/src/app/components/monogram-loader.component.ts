import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-monogram-loader',
  standalone: true,
  template: `
    <div class="loader" role="status" [attr.aria-label]="label">
      <img src="assets/monograma.png" alt="" />
      @if (label) { <span>{{ label }}</span> }
    </div>
  `,
  styles: [`
    .loader { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; padding: 32px 0; color: #8a6a35; font-size: .9rem; }
    img { width: 72px; height: auto; mix-blend-mode: multiply; animation: pulse 1.8s ease-in-out infinite; }
    @keyframes pulse { 0%, 100% { opacity: .5; transform: scale(.95); } 50% { opacity: 1; transform: scale(1); } }
    @media (prefers-reduced-motion: reduce) { img { animation: none; } }
  `]
})
export class MonogramLoaderComponent {
  @Input() label = '';
}
