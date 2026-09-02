// src/app/pages/cuaquiverso/services/bold.service.ts
import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

const LIBRERIA = 'https://checkout.bold.co/library/boldPaymentButton.js';

/** Configuración firmada que devuelve la edge function `crear-pedido`. */
export interface BoldCheckoutConfig {
  apiKey:             string;
  orderId:            string;
  amount:             string;
  currency:           string;
  integritySignature: string;
  redirectionUrl:     string;
  description:        string;
  customerData:       string;
  billingAddress:     string;
}

interface BoldCheckoutInstancia {
  open(): void;
}

declare global {
  interface Window {
    BoldCheckout?: new (config: BoldCheckoutConfig) => BoldCheckoutInstancia;
  }
}

@Injectable({ providedIn: 'root' })
export class BoldService {
  private platformId = inject(PLATFORM_ID);
  private carga: Promise<void> | null = null;

  /**
   * Carga `boldPaymentButton.js` una sola vez.
   *
   * La librería anuncia que está lista con el evento `boldCheckoutLoaded`, pero
   * cargándola dinámicamente ese evento no siempre llega, aunque `BoldCheckout`
   * quede definido. Esperar sólo el evento dejaba el botón en "Procesando..."
   * para siempre. Así que el evento es el camino rápido y la condición que
   * realmente decide es que `window.BoldCheckout` exista.
   */
  private cargarLibreria(): Promise<void> {
    if (!isPlatformBrowser(this.platformId)) {
      return Promise.reject(new Error('El pago sólo puede iniciarse desde el navegador'));
    }
    if (this.carga) return this.carga;

    this.carga = new Promise<void>((resolve, reject) => {
      if (window.BoldCheckout) { resolve(); return; }

      let terminado = false;
      let sondeo:  ReturnType<typeof setInterval> | undefined;
      let limite:  ReturnType<typeof setTimeout>  | undefined;

      const limpiar = () => {
        clearInterval(sondeo);
        clearTimeout(limite);
        window.removeEventListener('boldCheckoutLoaded', listo);
        window.removeEventListener('boldCheckoutLoadFailed', fallo);
      };

      const listo = () => {
        if (terminado) return;
        terminado = true;
        limpiar();
        resolve();
      };

      const fallo = () => {
        if (terminado) return;
        terminado = true;
        limpiar();
        // Se descarta la promesa para que el siguiente intento vuelva a cargar.
        this.carga = null;
        reject(new Error('No pudimos cargar la pasarela de pagos. Revisa tu conexión e intenta de nuevo.'));
      };

      window.addEventListener('boldCheckoutLoaded', listo);
      window.addEventListener('boldCheckoutLoadFailed', fallo);

      sondeo = setInterval(() => { if (window.BoldCheckout) listo(); }, 100);
      limite = setTimeout(fallo, 15_000);

      const existente = document.querySelector<HTMLScriptElement>(`script[src="${LIBRERIA}"]`);
      if (existente) return;

      const script = document.createElement('script');
      script.src   = LIBRERIA;
      script.async = true;
      script.onerror = fallo;
      document.head.appendChild(script);
    });

    return this.carga;
  }

  /** Abre el modal de Bold sobre la página actual. */
  async abrirCheckout(config: BoldCheckoutConfig): Promise<void> {
    await this.cargarLibreria();

    const BoldCheckout = window.BoldCheckout;
    if (!BoldCheckout) {
      throw new Error('No pudimos abrir la pasarela de pagos. Intenta de nuevo.');
    }

    new BoldCheckout(config).open();
  }
}
