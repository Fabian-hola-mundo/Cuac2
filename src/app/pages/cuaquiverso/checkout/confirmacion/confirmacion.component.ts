import { Component, OnDestroy, OnInit, PLATFORM_ID, computed, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { CheckoutService, PedidoDetalle } from '../../services/checkout.service';
import { CartService } from '../../services/cart.service';
import { SeoService } from '../../../../core/services/seo.service';

const COLOR_MAP: Record<string, string> = {
  rio: '#2A6FDB', rosa: '#FF6FA8', sol: '#FFC93C', bone: '#D4DCE4',
  terra: '#E8623D', lila: '#8B6FD8', selva: '#1F8A5B', tibu: '#2E8FB8', cream: '#D8DEDE',
};

/** Cada cuánto se vuelve a preguntar mientras el pedido sigue 'pendiente'. */
const SONDEO_MS = 3_000;

/**
 * Cuánto se espera al webhook antes de dejar de sondear. Bold suele llamarlo en
 * segundos; pasado este punto se le dice al comprador que su pago sigue en
 * revisión en vez de girar para siempre.
 */
const ESPERA_MAX_MS = 90_000;

@Component({
  selector: 'app-confirmacion',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './confirmacion.component.html',
  styleUrl: './confirmacion.component.scss',
})
export class ConfirmacionComponent implements OnInit, OnDestroy {
  private route    = inject(ActivatedRoute);
  private router   = inject(Router);
  private checkout = inject(CheckoutService);
  private cart     = inject(CartService);
  private seo      = inject(SeoService);
  private esNavegador = isPlatformBrowser(inject(PLATFORM_ID));

  readonly loading  = signal(true);
  readonly notFound = signal(false);
  /** Fallo de lectura, distinto de "no existe": el primero se puede reintentar. */
  readonly errorCarga = signal<string | null>(null);
  readonly pedido   = signal<PedidoDetalle | null>(null);
  /** El pedido sigue 'pendiente' tras esperar al webhook: se dejó de sondear. */
  readonly esperaAgotada = signal(false);

  /**
   * El pedido nace 'pendiente' y sólo el webhook de Bold lo mueve. Esta pantalla
   * anunciaba "Pago aprobado", "Tu pedido está en camino" y "Total pagado" con
   * sólo comprobar que el pedido existía, así que a quien le rechazaban la
   * tarjeta —Bold también lo devuelve aquí— se le confirmaba una compra que no
   * ocurrió, y encima se le vaciaba el carrito.
   */
  readonly aprobado  = computed(() => this.pedido()?.estado === 'aprobado');
  readonly pendiente = computed(() => this.pedido()?.estado === 'pendiente');
  readonly fallido   = computed(() => {
    const e = this.pedido()?.estado;
    return e === 'rechazado' || e === 'cancelado';
  });
  readonly cancelado = computed(() => this.pedido()?.estado === 'cancelado');

  private token = '';
  /** Identificador de la venta que Bold añade a la URL de retorno. */
  private boldOrderId: string | null = null;
  private sondeo: ReturnType<typeof setTimeout> | null = null;
  private desde = 0;

  async ngOnInit(): Promise<void> {
    // `ref` lo ponemos nosotros en la redirectionUrl y lleva el token de
    // confirmación (uuid impredecible), no la referencia: la referencia era
    // enumerable y con ella se podían leer los datos de cualquier cliente.
    const params = this.route.snapshot.queryParams;
    const token = params['ref'];
    if (!token) {
      this.router.navigate(['/cuaquiverso']);
      return;
    }
    this.token = token;
    // Bold añade `bold-order-id` al volver; sirve para preguntarle por la venta.
    this.boldOrderId = params['bold-order-id'] ?? null;
    this.desde = Date.now();
    await this.cargar();
  }

  ngOnDestroy(): void {
    this.detenerSondeo();
  }

  async cargar(): Promise<void> {
    this.loading.set(true);
    this.errorCarga.set(null);
    this.notFound.set(false);

    try {
      const data = await this.checkout.obtenerPedido(this.token);
      if (!data) {
        this.notFound.set(true);
        this.aplicarSeo('Pedido no encontrado');
      } else {
        this.aplicar(data);
      }
    } catch (e: any) {
      // Un corte de red al volver de Bold no significa que el pedido no exista:
      // decirle "no encontramos tu pedido" a quien acaba de pagar es lo peor
      // que puede hacer esta pantalla.
      this.errorCarga.set(e?.message ?? 'No pudimos consultar tu pedido.');
    }

    this.loading.set(false);
  }

  /** Reintento manual tras un fallo de lectura. */
  async reintentar(): Promise<void> {
    this.desde = Date.now();
    this.esperaAgotada.set(false);
    await this.cargar();
  }

  private aplicar(p: PedidoDetalle): void {
    this.pedido.set(p);

    if (p.estado === 'aprobado') {
      this.detenerSondeo();
      // El carrito sólo se vacía con un pago confirmado.
      this.cart.clear();
      this.aplicarSeo('Pedido confirmado');
      return;
    }

    if (p.estado === 'pendiente') {
      this.aplicarSeo('Confirmando tu pago');
      this.programarSondeo();
      return;
    }

    this.detenerSondeo();
    this.aplicarSeo('El pago no se completó');
  }

  // El navegador vuelve de Bold por `redirectionUrl` y el webhook viaja por su
  // cuenta, servidor a servidor: en el caso normal el pedido todavía está
  // 'pendiente' cuando esta página carga, así que hay que volver a preguntar.
  private programarSondeo(): void {
    this.detenerSondeo();
    if (!this.esNavegador) return;

    if (Date.now() - this.desde > ESPERA_MAX_MS) {
      this.esperaAgotada.set(true);
      return;
    }

    this.sondeo = setTimeout(async () => {
      try {
        // Respaldo del webhook: le preguntamos a Bold por la venta y, si ya está
        // pagada, la edge function mueve el pedido antes de que lo releamos. Así
        // se cierra aunque el webhook de Bold nunca llegue.
        const ref = this.pedido()?.referencia;
        if (ref) await this.checkout.verificarPago(ref, this.boldOrderId);

        const data = await this.checkout.obtenerPedido(this.token);
        if (data) this.aplicar(data);
        else this.programarSondeo();
      } catch {
        // Un fallo puntual de red no cambia el estado: se sigue esperando.
        this.programarSondeo();
      }
    }, SONDEO_MS);
  }

  private detenerSondeo(): void {
    if (this.sondeo) clearTimeout(this.sondeo);
    this.sondeo = null;
  }

  private aplicarSeo(titulo: string): void {
    this.seo.set({
      title:       `${titulo} — Cuaquiverso`,
      description: 'Estado de tu pedido en la tienda del Cuaquiverso.',
      canonical:   'https://cuacdesign.com/cuaquiverso/checkout/confirmacion',
      // Una confirmación de pedido no debe indexarse nunca.
      noindex:     true,
    });
  }

  fechaFormateada(): string {
    const p = this.pedido();
    if (!p) return '';
    return new Date(p.creado_en).toLocaleDateString('es-CO', {
      day: 'numeric', month: 'long', year: 'numeric',
    });
  }

  colorHex(key: string): string {
    if (!key) return '#3D4856';
    if (key.startsWith('#') || key.startsWith('rgb')) return key;
    return COLOR_MAP[key] ?? '#3D4856';
  }

  fmtPrice(n: number): string {
    return '$' + n.toLocaleString('es-CO');
  }
}
