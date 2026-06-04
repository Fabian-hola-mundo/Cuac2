import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { CookieBannerComponent } from './shared/cookie-banner/cookie-banner.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, CookieBannerComponent],
  template: `
    <router-outlet />
    <app-cookie-banner />
  `,
  styles: [':host { display: block; }'],
})
export class App {}
