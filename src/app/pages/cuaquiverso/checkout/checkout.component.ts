import { Component, OnInit, inject, computed, signal } from '@angular/core';
import { ReactiveFormsModule, FormGroup, FormControl, Validators } from '@angular/forms';
import { CartService } from '../services/cart.service';
import { CheckoutService, CheckoutForm } from '../services/checkout.service';
import { CartModalComponent } from '../cart-modal/cart-modal.component';
import { SeoService } from '../../../core/services/seo.service';

const ENVIO_ESTIMADO: Record<string, string> = {
  'bogota':        '~$8.000 – $12.000 COP (contra entrega)',
  'medellin':      '~$12.000 – $16.000 COP (contra entrega)',
  'cali':          '~$12.000 – $16.000 COP (contra entrega)',
  'barranquilla':  '~$14.000 – $18.000 COP (contra entrega)',
  'cartagena':     '~$14.000 – $18.000 COP (contra entrega)',
  'bucaramanga':   '~$12.000 – $16.000 COP (contra entrega)',
  'pereira':       '~$12.000 – $16.000 COP (contra entrega)',
  'manizales':     '~$12.000 – $16.000 COP (contra entrega)',
  'armenia':       '~$12.000 – $16.000 COP (contra entrega)',
  'ibague':        '~$14.000 – $18.000 COP (contra entrega)',
  'cucuta':        '~$14.000 – $18.000 COP (contra entrega)',
  'villavicencio': '~$14.000 – $18.000 COP (contra entrega)',
  'neiva':         '~$16.000 – $20.000 COP (contra entrega)',
  'pasto':         '~$16.000 – $22.000 COP (contra entrega)',
  'monteria':      '~$16.000 – $20.000 COP (contra entrega)',
  'santa marta':   '~$14.000 – $18.000 COP (contra entrega)',
  'popayan':       '~$16.000 – $20.000 COP (contra entrega)',
};

const COLOR_MAP: Record<string, string> = {
  rio: '#2A6FDB', rosa: '#FF6FA8', sol: '#FFC93C', bone: '#D4DCE4',
  terra: '#E8623D', lila: '#8B6FD8', selva: '#1F8A5B', tibu: '#2E8FB8', cream: '#D8DEDE',
};

@Component({
  selector: 'app-checkout',
  standalone: true,
  imports: [ReactiveFormsModule, CartModalComponent],
  templateUrl: './checkout.component.html',
  styleUrl: './checkout.component.scss',
})
export class CheckoutComponent implements OnInit {
  readonly cart     = inject(CartService);
  readonly checkout = inject(CheckoutService);
  private  seo      = inject(SeoService);

  readonly ENVIO_GRATIS_DESDE = 150_000;

  private ciudadActual = signal('');

  form = new FormGroup({
    nombre:       new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    apellido:     new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    email:        new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.email] }),
    celular:      new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.minLength(10)] }),
    tipoDoc:      new FormControl('CC', { nonNullable: true, validators: [Validators.required] }),
    numDoc:       new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    departamento: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    ciudad:       new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    direccion:    new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    barrio:       new FormControl('', { nonNullable: true }),
    codigoPostal: new FormControl('', { nonNullable: true }),
    nota:         new FormControl('', { nonNullable: true }),
  });

  estimadoTexto = computed(() => {
    const ciudad = this.ciudadActual();
    if (!ciudad) return 'Ingresa tu ciudad para ver el estimado.';
    const key = ciudad
      .toLowerCase()
      .trim()
      .normalize('NFD')
      .replace(/\p{M}/gu, '');
    return ENVIO_ESTIMADO[key] ?? '~$18.000 – $28.000 COP (contra entrega)';
  });

  ngOnInit(): void {
    this.seo.set({
      title:       'Checkout — Cuaquiverso',
      description: 'Completa tu compra en Cuaquiverso. Envío a toda Colombia.',
      canonical:   'https://cuacdesign.com/cuaquiverso/checkout',
    });
    this.checkout.error.set(null);
  }

  touched(field: string): boolean {
    const ctrl = this.form.get(field);
    return !!(ctrl?.invalid && ctrl?.touched);
  }

  onCiudadChange(): void {
    this.ciudadActual.set(this.form.get('ciudad')?.value ?? '');
  }

  colorHex(key: string): string {
    if (!key) return '#3D4856';
    if (key.startsWith('#') || key.startsWith('rgb')) return key;
    return COLOR_MAP[key] ?? '#3D4856';
  }

  async pagar(): Promise<void> {
    this.form.markAllAsTouched();
    if (this.form.invalid) return;

    this.checkout.loading.set(true);
    this.checkout.error.set(null);

    try {
      const { wompi_url } = await this.checkout.crearPedido(
        this.form.getRawValue() as CheckoutForm,
        this.cart.items(),
        this.cart.total(),
      );
      window.location.href = wompi_url;
    } catch (e: any) {
      this.checkout.error.set(e.message ?? 'Error al procesar el pedido. Intenta de nuevo.');
      this.checkout.loading.set(false);
    }
  }
}
