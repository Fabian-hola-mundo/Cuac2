import { inject, Injectable, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

export type ConsentValue = 'accepted' | 'rejected';
const KEY = 'cookie_consent';

@Injectable({ providedIn: 'root' })
export class CookieConsentService {
  private isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  getConsent(): ConsentValue | null {
    if (!this.isBrowser) return null;
    return (localStorage.getItem(KEY) as ConsentValue) ?? null;
  }

  setConsent(value: ConsentValue): void {
    if (!this.isBrowser) return;
    localStorage.setItem(KEY, value);
  }

  hasConsent(): boolean {
    if (!this.isBrowser) return true;
    return localStorage.getItem(KEY) !== null;
  }
}
