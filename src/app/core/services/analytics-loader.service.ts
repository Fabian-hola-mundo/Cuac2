import { Injectable, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Router, NavigationEnd } from '@angular/router';
import { SiteSettingsService } from './site-settings.service';
import { CookieConsentService } from './cookie-consent.service';

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

@Injectable({ providedIn: 'root' })
export class AnalyticsLoaderService {
  private isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private siteSettings = inject(SiteSettingsService);
  private consent = inject(CookieConsentService);
  private router = inject(Router);

  private loaded = false;

  async init(): Promise<void> {
    if (!this.isBrowser || this.loaded) return;
    if (this.consent.getConsent() !== 'accepted') return;

    const measurementId = await this.siteSettings.get('ga_measurement_id');
    if (!measurementId) return;

    this.injectScript(measurementId);
    this.loaded = true;

    this.router.events.subscribe(event => {
      if (event instanceof NavigationEnd && window.gtag) {
        window.gtag('config', measurementId, { page_path: event.urlAfterRedirects });
      }
    });
  }

  private injectScript(measurementId: string): void {
    const loader = document.createElement('script');
    loader.async = true;
    loader.src = `https://www.googletagmanager.com/gtag/js?id=${measurementId}`;
    document.head.appendChild(loader);

    window.dataLayer = window.dataLayer ?? [];
    window.gtag = (...args: unknown[]) => { window.dataLayer!.push(args); };
    window.gtag('js', new Date());
    window.gtag('config', measurementId);
  }
}
