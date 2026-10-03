import { registerLocaleData } from '@angular/common';
import localePt from '@angular/common/locales/pt';
import { Component, inject, OnInit, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { RouterOutlet } from '@angular/router';

registerLocaleData(localePt, 'pt-BR');

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet],
  template: '<router-outlet />'
})
export class AppComponent implements OnInit {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  ngOnInit(): void {
    if (!this.isBrowser) {
      return;
    }
    const splash = document.getElementById('splash');
    if (!splash) {
      return;
    }
    const hide = () => {
      splash.classList.add('hide');
      window.setTimeout(() => splash.remove(), 700);
    };
    const minimum = new Promise<void>((resolve) => window.setTimeout(resolve, 900));
    const loaded = new Promise<void>((resolve) => {
      if (document.readyState === 'complete') {
        resolve();
      } else {
        window.addEventListener('load', () => resolve(), { once: true });
      }
    });
    void Promise.all([minimum, loaded]).then(hide);
  }
}
