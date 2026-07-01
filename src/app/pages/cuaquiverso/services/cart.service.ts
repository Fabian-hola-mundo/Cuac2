import { Injectable, signal, computed } from '@angular/core';

export interface CartItem {
  id: string;
  name: string;
  sub: string;
  price: number;
  color: string;
  qty: number;
  categoria: string;
}

@Injectable({ providedIn: 'root' })
export class CartService {
  private _items = signal<CartItem[]>([]);
  isOpen = signal(false);

  readonly items  = computed(() => this._items());
  readonly count  = computed(() => this._items().reduce((s, i) => s + i.qty, 0));
  readonly total  = computed(() => this._items().reduce((s, i) => s + i.price * i.qty, 0));

  open()   { this.isOpen.set(true); }
  close()  { this.isOpen.set(false); }

  add(item: Omit<CartItem, 'qty'>) {
    const curr = this._items();
    const idx  = curr.findIndex(i => i.id === item.id);
    if (idx >= 0) {
      this._items.set(curr.map((i, j) => j === idx ? { ...i, qty: i.qty + 1 } : i));
    } else {
      this._items.set([...curr, { ...item, qty: 1 }]);
    }
  }

  updateQty(id: string, qty: number) {
    if (qty <= 0) { this.remove(id); return; }
    this._items.set(this._items().map(i => i.id === id ? { ...i, qty } : i));
  }

  remove(id: string) {
    this._items.set(this._items().filter(i => i.id !== id));
  }

  clear() {
    this._items.set([]);
    this.isOpen.set(false);
  }

  fmtPrice(n: number): string {
    return '$' + n.toLocaleString('es-CO');
  }
}
