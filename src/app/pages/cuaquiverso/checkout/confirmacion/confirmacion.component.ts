import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CheckoutService, PedidoDetalle } from '../../services/checkout.service';
import { CartService } from '../../services/cart.service';
import { SeoService } from '../../../../core/services/seo.service';

const COLOR_MAP: Record<string, string> = {
  rio: '#2A6FDB', rosa: '#FF6FA8', sol: '#FFC93C', bone: '#D4DCE4',
  terra: '#E8623D', lila: '#8B6FD8', selva: '#1F8A5B', tibu: '#2E8FB8', cream: '#D8DEDE',
};

@Component({
  selector: 'app-confirmacion',
  standalone: true,
  imports: [],
  templateUrl: './confirmacion.component.html',
  styleUrl: './confirmacion.component.scss',
})
export class ConfirmacionComponent implements OnInit {
  private route    = inject(ActivatedRoute);
  private router   = inject(Router);
  private checkout = inject(CheckoutService);
  private cart     = inject(CartService);
  private seo      = inject(SeoService);

  readonly loading  = signal(true);
  readonly notFound = signal(false);
  readonly pedido   = signal<PedidoDetalle | null>(null);

  async ngOnInit(): Promise<void> {
    this.seo.set({
      title:       'Pedido confirmado — Cuaquiverso',
      description: 'Tu pedido fue recibido. Gracias por comprar en Cuaquiverso.',
      canonical:   'https://cuacdesign.com/cuaquiverso/checkout/confirmacion',
    });

    const ref = this.route.snapshot.queryParams['ref'];
    if (!ref) {
      this.router.navigate(['/cuaquiverso']);
      return;
    }

    const data = await this.checkout.obtenerPedido(ref);
    if (!data) {
      this.notFound.set(true);
    } else {
      this.pedido.set(data);
      this.cart.clear();
    }
    this.loading.set(false);
  }

  fechaFormateada(): string {
    const p = this.pedido();
    if (!p) return '';
    return new Date(p.creado_en).toLocaleDateString('es-CO', {
      day: 'numeric', month: 'long', year: 'numeric',
    });
  }

  colorHex(key: string): string {
    return COLOR_MAP[key] ?? '#3D4856';
  }

  fmtPrice(n: number): string {
    return '$' + n.toLocaleString('es-CO');
  }
}
