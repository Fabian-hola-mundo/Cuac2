import { Injectable, signal } from '@angular/core';

export type HelpModalType = 'envios' | 'devoluciones' | 'tallas';

@Injectable({ providedIn: 'root' })
export class HelpModalService {
  readonly activeModal = signal<HelpModalType | null>(null);

  open(type: HelpModalType): void {
    this.activeModal.set(type);
  }

  close(): void {
    this.activeModal.set(null);
  }
}
