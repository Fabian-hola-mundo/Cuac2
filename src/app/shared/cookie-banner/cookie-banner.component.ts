import { Component, OnInit, OnDestroy, signal, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CookieConsentService } from '../../core/services/cookie-consent.service';
import { AnalyticsLoaderService } from '../../core/services/analytics-loader.service';

@Component({
  selector: 'app-cookie-banner',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './cookie-banner.component.html',
  styleUrl: './cookie-banner.component.scss',
})
export class CookieBannerComponent implements OnInit, OnDestroy {
  private consent = inject(CookieConsentService);
  private analytics = inject(AnalyticsLoaderService);

  visible = signal(false);
  private timer: ReturnType<typeof setTimeout> | null = null;

  ngOnInit(): void {
    if (!this.consent.hasConsent()) {
      this.visible.set(true);
      this.timer = setTimeout(() => this.dismiss(), 30_000);
    }
  }

  ngOnDestroy(): void {
    if (this.timer) clearTimeout(this.timer);
  }

  accept(): void {
    this.consent.setConsent('accepted');
    this.analytics.init();
    this.dismiss();
  }

  reject(): void {
    this.consent.setConsent('rejected');
    this.dismiss();
  }

  private dismiss(): void {
    this.visible.set(false);
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }
}
