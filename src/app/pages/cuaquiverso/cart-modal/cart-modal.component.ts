import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CartService } from '../services/cart.service';

const COLOR_MAP: Record<string, string> = {
  rio: '#2A6FDB', rosa: '#FF6FA8', sol: '#FFC93C', bone: '#D4DCE4',
  terra: '#E8623D', lila: '#8B6FD8', selva: '#1F8A5B', tibu: '#2E8FB8', cream: '#D8DEDE',
};

@Component({
  selector: 'app-cart-modal',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './cart-modal.component.html',
  styleUrl: './cart-modal.component.scss',
})
export class CartModalComponent {
  readonly cart = inject(CartService);

  colorHex(key: string): string {
    if (!key) return '#3D4856';
    if (key.startsWith('#') || key.startsWith('rgb')) return key;
    return COLOR_MAP[key] ?? '#3D4856';
  }
}
