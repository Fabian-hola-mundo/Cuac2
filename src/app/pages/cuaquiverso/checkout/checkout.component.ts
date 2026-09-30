// src/app/pages/cuaquiverso/checkout/checkout.component.ts
import { Component, OnDestroy, OnInit, PLATFORM_ID, inject, computed, signal } from '@angular/core';
import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ReactiveFormsModule, FormGroup, FormControl, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { CartService, claveLinea } from '../services/cart.service';
import { CheckoutService, CheckoutForm } from '../services/checkout.service';
import { DescuentoService } from '../services/descuento.service';
import { BoldService } from '../services/bold.service';
import {
  PedidoPendiente, leerPedidoPendiente, guardarPedidoPendiente, limpiarPedidoPendiente,
  segundosRestantes, formatoCuenta,
} from '../services/pedido-pendiente';
import { CartModalComponent } from '../cart-modal/cart-modal.component';
import { SeoService } from '../../../core/services/seo.service';
import { ENVIO_GRATIS_DESDE as UMBRAL_ENVIO_GRATIS } from '../services/tienda.constants';

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

/** Las mismas claves sin espacios, para que "Santamarta" también acierte. */
const ENVIO_COMPACTO = new Map(
  Object.entries(ENVIO_ESTIMADO).map(([k, v]) => [k.replace(/\s/g, ''), v]),
);

const ESTIMADO_RESTO_DEL_PAIS = '~$18.000 – $28.000 COP (contra entrega)';

/** "D.C.", "DC", "Distrito Capital": sufijos administrativos que no son la ciudad. */
const SUFIJO_ADMINISTRATIVO = /\s+(d\s*c|distrito\s+capital)$/;

/**
 * Normaliza cómo la gente escribe su ciudad.
 *
 * El mapa se consultaba con `toLowerCase().trim()` y las tildes quitadas, así
 * que "Bogotá D.C." —el mismo texto que ofrece el desplegable de departamento
 * dos campos más arriba— no acertaba ninguna clave y caía al estimado más caro
 * del sistema, que es justo el contrario del correcto.
 */
function claveCiudad(valor: string): string {
  return valor
    .toLowerCase()
    .normalize('NFD').replace(/\p{M}/gu, '')
    .replace(/[^a-z\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(SUFIJO_ADMINISTRATIVO, '')
    .trim();
}

function estimadoPara(valor: string): string | null {
  const clave = claveCiudad(valor);
  if (!clave) return null;
  return ENVIO_ESTIMADO[clave] ?? ENVIO_COMPACTO.get(clave.replace(/\s/g, '')) ?? null;
}

const COLOR_MAP: Record<string, string> = {
  rio: '#2A6FDB', rosa: '#FF6FA8', sol: '#FFC93C', bone: '#D4DCE4',
  terra: '#E8623D', lila: '#8B6FD8', selva: '#1F8A5B', tibu: '#2E8FB8', cream: '#D8DEDE',
};

/**
 * El formulario sobrevive a un F5 o a un ida y vuelta a la tienda, pero muere
 * con la pestaña: son doce campos con nombre, dirección y documento, y dejarlos
 * en `localStorage` los expondría al siguiente que use un computador prestado.
 */
const CLAVE_FORM = 'cuaquiverso.checkout.form.v1';

/** Etiquetas para el resumen de errores; el `id` del control es la clave. */
const NOMBRES_CAMPO: Record<string, string> = {
  nombre: 'Nombre', apellido: 'Apellido', email: 'Correo electrónico',
  celular: 'Celular', tipoDoc: 'Tipo de documento', numDoc: 'Número de documento',
  departamento: 'Departamento', ciudad: 'Ciudad', direccion: 'Dirección',
};

@Component({
  selector: 'app-checkout',
  standalone: true,
  imports: [ReactiveFormsModule, CartModalComponent, RouterLink],
  templateUrl: './checkout.component.html',
  styleUrl: './checkout.component.scss',
})
export class CheckoutComponent implements OnInit, OnDestroy {
  readonly cart     = inject(CartService);
  readonly checkout = inject(CheckoutService);
  readonly descuento = inject(DescuentoService);
  private  bold      = inject(BoldService);
  private  seo       = inject(SeoService);
  private  router    = inject(Router);
  private  doc       = inject(DOCUMENT);
  private  esNavegador = isPlatformBrowser(inject(PLATFORM_ID));

  readonly ENVIO_GRATIS_DESDE = UMBRAL_ENVIO_GRATIS;

  /** Dos variantes del mismo producto comparten id: la línea se identifica por ambos. */
  readonly claveLinea = claveLinea;

  private ciudadActual = signal('');
  private deptoActual  = signal('');

  codigoInput       = '';
  descuentoExpanded = signal(false);

  /** Se enciende al enviar con campos inválidos; se anuncia junto al botón. */
  readonly resumenErrores = signal<string | null>(null);

  /**
   * Bold está abierto (o se abrió y el comprador cerró el modal). El pedido ya
   * existe en 'pendiente', así que la pantalla no puede volver al estado inicial
   * como si no hubiera pasado nada.
   */
  readonly pagoEnCurso      = signal(false);
  readonly referenciaEnCurso = signal<string | null>(null);

  /** Pedido con stock apartado; sobrevive a recargas vía localStorage. */
  private pedidoCreado: PedidoPendiente | null = null;

  readonly segundosReserva = signal(0);
  readonly cuentaReserva   = computed(() => formatoCuenta(this.segundosReserva()));
  readonly reservaVencida  = signal(false);
  /**
   * Bold se abrió en esta visita. Tras una recarga el pedido sigue apartado
   * pero la ventana de pago no está abierta, y el panel no debe decir que sí.
   */
  readonly boldAbierto     = signal(false);
  private  reloj: ReturnType<typeof setInterval> | null = null;

  private get storage(): Storage | null {
    if (!this.esNavegador) return null;
    try {
      return this.doc.defaultView?.localStorage ?? null;
    } catch {
      // Almacenamiento bloqueado: acceder a localStorage lanza SecurityError.
      return null;
    }
  }

  private sondeo: ReturnType<typeof setTimeout> | null = null;

  readonly totalFinal = computed(() =>
    Math.max(0, this.cart.total() - this.descuento.montoDescuento())
  );

  readonly envioGratis = computed(() => this.cart.total() >= this.ENVIO_GRATIS_DESDE);

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

  /**
   * Con envío gratis el estimado no aplica: antes esta caja anunciaba
   * "~$8.000 – $12.000 (contra entrega)" justo encima del banner que prometía
   * "Envío gratis", y el comprador no tenía forma de saber cuál de las dos
   * valía.
   */
  estimadoTexto = computed(() => {
    if (this.envioGratis()) return 'Gratis — el transporte va por nuestra cuenta.';

    const porCiudad = estimadoPara(this.ciudadActual());
    if (porCiudad) return porCiudad;

    // "Bogotá D.C." como departamento ya identifica la ciudad.
    const porDepto = estimadoPara(this.deptoActual());
    if (porDepto) return porDepto;

    if (!this.ciudadActual().trim()) return 'Ingresa tu ciudad para ver el estimado.';
    return ESTIMADO_RESTO_DEL_PAIS;
  });

  constructor() {
    // El estimado dependía sólo de (input): un autorrelleno del navegador o un
    // pegado con el mouse no disparan ese evento y lo dejaban congelado en
    // "Ingresa tu ciudad para ver el estimado".
    this.form.controls.ciudad.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe(v => this.ciudadActual.set(v ?? ''));

    this.form.controls.departamento.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe(v => this.deptoActual.set(v ?? ''));

    this.form.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe(() => {
        this.guardarFormulario();
        // El resumen de errores se apaga en cuanto empiezan a corregir.
        if (this.resumenErrores() && this.form.valid) this.resumenErrores.set(null);
      });
  }

  ngOnInit(): void {
    this.seo.set({
      title:       'Checkout — Cuaquiverso',
      description: 'Completa tus datos para pagar tu pedido del Cuaquiverso. Envío a toda Colombia.',
      canonical:   'https://cuacdesign.com/cuaquiverso/checkout',
    });
    this.checkout.error.set(null);
    this.descuento.limpiar();
    this.restaurarFormulario();

    // Se trae la librería de Bold mientras el comprador rellena el formulario,
    // no después de haber creado ya el pedido.
    this.bold.precargar();

    // Volvió o recargó con un pedido apartado: se retoma, no se pierde.
    const pendiente = leerPedidoPendiente(this.storage);
    if (pendiente) this.retomar(pendiente);
  }

  ngOnDestroy(): void {
    this.detenerSondeo();
    this.detenerReloj();
  }

  touched(field: string): boolean {
    const ctrl = this.form.get(field);
    return !!(ctrl?.invalid && ctrl?.touched);
  }

  onCodigoInput(e: Event): void {
    this.codigoInput = (e.target as HTMLInputElement).value.toUpperCase();
  }

  async aplicarCodigo(): Promise<void> {
    if (!this.codigoInput.trim()) return;
    await this.descuento.aplicar(this.codigoInput, this.cart.items(), this.cart.total());
  }

  quitarCodigo(): void {
    this.codigoInput = '';
    this.descuento.limpiar();
  }

  colorHex(key: string): string {
    if (!key) return '#3D4856';
    if (key.startsWith('#') || key.startsWith('rgb')) return key;
    return COLOR_MAP[key] ?? '#3D4856';
  }

  /** Abre el panel del carrito para corregir cantidades sin salir del checkout. */
  editarCarrito(): void {
    this.cart.open();
  }

  /**
   * Identifica formulario + carrito + descuento con que se crea un pedido. La
   * usan `pagar()` y `reabrirPago()`: si cambia, el pedido apartado ya no es el
   * que el comprador está viendo.
   */
  private datosDelPago(): {
    form: CheckoutForm; codigoDesc: { codigo: string; monto: number } | undefined; huella: string;
  } {
    const codigoDesc = this.descuento.codigoAplicado()
      ? { codigo: this.descuento.codigoAplicado()!, monto: this.descuento.montoDescuento() }
      : undefined;
    const form = this.form.getRawValue() as CheckoutForm;
    const huella = JSON.stringify([form, this.cart.items(), this.cart.total(), codigoDesc ?? null]);
    return { form, codigoDesc, huella };
  }

  /**
   * @param reemplazarEnCurso lo pasa `reabrirPago()` cuando el pedido apartado
   * ya no coincide con el carrito: se cancela y se crea uno nuevo.
   */
  async pagar(reemplazarEnCurso = false): Promise<void> {
    this.form.markAllAsTouched();

    if (this.form.invalid) {
      // Sin esto, en móvil pulsar "Pagar" no producía ningún cambio visible: el
      // botón vive al final de la columna y los mensajes se encendían a un par
      // de pantallas de scroll por encima.
      this.resumenErrores.set(this.mensajeDeErroresPendientes());
      this.enfocarPrimerCampoInvalido();
      return;
    }

    // Dos toques seguidos en un móvil abrían dos modales de Bold encima.
    if (this.checkout.loading() || (this.pagoEnCurso() && !reemplazarEnCurso)) return;

    this.resumenErrores.set(null);
    this.checkout.loading.set(true);
    this.checkout.error.set(null);

    try {
      const { form, codigoDesc, huella } = this.datosDelPago();

      // El modal de Bold se cierra sin salir del sitio, así que reintentar es
      // fácil y frecuente. Sin esto, cada reintento crearía otro pedido y
      // quemaría otro uso del código de descuento. La huella se invalida sola
      // cuando el pedido deja de estar 'pendiente' (ver `revisarEstado`), para
      // que un pago rechazado no reabra Bold con una orden ya resuelta.
      let bold = this.pedidoCreado?.huella === huella ? this.pedidoCreado.bold : null;

      if (!bold) {
        // Un pedido anterior con otro carrito no debe seguir apartando stock.
        if (this.pedidoCreado) {
          await this.checkout.cancelarPedidoPendiente(this.pedidoCreado.token).catch(() => false);
          limpiarPedidoPendiente(this.storage);
          this.pedidoCreado = null;
          // Si crear el nuevo falla, el panel no debe quedar mostrando uno cancelado.
          this.detenerSondeo();
          this.detenerReloj();
          this.pagoEnCurso.set(false);
          this.referenciaEnCurso.set(null);
          this.boldAbierto.set(false);
        }
        const creado = await this.checkout.crearPedido(form, this.cart.items(), this.cart.total(), codigoDesc);
        this.pedidoCreado = {
          token: creado.token, referencia: creado.referencia, expiraEn: creado.reservaExpiraEn,
          huella, bold: creado.bold, descuento: codigoDesc,
        };
        guardarPedidoPendiente(this.storage, this.pedidoCreado);
        bold = creado.bold;
      }

      await this.bold.abrirCheckout(bold);

      this.boldAbierto.set(true);
      this.referenciaEnCurso.set(bold.orderId);
      this.pagoEnCurso.set(true);
      this.reservaVencida.set(false);
      this.iniciarReloj();
      this.iniciarSondeo(this.pedidoCreado!.token);
    } catch (e: any) {
      this.checkout.error.set(e?.message ?? 'Error al procesar el pedido. Intenta de nuevo.');
    } finally {
      this.checkout.loading.set(false);
    }
  }

  /**
   * "Continuar pago": vuelve a abrir Bold con el pedido apartado, salvo que el
   * carrito o el formulario hayan cambiado desde que se creó; entonces cobrar
   * esa orden sería cobrar otra cosa, y se delega en `pagar()` para que la
   * cancele y cree una nueva.
   */
  async reabrirPago(): Promise<void> {
    const p = this.pedidoCreado;
    if (!p || this.checkout.loading()) return;

    if (this.datosDelPago().huella !== p.huella) {
      await this.pagar(true);
      return;
    }

    this.checkout.loading.set(true);
    this.checkout.error.set(null);
    try {
      await this.bold.abrirCheckout(p.bold);
      this.boldAbierto.set(true);
    } catch (e: any) {
      this.checkout.error.set(e?.message ?? 'No pudimos reabrir la pasarela de pagos.');
    } finally {
      this.checkout.loading.set(false);
    }
  }

  /** "Cancelar y liberar": devuelve lo apartado y deja editar el pedido. */
  async cancelarIntento(): Promise<void> {
    const p = this.pedidoCreado;
    this.detenerSondeo();
    this.detenerReloj();
    this.pagoEnCurso.set(false);
    this.boldAbierto.set(false);
    this.referenciaEnCurso.set(null);
    this.pedidoCreado = null;
    limpiarPedidoPendiente(this.storage);
    if (p) {
      try { await this.checkout.cancelarPedidoPendiente(p.token); }
      catch (e: any) { this.checkout.error.set(e?.message ?? 'No pudimos liberar tu reserva.'); }
    }
  }

  // ── Reserva de stock (15 min) ───────────────────────────────────────────────

  private retomar(p: PedidoPendiente): void {
    this.pedidoCreado = p;
    // El descuento entra en la huella: sin reponerlo, "Continuar pago" vería
    // otro pedido y cancelaría éste (cuyo uso del código ya se gastó).
    if (p.descuento) {
      this.descuento.restaurar(p.descuento.codigo, p.descuento.monto);
      this.codigoInput = p.descuento.codigo;
    }
    this.boldAbierto.set(false);
    this.referenciaEnCurso.set(p.referencia);
    this.pagoEnCurso.set(true);
    this.reservaVencida.set(false);
    this.iniciarReloj();
    this.iniciarSondeo(p.token);
  }

  private iniciarReloj(): void {
    this.detenerReloj();
    if (!this.esNavegador || !this.pedidoCreado) return;
    const tick = () => {
      const s = segundosRestantes(this.pedidoCreado!.expiraEn);
      this.segundosReserva.set(s);
      if (s <= 0) this.alVencer();
    };
    tick();
    this.reloj = setInterval(tick, 1000);
  }

  private detenerReloj(): void {
    if (this.reloj) clearInterval(this.reloj);
    this.reloj = null;
  }

  /** La reserva venció: el carrito queda intacto para volver a intentarlo. */
  private alVencer(): void {
    this.detenerReloj();
    this.detenerSondeo();
    limpiarPedidoPendiente(this.storage);
    this.pedidoCreado = null;
    this.pagoEnCurso.set(false);
    this.boldAbierto.set(false);
    this.referenciaEnCurso.set(null);
    this.reservaVencida.set(true);
  }

  // ── Estado del pedido mientras Bold está abierto ────────────────────────────
  //
  // La librería de Bold no avisa de que el comprador cerró el modal, así que la
  // única señal fiable de qué pasó es el propio pedido: el webhook lo mueve a
  // 'aprobado' o 'rechazado'. Se pregunta cada vez más despacio y se deja de
  // preguntar a los 15 minutos, cuando vence la reserva de stock.

  private iniciarSondeo(token: string | null): void {
    this.detenerSondeo();
    if (!token || !this.esNavegador) return;

    const inicio = Date.now();

    const siguiente = () => {
      const espera = this.intervaloSondeo(Date.now() - inicio);
      if (espera === null) return;
      this.sondeo = setTimeout(async () => {
        const seguir = await this.revisarEstado(token);
        if (seguir) siguiente();
      }, espera);
    };

    siguiente();
  }

  private intervaloSondeo(transcurridoMs: number): number | null {
    if (transcurridoMs <  60_000) return  4_000;
    if (transcurridoMs < 240_000) return 10_000;
    if (transcurridoMs < 900_000) return 30_000;
    return null;
  }

  /** Devuelve false cuando ya no hay nada más que esperar. */
  private async revisarEstado(token: string): Promise<boolean> {
    let pedido;
    try {
      pedido = await this.checkout.obtenerPedido(token);
    } catch {
      // Un corte de red no significa que el pago fallara: se reintenta.
      return true;
    }
    if (!pedido) return false;

    if (pedido.estado === 'aprobado') {
      this.detenerSondeo();
      limpiarPedidoPendiente(this.storage);
      this.detenerReloj();
      // Bold normalmente redirige solo; esto rescata a quien cerró el modal
      // después de pagar y se quedó mirando el checkout.
      this.router.navigate(['/cuaquiverso/checkout/confirmacion'], { queryParams: { ref: token } });
      return false;
    }

    if (pedido.estado === 'rechazado' || pedido.estado === 'cancelado') {
      this.detenerSondeo();
      limpiarPedidoPendiente(this.storage);
      this.detenerReloj();
      this.pagoEnCurso.set(false);
      this.boldAbierto.set(false);
      this.referenciaEnCurso.set(null);
      // Se descarta el pedido resuelto: el siguiente intento crea una orden
      // nueva en vez de reabrir Bold con un orderId que ya tiene desenlace.
      this.pedidoCreado = null;
      this.checkout.error.set(
        pedido.estado === 'rechazado'
          ? 'El pago fue rechazado. Puedes intentarlo de nuevo con otro medio de pago.'
          : 'El pago se anuló. Puedes intentarlo de nuevo cuando quieras.',
      );
      return false;
    }

    return true;
  }

  private detenerSondeo(): void {
    if (this.sondeo) clearTimeout(this.sondeo);
    this.sondeo = null;
  }

  // ── Validación visible ──────────────────────────────────────────────────────

  private mensajeDeErroresPendientes(): string {
    const faltantes = Object.keys(this.form.controls)
      .filter(k => this.form.get(k)?.invalid)
      .map(k => NOMBRES_CAMPO[k] ?? k);

    if (faltantes.length === 0) return 'Revisa los datos del formulario.';
    if (faltantes.length === 1) return `Falta completar: ${faltantes[0]}.`;
    return `Faltan ${faltantes.length} campos por completar: ${faltantes.join(', ')}.`;
  }

  private enfocarPrimerCampoInvalido(): void {
    if (!this.esNavegador) return;
    const primero = Object.keys(this.form.controls).find(k => this.form.get(k)?.invalid);
    if (!primero) return;

    const el = this.doc.getElementById(primero);
    if (!el) return;

    const reduce = this.doc.defaultView?.matchMedia('(prefers-reduced-motion: reduce)').matches;
    el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'center' });
    // preventScroll para que el foco no pelee con el desplazamiento suave.
    (el as HTMLElement).focus({ preventScroll: true });
  }

  // ── Persistencia del formulario ─────────────────────────────────────────────

  private guardarFormulario(): void {
    if (!this.esNavegador) return;
    try {
      this.doc.defaultView?.sessionStorage.setItem(
        CLAVE_FORM, JSON.stringify(this.form.getRawValue()),
      );
    } catch {
      // Modo incógnito o almacenamiento bloqueado: se sigue sin persistencia.
    }
  }

  private restaurarFormulario(): void {
    if (!this.esNavegador) return;
    try {
      const crudo = this.doc.defaultView?.sessionStorage.getItem(CLAVE_FORM);
      if (!crudo) return;
      const guardado = JSON.parse(crudo);
      if (!guardado || typeof guardado !== 'object') return;
      // patchValue ignora claves ajenas y no marca nada como touched, así que
      // el formulario restaurado no aparece en rojo.
      this.form.patchValue(guardado);
      this.ciudadActual.set(this.form.controls.ciudad.value);
      this.deptoActual.set(this.form.controls.departamento.value);
    } catch {
      // Un JSON corrupto no debe impedir comprar.
    }
  }
}
