# Cotizador Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Crear la página `/cotizar` con estimador rápido de precios y formulario de cotización personalizada que guarda en Supabase y notifica por email vía Resend, más la vista de administración `/admin/cotizaciones`.

**Architecture:** Página Angular standalone con señales y Reactive Forms. El formulario se oculta hasta que el cliente lo pide. El submit llama a una Supabase Edge Function que inserta en BD y llama a Resend. El admin lee la tabla `cotizaciones` directamente con el cliente Supabase.

**Tech Stack:** Angular 17+ (signals, `@if`/`@for`, Reactive Forms), Supabase JS v2, Supabase Edge Functions (Deno), Resend API, SCSS con tokens CSS del proyecto.

---

## Archivos

| Acción | Archivo |
|---|---|
| Crear | `supabase/migrations/002_cotizaciones.sql` |
| Crear | `supabase/functions/cotizar/index.ts` |
| Crear | `src/app/pages/cotizador/cotizador.component.ts` |
| Crear | `src/app/pages/cotizador/cotizador.component.html` |
| Crear | `src/app/pages/cotizador/cotizador.component.scss` |
| Crear | `src/app/pages/admin/cotizaciones/cotizaciones-list.component.ts` |
| Crear | `src/app/pages/admin/cotizaciones/cotizaciones-list.component.html` |
| Crear | `src/app/pages/admin/cotizaciones/cotizaciones-list.component.scss` |
| Modificar | `src/app/app.routes.ts` |
| Modificar | `src/app/layout/topbar/topbar.component.html` |
| Modificar | `src/app/pages/admin/admin-shell.component.ts` |

---

## Task 1: Migración SQL — tabla `cotizaciones`

**Files:**
- Create: `supabase/migrations/002_cotizaciones.sql`

- [ ] **Step 1: Crear el archivo de migración**

```sql
-- supabase/migrations/002_cotizaciones.sql

CREATE TABLE cotizaciones (
  id                 uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at         timestamptz NOT NULL DEFAULT now(),
  nombre             text        NOT NULL,
  email              text        NOT NULL,
  empresa            text        NOT NULL,
  telefono           text,
  servicios          text[]      NOT NULL,
  descripcion        text        NOT NULL,
  presupuesto        text,
  timeline           text,
  estimador_servicio text,
  estimador_escala   text,
  estimador_rango    text,
  estado             text        NOT NULL DEFAULT 'pendiente'
    CHECK (estado IN ('pendiente', 'respondida', 'descartada'))
);

CREATE INDEX idx_cotizaciones_estado     ON cotizaciones(estado);
CREATE INDEX idx_cotizaciones_created_at ON cotizaciones(created_at DESC);

ALTER TABLE cotizaciones ENABLE ROW LEVEL SECURITY;

-- Cualquier visitante puede insertar (formulario público)
CREATE POLICY "cotizaciones_insert_anon" ON cotizaciones
  FOR INSERT TO anon WITH CHECK (true);

-- Solo el usuario autenticado del estudio puede leer y actualizar
CREATE POLICY "cotizaciones_select_admin" ON cotizaciones
  FOR SELECT USING (auth.email() = 'designcuac@gmail.com');

CREATE POLICY "cotizaciones_update_admin" ON cotizaciones
  FOR UPDATE USING (auth.email() = 'designcuac@gmail.com');
```

- [ ] **Step 2: Aplicar la migración en Supabase**

Opción A — Supabase MCP (si está disponible):
```
Usar mcp__claude_ai_Supabase__apply_migration con el SQL anterior
```

Opción B — CLI:
```bash
supabase db push
```

Opción C — Dashboard: copiar y pegar en SQL Editor de `https://supabase.com/dashboard`.

- [ ] **Step 3: Verificar la tabla existe**

En el Supabase Dashboard → Table Editor, confirmar que aparece `cotizaciones` con las columnas correctas y las 3 políticas RLS activas.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/002_cotizaciones.sql
git commit -m "feat: add cotizaciones table with RLS"
```

---

## Task 2: Supabase Edge Function `cotizar`

**Files:**
- Create: `supabase/functions/cotizar/index.ts`

**Prerequisito:** Tener la API key de Resend. Ir a `resend.com`, crear una key y guardarla. Luego en Supabase Dashboard → Edge Functions → Secrets, agregar `RESEND_API_KEY=<tu_key>`.

**Nota sobre el `from`:** Resend requiere un dominio verificado. Si `cuacdesign.com` no está verificado en Resend, usar `onboarding@resend.dev` temporalmente para pruebas.

- [ ] **Step 1: Crear el directorio y archivo**

```bash
mkdir -p supabase/functions/cotizar
```

- [ ] **Step 2: Escribir la Edge Function**

```typescript
// supabase/functions/cotizar/index.ts
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS })
  }

  try {
    const body = await req.json()
    const { nombre, email, empresa, servicios, descripcion } = body

    if (!nombre || !email || !empresa || !Array.isArray(servicios) || servicios.length === 0 || !descripcion) {
      return json({ ok: false, error: 'Faltan campos requeridos' }, 400)
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    const { data, error } = await supabase
      .from('cotizaciones')
      .insert([{
        nombre,
        email,
        empresa,
        telefono:           body.telefono           ?? null,
        servicios,
        descripcion,
        presupuesto:        body.presupuesto        ?? null,
        timeline:           body.timeline           ?? null,
        estimador_servicio: body.estimador_servicio ?? null,
        estimador_escala:   body.estimador_escala   ?? null,
        estimador_rango:    body.estimador_rango    ?? null,
      }])
      .select('id')
      .single()

    if (error) throw error

    // Send notification email — non-blocking failure
    await sendEmail({
      to:      'hola@cuacdesign.com',
      subject: `Nueva cotización de ${empresa} — ${servicios.join(', ')}`,
      html:    buildHtml(body),
    }).catch(err => console.error('Resend error (non-fatal):', err))

    return json({ ok: true, id: data.id })

  } catch (err) {
    console.error(err)
    return json({ ok: false, error: 'Error interno del servidor' }, 500)
  }
})

async function sendEmail(opts: { to: string; subject: string; html: string }) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${Deno.env.get('RESEND_API_KEY')}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'Cuac Design <cotizador@cuacdesign.com>',
      to:   opts.to,
      subject: opts.subject,
      html: opts.html,
    }),
  })
  if (!res.ok) throw new Error(await res.text())
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildHtml(b: Record<string, any>): string {
  const row = (label: string, value: unknown) =>
    `<tr><td style="padding:6px 12px;color:#6b7280;font-size:13px">${label}</td><td style="padding:6px 12px;font-size:13px">${value ?? '—'}</td></tr>`

  return `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
      <div style="background:#151F28;padding:20px 24px;border-radius:8px 8px 0 0">
        <h1 style="color:white;font-size:20px;margin:0">Nueva cotización</h1>
        <p style="color:#9ca3af;font-size:13px;margin:4px 0 0">Cuac Design · cotizador</p>
      </div>
      <table style="width:100%;border-collapse:collapse;background:white;border:1px solid #e5e7eb">
        ${row('Nombre', b['nombre'])}
        ${row('Email', b['email'])}
        ${row('Empresa', b['empresa'])}
        ${row('Teléfono', b['telefono'])}
        ${row('Servicios', Array.isArray(b['servicios']) ? b['servicios'].join(', ') : b['servicios'])}
        ${row('Descripción', b['descripcion'])}
        ${row('Presupuesto', b['presupuesto'])}
        ${row('Timeline', b['timeline'])}
        ${row('Estimador — Servicio', b['estimador_servicio'])}
        ${row('Estimador — Escala', b['estimador_escala'])}
        ${row('Estimador — Rango', b['estimador_rango'])}
      </table>
      <div style="background:#f3f4f6;padding:12px 24px;border-radius:0 0 8px 8px;font-size:12px;color:#9ca3af">
        Responde en menos de 2 días hábiles · hola@cuacdesign.com
      </div>
    </div>
  `
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
}
```

- [ ] **Step 3: Desplegar la Edge Function**

```bash
supabase functions deploy cotizar --no-verify-jwt
```

El flag `--no-verify-jwt` permite llamadas anónimas desde el formulario público.

- [ ] **Step 4: Probar la función con curl**

```bash
curl -X POST https://ytqcwrjxlnlsjgnjxiiw.supabase.co/functions/v1/cotizar \
  -H "apikey: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl0cWN3cmp4bG5sc2pnbmp4aWl3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk0MTE1MzMsImV4cCI6MjA5NDk4NzUzM30.hW01ztylAFWhy3bAjJXPl4Q8wh2YP_DbpR2oaXWHxVs" \
  -H "Content-Type: application/json" \
  -d '{"nombre":"Test","email":"test@test.com","empresa":"TestCo","servicios":["branding"],"descripcion":"Prueba de integración"}'
```

Respuesta esperada: `{"ok":true,"id":"<uuid>"}`

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/cotizar/index.ts
git commit -m "feat: add cotizar edge function with Supabase insert and Resend email"
```

---

## Task 3: `CotizadorComponent` — TypeScript

**Files:**
- Create: `src/app/pages/cotizador/cotizador.component.ts`

- [ ] **Step 1: Crear el directorio**

```bash
mkdir -p src/app/pages/cotizador
```

- [ ] **Step 2: Escribir el componente**

```typescript
// src/app/pages/cotizador/cotizador.component.ts
import { Component, signal, computed, inject, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { environment } from '../../../environments/environment';

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
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './cotizador.component.html',
  styleUrl: './cotizador.component.scss',
})
export class CotizadorComponent {
  @ViewChild('formSection') formSectionRef!: ElementRef;

  private fb = inject(FormBuilder);

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
```

- [ ] **Step 3: Commit**

```bash
git add src/app/pages/cotizador/cotizador.component.ts
git commit -m "feat: add CotizadorComponent skeleton"
```

---

## Task 4: `CotizadorComponent` — HTML template

**Files:**
- Create: `src/app/pages/cotizador/cotizador.component.html`

- [ ] **Step 1: Escribir el template completo**

```html
<!-- src/app/pages/cotizador/cotizador.component.html -->
<div class="cotizador-page">

  <!-- ── Hero ─────────────────────────────────────────────────────────────── -->
  <section class="cot-hero">
    <div class="cot-hero-inner">
      <div class="eyebrow">
        <span class="pulse"></span>
        Estimador · Cuac Design
      </div>
      <h1>¿Cuánto cuesta <em>tu proyecto</em>?</h1>
      <p class="cot-hero-sub">Dos preguntas. Un rango al instante. Sin compromiso.</p>
    </div>
  </section>

  <!-- ── Estimador rápido ──────────────────────────────────────────────────── -->
  <section class="cot-estimator">
    <div class="cot-inner">
      <div class="section-eyebrow">
        <span class="dot"></span> 01 &mdash; Estimador rápido
      </div>

      <div class="est-grid">
        <!-- Servicio -->
        <div class="est-block">
          <div class="est-lbl">¿Qué necesitas?</div>
          <div class="chips">
            @for (s of servicios; track s.id) {
              <button
                class="chip"
                [class.is-on]="selectedService() === s.id"
                (click)="selectService(s.id)">
                {{ s.label }}
              </button>
            }
          </div>
        </div>

        <!-- Escala -->
        <div class="est-block">
          <div class="est-lbl">Escala del proyecto</div>
          <div class="scope-row">
            @for (e of escalas; track e.id) {
              <button
                class="scope-btn"
                [class.is-on]="selectedScale() === e.id"
                (click)="selectScale(e.id)">
                {{ e.label }}
              </button>
            }
          </div>
        </div>
      </div>

      <!-- CTA estimador -->
      <button class="est-submit" (click)="verEstimado()">
        <span class="est-submit-label">Listo &mdash; ver mi estimado</span>
        <span class="est-submit-arrow">&#9889;</span>
      </button>

      <!-- Resultado -->
      @if (showResult()) {
        <div class="result-card">
          <div class="result-left">
            <div class="result-eyebrow">Rango estimado &middot; {{ servicioLabel() }} {{ escalaLabel() }}</div>
            <div class="result-price">{{ rangoLabel() }}</div>
            <div class="result-sub">COP &middot; sin IVA</div>
          </div>
          <div class="result-tag">{{ resultado().semanas }} semanas</div>
        </div>
        <div class="includes">
          @for (item of incluye(); track item) {
            <div class="inc-item">
              <span class="inc-arrow">&rarr;</span>
              {{ item }}
            </div>
          }
        </div>
      }
    </div>
  </section>

  <!-- ── CTA para formulario ──────────────────────────────────────────────── -->
  <section class="cot-cta-zone">
    <div class="cot-inner">
      <div class="cta-card">
        <div class="cta-copy">
          <strong>¿Quieres una cotización 100% personalizada?</strong>
          <p>Te respondemos en <strong>2 días hábiles</strong> con una propuesta a la medida de tu proyecto.</p>
        </div>
        @if (!formVisible()) {
          <button class="btn-cot-reveal" (click)="revealForm()">
            Quiero cotización &rarr;
          </button>
        }
      </div>
      <p class="cta-alt">
        O escríbenos directo a
        <a href="mailto:hola@cuacdesign.com">hola&#64;cuacdesign.com</a>
      </p>
    </div>
  </section>

  <!-- ── Formulario detallado ──────────────────────────────────────────────── -->
  @if (formVisible()) {
    <section class="cot-form" #formSection>
      <div class="cot-inner">
        <div class="section-eyebrow">
          <span class="dot" style="background:var(--ember)"></span> 02 &mdash; Cotización personalizada
        </div>
        <h2 class="form-h">Cuéntanos sobre tu proyecto</h2>

        @if (submitted()) {
          <!-- Estado: enviado -->
          <div class="form-success">
            <div class="form-success-icon">&#10003;</div>
            <h3>¡Solicitud enviada!</h3>
            <p>Tu cotización está en nuestras manos.<br>
              Te respondemos a <strong>{{ form.value.email }}</strong> en menos de 2 días hábiles.</p>
            <p class="form-success-footer">— Equipo Cuac &middot; hola&#64;cuacdesign.com</p>
          </div>
        } @else {
          <form [formGroup]="form" (ngSubmit)="submitForm()" novalidate>

            <div class="form-row-2">
              <div class="form-field">
                <label class="form-lbl" for="nombre">Nombre</label>
                <input id="nombre" class="form-inp" formControlName="nombre" type="text" autocomplete="name">
                @if (fieldError('nombre')) {
                  <span class="field-err">{{ fieldError('nombre') }}</span>
                }
              </div>
              <div class="form-field">
                <label class="form-lbl" for="email">Correo electrónico</label>
                <input id="email" class="form-inp" formControlName="email" type="email" autocomplete="email">
                @if (fieldError('email')) {
                  <span class="field-err">{{ fieldError('email') }}</span>
                }
              </div>
            </div>

            <div class="form-row-2">
              <div class="form-field">
                <label class="form-lbl" for="empresa">Empresa / Marca</label>
                <input id="empresa" class="form-inp" formControlName="empresa" type="text" autocomplete="organization">
                @if (fieldError('empresa')) {
                  <span class="field-err">{{ fieldError('empresa') }}</span>
                }
              </div>
              <div class="form-field">
                <label class="form-lbl" for="telefono">Teléfono / WhatsApp <span class="opt">(opcional)</span></label>
                <input id="telefono" class="form-inp" formControlName="telefono" type="tel" autocomplete="tel">
              </div>
            </div>

            <div class="form-field">
              <div class="form-lbl">Servicio(s) que necesitas</div>
              <div class="chips">
                @for (s of servicios; track s.id) {
                  <button
                    type="button"
                    class="chip"
                    [class.is-on]="isFormServicioSelected(s.id)"
                    (click)="toggleFormServicio(s.id)">
                    {{ s.label }}
                  </button>
                }
              </div>
              @if (form.touched && formServicios().length === 0) {
                <span class="field-err">Selecciona al menos un servicio</span>
              }
            </div>

            <div class="form-field">
              <label class="form-lbl" for="descripcion">Cuéntanos sobre tu proyecto</label>
              <textarea
                id="descripcion"
                class="form-inp form-textarea"
                formControlName="descripcion"
                rows="4"
                placeholder="¿Qué quieres lograr? ¿Tienes referentes? ¿Cuál es tu timeline ideal?">
              </textarea>
              @if (fieldError('descripcion')) {
                <span class="field-err">{{ fieldError('descripcion') }}</span>
              }
            </div>

            <div class="form-row-2">
              <div class="form-field">
                <label class="form-lbl" for="presupuesto">Presupuesto aproximado <span class="opt">(opcional)</span></label>
                <input id="presupuesto" class="form-inp" formControlName="presupuesto" type="text"
                  placeholder="Ej: $4.000.000 – $8.000.000 COP">
              </div>
              <div class="form-field">
                <label class="form-lbl" for="timeline">¿Cuándo necesitas empezar? <span class="opt">(opcional)</span></label>
                <select id="timeline" class="form-inp form-select" formControlName="timeline">
                  <option value="">Selecciona una opción</option>
                  @for (t of timelines; track t) {
                    <option [value]="t">{{ t }}</option>
                  }
                </select>
              </div>
            </div>

            @if (submitError()) {
              <div class="form-error-banner">
                {{ submitError() }}
              </div>
            }

            <button type="submit" class="btn-cot-submit" [disabled]="submitting()">
              @if (submitting()) {
                <span class="spinner"></span> Enviando…
              } @else {
                Enviar solicitud de cotización &rarr;
              }
            </button>

            <p class="form-note">
              Respondemos en 2 días hábiles &middot; Bogotá GMT&minus;5 &middot; hola&#64;cuacdesign.com
            </p>

          </form>
        }
      </div>
    </section>
  }

</div>
```

- [ ] **Step 2: Commit**

```bash
git add src/app/pages/cotizador/cotizador.component.html
git commit -m "feat: add cotizador template"
```

---

## Task 5: `CotizadorComponent` — SCSS

**Files:**
- Create: `src/app/pages/cotizador/cotizador.component.scss`

- [ ] **Step 1: Escribir los estilos**

```scss
// src/app/pages/cotizador/cotizador.component.scss

.cotizador-page {
  min-height: 100vh;
  background: var(--mist);
}

// ── Shared layout ───────────────────────────────────────────────────────────
.cot-inner {
  max-width: 780px;
  margin: 0 auto;
  padding: 0 var(--s-6);
}

// ── Hero ────────────────────────────────────────────────────────────────────
.cot-hero {
  background: var(--carbon);
  padding: var(--s-9) var(--s-6) var(--s-7);

  .cot-hero-inner {
    max-width: 780px;
    margin: 0 auto;
  }

  .eyebrow {
    display: flex;
    align-items: center;
    gap: var(--s-2);
    font-size: 11px;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: rgba(255,255,255,0.5);
    margin-bottom: var(--s-4);

    .pulse {
      width: 7px;
      height: 7px;
      border-radius: 50%;
      background: var(--ember);
    }
  }

  h1 {
    font-family: var(--display);
    font-size: clamp(36px, 6vw, 60px);
    font-weight: 400;
    color: white;
    line-height: 1.1;
    margin-bottom: var(--s-4);

    em {
      color: var(--ember);
      font-style: normal;
    }
  }

  .cot-hero-sub {
    font-size: 15px;
    color: rgba(255,255,255,0.5);
    max-width: 400px;
  }
}

// ── Estimator ───────────────────────────────────────────────────────────────
.cot-estimator {
  background: white;
  padding: var(--s-7) 0;
  border-bottom: 1px solid rgba(21,31,40,0.08);
}

.section-eyebrow {
  display: flex;
  align-items: center;
  gap: var(--s-2);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--ember);
  margin-bottom: var(--s-5);

  .dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: var(--ember);
  }
}

.est-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--s-6);
  margin-bottom: var(--s-5);

  @media (max-width: 600px) {
    grid-template-columns: 1fr;
  }
}

.est-lbl {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: rgba(21,31,40,0.5);
  margin-bottom: var(--s-3);
}

// chips — shared by estimator and form
.chips {
  display: flex;
  gap: var(--s-2);
  flex-wrap: wrap;
}

.chip {
  border: 1.5px solid rgba(21,31,40,0.12);
  border-radius: var(--r-pill);
  padding: var(--s-2) var(--s-4);
  font-size: 13px;
  color: var(--carbon);
  background: transparent;
  cursor: pointer;
  transition: border-color 0.15s, background 0.15s, color 0.15s;

  &:hover { border-color: var(--ember); }

  &.is-on {
    background: var(--ember);
    border-color: var(--ember);
    color: white;
    font-weight: 600;
  }
}

.scope-row {
  display: flex;
  gap: var(--s-2);
}

.scope-btn {
  flex: 1;
  text-align: center;
  border: 1.5px solid rgba(21,31,40,0.12);
  border-radius: var(--r-md);
  padding: var(--s-3) var(--s-2);
  font-size: 13px;
  color: rgba(21,31,40,0.6);
  background: transparent;
  cursor: pointer;
  transition: all 0.15s;

  &:hover { border-color: var(--carbon); color: var(--carbon); }

  &.is-on {
    background: var(--carbon);
    border-color: var(--carbon);
    color: white;
    font-weight: 600;
  }
}

// CTA button inside estimator
.est-submit {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  background: var(--ember);
  color: white;
  border: none;
  border-radius: var(--r-md);
  padding: var(--s-4) var(--s-6);
  cursor: pointer;
  transition: opacity 0.15s, transform 0.15s;
  margin-bottom: var(--s-5);

  &:hover { opacity: 0.9; transform: translateY(-1px); }
  &:active { transform: translateY(0); }

  .est-submit-label {
    font-size: 15px;
    font-weight: 700;
  }

  .est-submit-arrow {
    font-size: 20px;
  }
}

// Result card
.result-card {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: var(--carbon);
  border-radius: var(--r-md);
  padding: var(--s-5) var(--s-6);
  margin-bottom: var(--s-4);
  animation: fadeUp 0.25s ease;

  .result-eyebrow {
    font-size: 11px;
    color: rgba(255,255,255,0.45);
    margin-bottom: var(--s-1);
  }

  .result-price {
    font-family: var(--display);
    font-size: clamp(22px, 4vw, 32px);
    color: white;
    font-weight: 400;
  }

  .result-sub {
    font-size: 11px;
    color: rgba(255,255,255,0.4);
    margin-top: var(--s-1);
  }

  .result-tag {
    background: rgba(255,255,255,0.1);
    border-radius: var(--r-sm);
    padding: var(--s-2) var(--s-3);
    font-size: 12px;
    color: rgba(255,255,255,0.6);
    white-space: nowrap;
  }
}

.includes {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--s-2) var(--s-5);
  animation: fadeUp 0.3s ease;

  @media (max-width: 480px) {
    grid-template-columns: 1fr;
  }
}

.inc-item {
  display: flex;
  gap: var(--s-2);
  font-size: 13px;
  color: rgba(21,31,40,0.7);

  .inc-arrow {
    color: var(--ember);
    font-weight: 700;
    flex-shrink: 0;
  }
}

// ── CTA zone ─────────────────────────────────────────────────────────────────
.cot-cta-zone {
  background: var(--mist);
  padding: var(--s-7) 0;
  border-top: 1px solid rgba(21,31,40,0.08);
  border-bottom: 1px solid rgba(21,31,40,0.08);
}

.cta-card {
  border: 1.5px dashed rgba(21,31,40,0.15);
  border-radius: var(--r-lg);
  padding: var(--s-5) var(--s-6);
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: var(--s-5);
  background: white;
  margin-bottom: var(--s-3);

  @media (max-width: 600px) {
    flex-direction: column;
    align-items: flex-start;
  }

  .cta-copy {
    strong { font-size: 15px; color: var(--carbon); }
    p { font-size: 13px; color: rgba(21,31,40,0.6); margin-top: var(--s-1); }
  }
}

.btn-cot-reveal {
  background: var(--carbon);
  color: white;
  border: none;
  border-radius: var(--r-md);
  padding: var(--s-3) var(--s-5);
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
  white-space: nowrap;
  transition: opacity 0.15s;

  &:hover { opacity: 0.85; }
}

.cta-alt {
  font-size: 12px;
  color: rgba(21,31,40,0.4);
  text-align: center;

  a {
    color: var(--ember);
    text-decoration: underline;
  }
}

// ── Form ─────────────────────────────────────────────────────────────────────
.cot-form {
  background: white;
  padding: var(--s-7) 0 var(--s-9);
  border-top: 3px solid var(--ember);
  animation: fadeUp 0.3s ease;
}

.form-h {
  font-family: var(--display);
  font-size: 28px;
  font-weight: 400;
  color: var(--carbon);
  margin-bottom: var(--s-6);
}

.form-row-2 {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--s-4);
  margin-bottom: var(--s-4);

  @media (max-width: 600px) {
    grid-template-columns: 1fr;
  }
}

.form-field {
  display: flex;
  flex-direction: column;
  gap: var(--s-2);
  margin-bottom: var(--s-4);
}

.form-lbl {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--carbon);

  .opt {
    font-weight: 400;
    text-transform: none;
    color: rgba(21,31,40,0.4);
    letter-spacing: 0;
  }
}

.form-inp {
  background: var(--mist);
  border: 1.5px solid rgba(21,31,40,0.1);
  border-radius: var(--r-sm);
  padding: var(--s-3) var(--s-4);
  font-size: 14px;
  font-family: var(--sans);
  color: var(--carbon);
  transition: border-color 0.15s;
  width: 100%;
  box-sizing: border-box;

  &:focus {
    outline: none;
    border-color: var(--ember);
    background: white;
  }
}

.form-textarea { resize: vertical; min-height: 96px; }
.form-select   { appearance: none; cursor: pointer; }

.field-err {
  font-size: 12px;
  color: var(--ember);
}

.form-error-banner {
  background: #fff0ed;
  border: 1.5px solid var(--ember);
  border-radius: var(--r-sm);
  padding: var(--s-3) var(--s-4);
  font-size: 13px;
  color: var(--ember);
  margin-bottom: var(--s-4);
}

.btn-cot-submit {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--s-2);
  width: 100%;
  background: var(--ember);
  color: white;
  border: none;
  border-radius: var(--r-md);
  padding: var(--s-4) var(--s-6);
  font-size: 15px;
  font-weight: 700;
  cursor: pointer;
  transition: opacity 0.15s;
  margin-bottom: var(--s-3);

  &:hover:not(:disabled) { opacity: 0.9; }
  &:disabled { opacity: 0.55; cursor: not-allowed; }
}

.spinner {
  width: 14px;
  height: 14px;
  border: 2px solid rgba(255,255,255,0.3);
  border-top-color: white;
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
  display: inline-block;
}

.form-note {
  font-size: 12px;
  color: rgba(21,31,40,0.4);
  text-align: center;
}

// ── Success state ───────────────────────────────────────────────────────────
.form-success {
  text-align: center;
  padding: var(--s-8) 0;
  animation: fadeUp 0.3s ease;

  .form-success-icon {
    width: 56px;
    height: 56px;
    background: var(--ember);
    color: white;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 24px;
    margin: 0 auto var(--s-5);
  }

  h3 {
    font-family: var(--display);
    font-size: 28px;
    font-weight: 400;
    color: var(--carbon);
    margin-bottom: var(--s-3);
  }

  p {
    font-size: 15px;
    color: rgba(21,31,40,0.65);
    line-height: 1.6;
  }

  .form-success-footer {
    font-size: 12px;
    color: rgba(21,31,40,0.35);
    margin-top: var(--s-5);
  }
}

// ── Animations ───────────────────────────────────────────────────────────────
@keyframes fadeUp {
  from { opacity: 0; transform: translateY(12px); }
  to   { opacity: 1; transform: translateY(0); }
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/pages/cotizador/cotizador.component.scss
git commit -m "feat: add cotizador styles"
```

---

## Task 6: Rutas y Topbar

**Files:**
- Modify: `src/app/app.routes.ts`
- Modify: `src/app/layout/topbar/topbar.component.html`

- [ ] **Step 1: Agregar la ruta `/cotizar` en `app.routes.ts`**

Abrir `src/app/app.routes.ts`. Agregar después de la ruta `''`:

```typescript
{
  path: 'cotizar',
  loadComponent: () =>
    import('./pages/cotizador/cotizador.component').then(m => m.CotizadorComponent),
},
```

El archivo completo queda así (fragmento relevante):

```typescript
export const routes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./pages/home/home.component').then(m => m.HomeComponent),
  },
  {
    path: 'cotizar',
    loadComponent: () =>
      import('./pages/cotizador/cotizador.component').then(m => m.CotizadorComponent),
  },
  // ... resto de rutas existentes
```

- [ ] **Step 2: Actualizar el topbar — dos cambios**

En `src/app/layout/topbar/topbar.component.html`:

**Línea 25** (desktop CTA), reemplazar:
```html
<a class="top-cta" href="#contacto">Cotiza tu proyecto</a>
```
por:
```html
<a class="top-cta" routerLink="/cotizar">Cotiza tu proyecto</a>
```

**Línea 45** (mobile CTA), reemplazar:
```html
<a class="btn btn-primary" href="#contacto" (click)="closeMenu()">Cotiza tu proyecto</a>
```
por:
```html
<a class="btn btn-primary" routerLink="/cotizar" (click)="closeMenu()">Cotiza tu proyecto</a>
```

- [ ] **Step 3: Verificar que `RouterLink` ya está importado en `TopbarComponent`**

En `src/app/layout/topbar/topbar.component.ts`, confirmar que `RouterLink` está en `imports`. Ya está (lo usa para `/cuaquiverso`), no se necesita cambio.

- [ ] **Step 4: Verificar en el navegador**

```bash
ng serve
```

Ir a `http://localhost:4200`, hacer clic en "Cotiza tu proyecto" en la topbar → debe navegar a `/cotizar` y mostrar el hero oscuro.

- [ ] **Step 5: Commit**

```bash
git add src/app/app.routes.ts src/app/layout/topbar/topbar.component.html
git commit -m "feat: register /cotizar route and update topbar links"
```

---

## Task 7: Admin — `CotizacionesListComponent`

**Files:**
- Create: `src/app/pages/admin/cotizaciones/cotizaciones-list.component.ts`
- Create: `src/app/pages/admin/cotizaciones/cotizaciones-list.component.html`
- Create: `src/app/pages/admin/cotizaciones/cotizaciones-list.component.scss`

- [ ] **Step 1: Crear el directorio**

```bash
mkdir -p src/app/pages/admin/cotizaciones
```

- [ ] **Step 2: Escribir el componente TypeScript**

```typescript
// src/app/pages/admin/cotizaciones/cotizaciones-list.component.ts
import { Component, signal, computed, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SupabaseService } from '../../../core/services/supabase.service';

interface Cotizacion {
  id: string;
  created_at: string;
  nombre: string;
  email: string;
  empresa: string;
  telefono: string | null;
  servicios: string[];
  descripcion: string;
  presupuesto: string | null;
  timeline: string | null;
  estimador_servicio: string | null;
  estimador_escala: string | null;
  estimador_rango: string | null;
  estado: 'pendiente' | 'respondida' | 'descartada';
}

type EstadoFiltro = 'todos' | 'pendiente' | 'respondida' | 'descartada';

@Component({
  selector: 'app-cotizaciones-list',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './cotizaciones-list.component.html',
  styleUrl: './cotizaciones-list.component.scss',
})
export class CotizacionesListComponent implements OnInit {
  private sb = inject(SupabaseService);

  cargando   = signal(true);
  error      = signal<string | null>(null);
  items      = signal<Cotizacion[]>([]);
  filtro     = signal<EstadoFiltro>('todos');
  expandedId = signal<string | null>(null);
  toast      = signal<string | null>(null);
  private toastTimer?: ReturnType<typeof setTimeout>;

  readonly FILTROS: { id: EstadoFiltro; label: string }[] = [
    { id: 'todos',       label: 'Todas'       },
    { id: 'pendiente',   label: 'Pendientes'  },
    { id: 'respondida',  label: 'Respondidas' },
    { id: 'descartada',  label: 'Descartadas' },
  ];

  filtradas = computed(() => {
    const f = this.filtro();
    const list = this.items();
    return f === 'todos' ? list : list.filter(c => c.estado === f);
  });

  async ngOnInit() {
    await this.cargar();
  }

  async cargar() {
    this.cargando.set(true);
    this.error.set(null);
    const { data, error } = await this.sb.db
      .from('cotizaciones')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      this.error.set(error.message);
    } else {
      this.items.set(data as Cotizacion[]);
    }
    this.cargando.set(false);
  }

  toggleExpand(id: string) {
    this.expandedId.set(this.expandedId() === id ? null : id);
  }

  async cambiarEstado(id: string, estado: 'respondida' | 'descartada') {
    const { error } = await this.sb.db
      .from('cotizaciones')
      .update({ estado })
      .eq('id', id);

    if (error) {
      this.flash('Error al actualizar');
      return;
    }
    this.items.update(list =>
      list.map(c => c.id === id ? { ...c, estado } : c)
    );
    this.flash(estado === 'respondida' ? '✓ Marcada como respondida' : '✓ Descartada');
  }

  copiarEmail(email: string) {
    navigator.clipboard.writeText(email);
    this.flash(`✓ ${email} copiado`);
  }

  flash(msg: string) {
    this.toast.set(msg);
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => this.toast.set(null), 2400);
  }

  fmtFecha(iso: string): string {
    return new Date(iso).toLocaleDateString('es-CO', {
      day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  }

  estadoBadge(estado: string): string {
    const map: Record<string, string> = {
      pendiente:  'badge-warn',
      respondida: 'badge-ok',
      descartada: 'badge-muted',
    };
    return map[estado] ?? '';
  }
}
```

- [ ] **Step 3: Escribir el HTML del admin**

```html
<!-- src/app/pages/admin/cotizaciones/cotizaciones-list.component.html -->
<div class="ph">
  <div class="ph-l">
    <div class="eyebrow"><span class="dot"></span> Diseño · Cuac</div>
    <h1>Cotizaciones</h1>
    <p class="sub">Solicitudes recibidas desde el formulario del sitio.</p>
  </div>
  <div class="ph-r">
    <button class="btn-sm ghost" (click)="cargar()">
      Actualizar
    </button>
  </div>
</div>

<!-- Filtros -->
<div class="chips" style="margin-bottom:var(--s-5)">
  @for (f of FILTROS; track f.id) {
    <button class="chip" [class.is-on]="filtro() === f.id" (click)="filtro.set(f.id)">
      {{ f.label }}
    </button>
  }
</div>

@if (cargando()) {
  <p style="color:var(--carbon-50);font-size:14px;padding:12px 0">Cargando cotizaciones…</p>
}
@if (error()) {
  <p style="color:var(--terra);font-size:14px;padding:12px 0">{{ error() }}</p>
}

@if (!cargando() && filtradas().length === 0) {
  <div class="empty">
    <p>No hay cotizaciones {{ filtro() !== 'todos' ? 'con estado "' + filtro() + '"' : '' }}.</p>
  </div>
}

@if (!cargando() && filtradas().length > 0) {
  <div class="panel">
    <table class="tbl">
      <thead>
        <tr>
          <th>Fecha</th>
          <th>Empresa</th>
          <th>Nombre</th>
          <th>Servicios</th>
          <th>Estado</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        @for (c of filtradas(); track c.id) {
          <tr class="tbl-row" [class.is-expanded]="expandedId() === c.id" (click)="toggleExpand(c.id)">
            <td class="cell-date">{{ fmtFecha(c.created_at) }}</td>
            <td class="cell-empresa"><strong>{{ c.empresa }}</strong></td>
            <td>{{ c.nombre }}</td>
            <td>
              <div class="tag-list">
                @for (s of c.servicios; track s) {
                  <span class="tag">{{ s }}</span>
                }
              </div>
            </td>
            <td>
              <span class="badge" [class]="estadoBadge(c.estado)">{{ c.estado }}</span>
            </td>
            <td class="cell-toggle">
              <span class="chevron" [class.up]="expandedId() === c.id">&#8250;</span>
            </td>
          </tr>

          <!-- Accordion detail -->
          @if (expandedId() === c.id) {
            <tr class="detail-row">
              <td colspan="6">
                <div class="detail-card">
                  <div class="detail-grid">
                    <div class="detail-field">
                      <div class="detail-lbl">Email</div>
                      <div class="detail-val">{{ c.email }}</div>
                    </div>
                    <div class="detail-field">
                      <div class="detail-lbl">Teléfono</div>
                      <div class="detail-val">{{ c.telefono || '—' }}</div>
                    </div>
                    <div class="detail-field">
                      <div class="detail-lbl">Presupuesto</div>
                      <div class="detail-val">{{ c.presupuesto || '—' }}</div>
                    </div>
                    <div class="detail-field">
                      <div class="detail-lbl">Timeline</div>
                      <div class="detail-val">{{ c.timeline || '—' }}</div>
                    </div>
                    @if (c.estimador_rango) {
                      <div class="detail-field">
                        <div class="detail-lbl">Estimador</div>
                        <div class="detail-val">{{ c.estimador_servicio }} · {{ c.estimador_escala }} · {{ c.estimador_rango }}</div>
                      </div>
                    }
                  </div>
                  <div class="detail-field" style="margin-top:12px">
                    <div class="detail-lbl">Descripción del proyecto</div>
                    <div class="detail-desc">{{ c.descripcion }}</div>
                  </div>
                  <div class="detail-actions">
                    <button class="btn-sm solid" (click)="cambiarEstado(c.id, 'respondida'); $event.stopPropagation()">
                      Marcar como respondida
                    </button>
                    <button class="btn-sm ghost" (click)="copiarEmail(c.email); $event.stopPropagation()">
                      Copiar email
                    </button>
                    <button class="btn-sm danger" (click)="cambiarEstado(c.id, 'descartada'); $event.stopPropagation()">
                      Descartar
                    </button>
                  </div>
                </div>
              </td>
            </tr>
          }
        }
      </tbody>
    </table>
  </div>
}

<!-- Toast -->
@if (toast()) {
  <div class="toast">{{ toast() }}</div>
}
```

- [ ] **Step 4: Escribir los estilos del admin**

```scss
// src/app/pages/admin/cotizaciones/cotizaciones-list.component.scss

// Page header — mismo patrón que inventario-list
.ph {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: var(--s-6);

  h1 {
    font-family: var(--display);
    font-size: 28px;
    font-weight: 400;
    color: var(--carbon);
    margin: 4px 0;
    em { color: var(--ember); font-style: normal; }
  }

  .eyebrow {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 11px;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: rgba(21,31,40,0.4);
    .dot { width: 6px; height: 6px; border-radius: 50%; background: var(--ember); }
  }

  .sub { font-size: 13px; color: rgba(21,31,40,0.5); margin: 0; }
}

.ph-l { flex: 1; }
.ph-r { display: flex; gap: 8px; align-items: center; }

// Chips filter
.chips { display: flex; gap: 6px; flex-wrap: wrap; }
.chip {
  border: 1.5px solid rgba(21,31,40,0.1);
  border-radius: 999px;
  padding: 4px 12px;
  font-size: 12px;
  background: transparent;
  cursor: pointer;
  color: rgba(21,31,40,0.6);
  transition: all 0.15s;

  &:hover { border-color: var(--ember); color: var(--ember); }
  &.is-on { background: var(--ember); border-color: var(--ember); color: white; font-weight: 600; }
}

// Buttons
.btn-sm {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  border: none;
  border-radius: 7px;
  padding: 5px 11px;
  font-size: 12px;
  font-family: var(--sans);
  cursor: pointer;
  font-weight: 600;
  transition: opacity 0.15s;

  &:hover { opacity: 0.8; }

  &.ghost  { background: rgba(21,31,40,0.06); color: var(--carbon); }
  &.solid  { background: var(--carbon); color: white; }
  &.danger { background: rgba(236,56,19,0.1); color: var(--ember); }
}

// Table
.panel {
  background: white;
  border-radius: 14px;
  border: 1px solid rgba(21,31,40,0.07);
  overflow: hidden;
}

.tbl {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;

  thead tr {
    background: rgba(21,31,40,0.03);
    border-bottom: 1px solid rgba(21,31,40,0.07);
  }

  th {
    padding: 10px 14px;
    text-align: left;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: rgba(21,31,40,0.4);
  }

  td { padding: 11px 14px; vertical-align: middle; }

  .tbl-row {
    border-bottom: 1px solid rgba(21,31,40,0.06);
    cursor: pointer;
    transition: background 0.1s;

    &:hover, &.is-expanded { background: rgba(21,31,40,0.02); }
    &:last-child { border-bottom: none; }
  }
}

.cell-date   { font-size: 12px; color: rgba(21,31,40,0.45); white-space: nowrap; }
.cell-toggle { text-align: center; width: 32px; }

.chevron {
  display: inline-block;
  font-size: 18px;
  color: rgba(21,31,40,0.3);
  transform: rotate(90deg);
  transition: transform 0.2s;

  &.up { transform: rotate(-90deg); }
}

.tag-list { display: flex; gap: 4px; flex-wrap: wrap; }
.tag {
  background: rgba(21,31,40,0.06);
  border-radius: 5px;
  padding: 2px 7px;
  font-size: 11px;
  color: rgba(21,31,40,0.7);
}

.badge {
  border-radius: 5px;
  padding: 2px 8px;
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;

  &.badge-warn  { background: #fef3c7; color: #92400e; }
  &.badge-ok    { background: #d1fae5; color: #065f46; }
  &.badge-muted { background: rgba(21,31,40,0.06); color: rgba(21,31,40,0.4); }
}

// Accordion detail
.detail-row td { padding: 0; background: #fafafa; }

.detail-card {
  padding: 16px 20px;
  border-top: 1px solid rgba(21,31,40,0.06);
}

.detail-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 12px;
  margin-bottom: 12px;
}

.detail-field { }
.detail-lbl {
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: rgba(21,31,40,0.4);
  margin-bottom: 3px;
}
.detail-val { font-size: 13px; color: var(--carbon); }
.detail-desc {
  font-size: 13px;
  color: rgba(21,31,40,0.7);
  line-height: 1.6;
  white-space: pre-wrap;
  background: white;
  border: 1px solid rgba(21,31,40,0.08);
  border-radius: 7px;
  padding: 10px 12px;
  margin-top: 4px;
}

.detail-actions {
  display: flex;
  gap: 8px;
  margin-top: 14px;
  flex-wrap: wrap;
}

// Empty state
.empty {
  padding: 40px;
  text-align: center;
  color: rgba(21,31,40,0.4);
  font-size: 14px;
}

// Toast
.toast {
  position: fixed;
  bottom: 24px;
  left: 50%;
  transform: translateX(-50%);
  background: var(--carbon);
  color: white;
  border-radius: 8px;
  padding: 10px 20px;
  font-size: 13px;
  font-weight: 600;
  z-index: 9999;
  animation: fadeUp 0.2s ease;
}

@keyframes fadeUp {
  from { opacity: 0; transform: translateX(-50%) translateY(8px); }
  to   { opacity: 1; transform: translateX(-50%) translateY(0); }
}
```

- [ ] **Step 5: Commit**

```bash
git add src/app/pages/admin/cotizaciones/
git commit -m "feat: add CotizacionesListComponent for admin panel"
```

---

## Task 8: Conectar admin — rutas y shell

**Files:**
- Modify: `src/app/app.routes.ts`
- Modify: `src/app/pages/admin/admin-shell.component.ts`

- [ ] **Step 1: Agregar ruta `/admin/cotizaciones` en `app.routes.ts`**

Dentro del array `children` de la ruta `admin`, agregar:

```typescript
{
  path: 'cotizaciones',
  loadComponent: () =>
    import('./pages/admin/cotizaciones/cotizaciones-list.component').then(
      m => m.CotizacionesListComponent,
    ),
},
```

- [ ] **Step 2: Actualizar crumbs en `admin-shell.component.ts`**

En el `computed` `crumbs`, agregar antes del bloque `const map`:

```typescript
if (url.includes('/cotizaciones')) return ['Diseño', 'Cotizaciones'];
```

El bloque completo queda:

```typescript
crumbs = computed(() => {
  const url = this.routerUrl();
  if (url.includes('/inventario/ventas'))          return ['Evento', 'Inventario', 'Log de ventas'];
  if (url.includes('/inventario/nuevo'))           return ['Evento', 'Inventario', 'Nuevo producto'];
  if (url.match(/\/inventario\/.+\/editar/))       return ['Evento', 'Inventario', 'Editar producto'];
  if (url.includes('/inventario'))                 return ['Evento', 'Inventario'];
  if (url.includes('/cotizaciones'))               return ['Diseño', 'Cotizaciones'];

  const map: Record<ViewId, string[]> = {
    dashboard: ['Resumen'],
    productos: ['Catálogo', 'Productos'],
    pedidos:   ['Operación', 'Pedidos'],
    clientes:  ['Comunidad', 'Clientes'],
    pagos:     ['Caja', 'Pagos'],
    contenido: ['Universo', 'Personajes y contenido'],
    ajustes:   ['Sistema', 'Ajustes'],
  };
  return map[this.state.view()] ?? ['—'];
});
```

- [ ] **Step 3: Agregar enlace de navegación en el shell HTML**

Abrir `src/app/pages/admin/admin-shell.component.html` y localizar la sección de navegación lateral. Agregar un enlace a cotizaciones junto al enlace de inventario (buscar el patrón `goInventario`):

```html
<button class="nav-item" (click)="goCotizaciones()">
  Cotizaciones
</button>
```

Y en `admin-shell.component.ts` agregar el método:

```typescript
goCotizaciones() { this.router.navigate(['/admin/cotizaciones']); }
```

- [ ] **Step 4: Verificar en el navegador**

```bash
ng serve
```

Navegar a `http://localhost:4200/admin/cotizaciones` — debe mostrar la vista de cotizaciones (vacía si no hay datos aún, con breadcrumb "Diseño / Cotizaciones").

- [ ] **Step 5: Commit final**

```bash
git add src/app/app.routes.ts src/app/pages/admin/admin-shell.component.ts src/app/pages/admin/admin-shell.component.html
git commit -m "feat: register /admin/cotizaciones route and add nav link"
```

---

## Self-review

**Spec coverage:**
- ✅ Ruta `/cotizar` dedicada
- ✅ Estimador: servicio + escala + botón "Ver mi estimado"
- ✅ Resultado reactivo con precio, duración y lista de entregables
- ✅ Formulario oculto por defecto (`@if formVisible`)
- ✅ Pre-relleno del formulario desde el estimador
- ✅ Validación Reactive Forms con errores inline
- ✅ Edge Function: inserta en Supabase + envía email Resend
- ✅ CORS manejado en la Edge Function
- ✅ Estado `submitted` con mensaje de confirmación
- ✅ Admin `/admin/cotizaciones` con tabla + filtros + acordeón
- ✅ Cambio de estado (pendiente/respondida/descartada)
- ✅ Topbar actualizado (desktop + mobile)
- ✅ Crumbs del admin shell actualizados

**Tipos consistentes:**
- `ServicioId` y `EscalaId` definidos en Task 3 y usados en Tasks 3, 4 (template tipado implícitamente).
- `Cotizacion` interface definida en Task 7 y usada solo ahí.
- `PRECIO_MATRIX`, `INCLUYE`, `SERVICIOS`, `ESCALAS` definidos en Task 3 y referenciados en el template (Task 4).

**Sin placeholders:** Cada step tiene código completo.
