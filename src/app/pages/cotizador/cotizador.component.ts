// src/app/pages/cotizador/cotizador.component.ts
import { Component, signal, computed, inject, ElementRef, ViewChild, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { environment } from '../../../environments/environment';
import { SeoService } from '../../core/services/seo.service';

type ServicioId = 'branding' | 'editorial' | 'web' | 'ilustracion' | 'video';
type EscalaId   = 'basico' | 'estandar' | 'completo';
interface PrecioEntry { min: number; max: number; semanas: string; }

const SERVICIOS: { id: ServicioId; label: string }[] = [
  { id: 'branding',    label: 'Branding' },
  { id: 'editorial',   label: 'Editorial' },
  { id: 'web',         label: 'Diseño Web' },
  { id: 'ilustracion', label: 'Ilustración' },
  { id: 'video',       label: 'Video & Movimiento' },
];

const ESCALAS: { id: EscalaId; label: string }[] = [
  { id: 'basico',    label: 'Básico' },
  { id: 'estandar',  label: 'Estándar' },
  { id: 'completo',  label: 'Completo' },
];

const PRECIO_MATRIX: Record<ServicioId, Record<EscalaId, PrecioEntry>> = {
  branding:    { basico: { min: 2_000_000,  max: 4_000_000,  semanas: '2–3'  }, estandar: { min: 4_000_000, max: 8_000_000,  semanas: '4–6'  }, completo: { min: 8_000_000,  max: 18_000_000, semanas: '8–14'  } },
  editorial:   { basico: { min: 1_500_000,  max: 3_000_000,  semanas: '1–2'  }, estandar: { min: 3_000_000, max: 6_000_000,  semanas: '3–5'  }, completo: { min: 6_000_000,  max: 12_000_000, semanas: '6–10'  } },
  web:         { basico: { min: 2_000_000,  max: 4_000_000,  semanas: '2–3'  }, estandar: { min: 4_000_000, max: 9_000_000,  semanas: '4–7'  }, completo: { min: 9_000_000,  max: 20_000_000, semanas: '8–16'  } },
  ilustracion: { basico: { min:   500_000,  max: 1_500_000,  semanas: '1–2'  }, estandar: { min: 1_500_000, max: 4_000_000,  semanas: '2–4'  }, completo: { min: 4_000_000,  max:  8_000_000, semanas: '4–8'   } },
  video:       { basico: { min:   800_000,  max: 2_000_000,  semanas: '1–2'  }, estandar: { min: 2_000_000, max: 5_000_000,  semanas: '2–4'  }, completo: { min: 5_000_000,  max: 10_000_000, semanas: '4–8'   } },
};

const INCLUYE: Record<ServicioId, string[]> = {
  branding:    ['Estrategia de marca', 'Logotipo + variantes', 'Paleta y tipografía', 'Manual de marca'],
  editorial:   ['Dirección tipográfica', 'Maquetación y rejilla', 'Revisiones incluidas', 'Export impresión y digital'],
  web:         ['Diseño UI/UX', 'Desarrollo frontend', 'Responsive', 'SEO básico'],
  ilustracion: ['Estilo definido', 'Set de piezas', 'Archivos fuente', 'Licencia de uso'],
  video:       ['Guion y storyboard', 'Producción y animación', 'Revisiones', 'Export todos los formatos'],
};

const TIMELINES = [
  'Urgente (esta semana)',
  'En el próximo mes',
  'En 2–3 meses',
  'Aún lo estoy evaluando',
];

const EDGE_URL = `${environment.supabaseUrl}/functions/v1/cotizar`;

@Component({
  selector: 'app-cotizador',
  standalone: true,
  imports: [CommonModule, RouterLink, ReactiveFormsModule],
  templateUrl: './cotizador.component.html',
  styleUrl: './cotizador.component.scss',
})
export class CotizadorComponent implements OnInit {
  @ViewChild('formSection') formSectionRef!: ElementRef;

  private fb  = inject(FormBuilder);
  private seo = inject(SeoService);

  ngOnInit(): void {
    this.seo.set({
      title:       'Cotiza tu proyecto',
      description: 'Estima el costo de tu proyecto de diseño en segundos. Branding, web, editorial e ilustración desde Bogotá.',
      canonical:   'https://cuacdesign.com/cotizar',
    });
  }

  // ── Static data ────────────────────────────────────────────────────────────
  readonly servicios = SERVICIOS;
  readonly escalas   = ESCALAS;
  readonly timelines = TIMELINES;

  // ── Estimator state ────────────────────────────────────────────────────────
  selectedService = signal<ServicioId>('branding');
  selectedScale   = signal<EscalaId>('estandar');
  showResult      = signal(false);

  resultado = computed(() => PRECIO_MATRIX[this.selectedService()][this.selectedScale()]);
  incluye   = computed(() => INCLUYE[this.selectedService()]);

  rangoLabel = computed(() => {
    const r = this.resultado();
    return `${this.fmtCOP(r.min)} – ${this.fmtCOP(r.max)}`;
  });

  servicioLabel = computed(() => SERVICIOS.find(s => s.id === this.selectedService())?.label ?? '');
  escalaLabel   = computed(() => ESCALAS.find(e => e.id === this.selectedScale())?.label ?? '');

  // ── Form visibility ────────────────────────────────────────────────────────
  formVisible = signal(false);
  submitting  = signal(false);
  submitted   = signal(false);
  submitError = signal<string | null>(null);

  // ── Form ───────────────────────────────────────────────────────────────────
  formServicios = signal<ServicioId[]>([]);

  form = this.fb.group({
    nombre:      ['', [Validators.required]],
    email:       ['', [Validators.required, Validators.email]],
    empresa:     ['', [Validators.required]],
    telefono:    [''],
    descripcion: ['', [Validators.required]],
    presupuesto: [''],
    timeline:    [''],
  });

  // ── Methods ────────────────────────────────────────────────────────────────
  selectService(id: ServicioId) {
    this.selectedService.set(id);
    this.showResult.set(false);
  }

  selectScale(id: EscalaId) {
    this.selectedScale.set(id);
    this.showResult.set(false);
  }

  verEstimado() {
    this.showResult.set(true);
  }

  revealForm() {
    this.formServicios.set([this.selectedService()]);
    if (this.showResult()) {
      this.form.patchValue({ presupuesto: this.rangoLabel() });
    }
    this.formVisible.set(true);
    setTimeout(() => {
      this.formSectionRef?.nativeElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 50);
  }

  toggleFormServicio(id: ServicioId) {
    const curr = this.formServicios();
    this.formServicios.set(curr.includes(id) ? curr.filter(s => s !== id) : [...curr, id]);
  }

  isFormServicioSelected(id: ServicioId): boolean {
    return this.formServicios().includes(id);
  }

  async submitForm() {
    if (this.form.invalid || this.formServicios().length === 0) {
      this.form.markAllAsTouched();
      return;
    }
    this.submitting.set(true);
    this.submitError.set(null);

    const payload = {
      ...this.form.value,
      servicios:          this.formServicios(),
      estimador_servicio: this.selectedService(),
      estimador_escala:   this.selectedScale(),
      estimador_rango:    this.showResult() ? this.rangoLabel() : null,
    };

    try {
      const res  = await fetch(EDGE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: environment.supabaseKey },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (!data.ok) throw new Error(data.error ?? 'Error desconocido');
      this.submitted.set(true);
    } catch (err: unknown) {
      this.submitError.set(err instanceof Error ? err.message : 'Error al enviar. Intenta de nuevo.');
    } finally {
      this.submitting.set(false);
    }
  }

  fieldError(field: string): string | null {
    const ctrl = this.form.get(field);
    if (!ctrl?.touched || !ctrl.invalid) return null;
    if (ctrl.hasError('required')) return 'Este campo es requerido';
    if (ctrl.hasError('email'))    return 'Ingresa un correo válido';
    return null;
  }

  fmtCOP(n: number): string {
    return '$' + n.toLocaleString('es-CO');
  }
}
