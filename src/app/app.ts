import { Component, OnInit, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { CookieBannerComponent } from './shared/cookie-banner/cookie-banner.component';
import { AnalyticsLoaderService } from './core/services/analytics-loader.service';

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
export class App implements OnInit {
  private analytics = inject(AnalyticsLoaderService);

  ngOnInit(): void {
    this.analytics.init();
  }
}
