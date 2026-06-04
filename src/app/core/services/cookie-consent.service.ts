import { Injectable } from '@angular/core';

export type ConsentValue = 'accepted' | 'rejected';
const KEY = 'cookie_consent';

@Injectable({ providedIn: 'root' })
export class CookieConsentService {
  getConsent(): ConsentValue | null {
    return (localStorage.getItem(KEY) as ConsentValue) ?? null;
  }

  setConsent(value: ConsentValue): void {
    localStorage.setItem(KEY, value);
  }

  hasConsent(): boolean {
    return localStorage.getItem(KEY) !== null;
  }
}
