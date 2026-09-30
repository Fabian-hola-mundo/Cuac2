import { Injectable, PLATFORM_ID, computed, effect, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

export interface CartItem {
  id: string;
  name: string;
  sub: string;
  price: number;
  color: string;
  qty: number;
  categoria: string;
  /** Stock conocido al agregar (el de la variante si la hay). Tope local; el servidor revalida al pagar. */
  stock?: number;
  /** Combinación elegida, p. ej. Talla M · Negro. Sin variante = producto simple. */
  varianteId?: string | null;
  varianteLabel?: string | null;
}

const STORAGE_KEY = 'cuaquiverso.cart.v2';
const STORAGE_KEY_V1 = 'cuaquiverso.cart.v1';

/**
 * Un carrito viejo resucitado es peor que un carrito vacío: los precios y el
 * stock ya no son los mismos y el comprador no recuerda haberlo llenado.
 */
const TTL_MS = 14 * 24 * 60 * 60 * 1000;

/** Una línea es producto + variante: la misma camiseta en M y en L son dos. */
export function claveLinea(i: { id: string; varianteId?: string | null }): string {
  return `${i.id}|${i.varianteId ?? ''}`;
}

function lineasValidas(items: unknown): CartItem[] {
  if (!Array.isArray(items)) return [];
  return items.filter(
    (i: any) =>
      typeof i?.id === 'string' &&
      typeof i?.name === 'string' &&
      Number.isFinite(i?.price) &&
      Number.isInteger(i?.qty) && i.qty > 0,
  );
}

/** El carrito v1 sólo tenía productos simples: sus líneas valen tal cual. */
export function migrarCarritoV1(crudo: string | null): CartItem[] {
  if (!crudo) return [];
  try {
    const g = JSON.parse(crudo);
    if (Date.now() - (g?.guardadoEn ?? 0) > TTL_MS) return [];
    return lineasValidas(g?.items);
  } catch {
    return [];
  }
}

@Injectable({ providedIn: 'root' })
export class CartService {
  private platformId = inject(PLATFORM_ID);
  private esNavegador = isPlatformBrowser(this.platformId);

  private _items = signal<CartItem[]>(this.restaurar());
  isOpen = signal(false);

  readonly items  = computed(() => this._items());
  readonly count  = computed(() => this._items().reduce((s, i) => s + i.qty, 0));
  readonly total  = computed(() => this._items().reduce((s, i) => s + i.price * i.qty, 0));

  constructor() {
    // El carrito vivía sólo en memoria mientras media tienda navegaba con
    // enlaces nativos: bastaba un F5, volver del modal de Bold o que el
    // navegador descartara la pestaña para perderlo entero, sin aviso.
    effect(() => {
      const items = this._items();
      if (!this.esNavegador) return;
      try {
        if (items.length === 0) localStorage.removeItem(STORAGE_KEY);
        else localStorage.setItem(STORAGE_KEY, JSON.stringify({ guardadoEn: Date.now(), items }));
      } catch {
        // Modo incógnito, cuota llena o cookies bloqueadas: el carrito sigue
        // funcionando en memoria, que es exactamente lo que había antes.
      }
    });
  }

  open()   { this.isOpen.set(true); }
  close()  { this.isOpen.set(false); }

  /**
   * Devuelve false si el producto ya está al tope de su stock, para que la
   * tienda pueda decirlo en vez de fingir que agregó una unidad más.
   */
  add(item: Omit<CartItem, 'qty'>): boolean {
    const curr = this._items();
    const k    = claveLinea(item);
    const idx  = curr.findIndex(i => claveLinea(i) === k);
    const tope = this.tope(item.stock);

    if (idx >= 0) {
      const actual = curr[idx];
      if (actual.qty >= tope) return false;
      // El stock se refresca con el del catálogo recién cargado, no con el que
      // se guardó en localStorage hace una semana.
      this._items.set(curr.map((i, j) =>
        j === idx ? { ...i, ...item, qty: i.qty + 1 } : i
      ));
      return true;
    }

    if (tope < 1) return false;
    this._items.set([...curr, { ...item, qty: 1 }]);
    return true;
  }

  updateQty(clave: string, qty: number) {
    if (qty <= 0) { this.remove(clave); return; }
    this._items.set(this._items().map(i =>
      claveLinea(i) === clave ? { ...i, qty: Math.min(qty, this.tope(i.stock)) } : i
    ));
  }

  /** true cuando la línea ya no admite una unidad más. */
  enTope(item: CartItem): boolean {
    return item.qty >= this.tope(item.stock);
  }

  remove(clave: string) {
    this._items.set(this._items().filter(i => claveLinea(i) !== clave));
  }

  clear() {
    this._items.set([]);
    this.isOpen.set(false);
  }

  fmtPrice(n: number): string {
    return '$' + n.toLocaleString('es-CO');
  }

  /** Sin stock conocido no se inventa un límite: manda la validación del servidor. */
  private tope(stock: number | undefined): number {
    return Number.isFinite(stock) ? Math.max(0, stock as number) : Number.MAX_SAFE_INTEGER;
  }

  private restaurar(): CartItem[] {
    if (!this.esNavegador) return [];
    try {
      const v1 = localStorage.getItem(STORAGE_KEY_V1);
      if (v1 !== null) {
        localStorage.removeItem(STORAGE_KEY_V1);
        return migrarCarritoV1(v1);
      }
      const crudo = localStorage.getItem(STORAGE_KEY);
      if (!crudo) return [];
      const guardado = JSON.parse(crudo);
      if (Date.now() - (guardado?.guardadoEn ?? 0) > TTL_MS) {
        localStorage.removeItem(STORAGE_KEY);
        return [];
      }
      return lineasValidas(guardado?.items);
    } catch {
      return [];
    }
  }
}
