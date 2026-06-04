# Mensajes Cuaquiverso Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reemplazar la sección newsletter de Cuaquiverso con un formulario de contacto (chips de tipo + textarea + correo opcional) que guarda mensajes en Supabase, notifica al equipo vía Resend y expone una bandeja en el panel de admin.

**Architecture:** Angular form component reemplaza `<section class="nl">`. Un `MensajesService` inserta en la tabla `mensajes` de Supabase. Una Supabase Edge Function `notify-mensaje` se dispara en cada INSERT y envía un email a `hola@cuacdesign.com` vía Resend. El admin panel expone `/admin/mensajes` para leer y marcar mensajes.

**Tech Stack:** Angular 18 standalone components, Supabase (PostgreSQL + RLS + Edge Functions), Resend API, CSS custom properties de `_tokens.scss`.

---

## File Map

| Acción  | Archivo                                                                         | Responsabilidad                              |
|---------|---------------------------------------------------------------------------------|----------------------------------------------|
| Create  | `supabase/functions/notify-mensaje/index.ts`                                   | Edge Function: recibe webhook, envía email   |
| Create  | `src/app/pages/cuaquiverso/services/mensajes.service.ts`                       | `send()` + signals `sending` / `error`       |
| Create  | `src/app/pages/cuaquiverso/mensajes-form/mensajes-form.component.ts`           | Lógica del formulario                        |
| Create  | `src/app/pages/cuaquiverso/mensajes-form/mensajes-form.component.html`         | Template: chips, textarea, email, éxito      |
| Create  | `src/app/pages/cuaquiverso/mensajes-form/mensajes-form.component.scss`         | Estilos de la sección                        |
| Create  | `src/app/pages/admin/mensajes/mensajes-admin.component.ts`                     | Lista mensajes, toggle expand, mark leído    |
| Create  | `src/app/pages/admin/mensajes/mensajes-admin.component.html`                   | Tabla de bandeja                             |
| Create  | `src/app/pages/admin/mensajes/mensajes-admin.component.scss`                   | Estilos admin                                |
| Modify  | `src/app/pages/cuaquiverso/cuaquiverso.component.ts`                           | Importar MensajesFormComponent, borrar nl    |
| Modify  | `src/app/pages/cuaquiverso/cuaquiverso.component.html`                         | Reemplazar `<section class="nl">`            |
| Modify  | `src/app/app.routes.ts`                                                        | Registrar ruta `admin/mensajes`              |
| Modify  | `src/app/pages/admin/admin-shell.component.ts`                                 | isMensajesRoute, goMensajes, unreadMensajes  |
| Modify  | `src/app/pages/admin/admin-shell.component.html`                               | Nav item Mensajes con badge                  |

---

## Task 1: Migración Supabase — tabla `mensajes`

**Files:**
- Supabase Dashboard → SQL Editor

- [ ] **Step 1.1 — Ejecutar la migración en Supabase**

Abre el **SQL Editor** del proyecto en el dashboard de Supabase y ejecuta:

```sql
-- Tabla de mensajes
CREATE TABLE IF NOT EXISTS mensajes (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo       TEXT        NOT NULL CHECK (tipo IN ('comentario','producto','duda','pedido')),
  mensaje    TEXT        NOT NULL,
  correo     TEXT,
  leido      BOOLEAN     NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS: insertar público (anon), leer/actualizar solo autenticado
ALTER TABLE mensajes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "insertar_publico"
  ON mensajes FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "leer_autenticado"
  ON mensajes FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "actualizar_autenticado"
  ON mensajes FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);
```

- [ ] **Step 1.2 — Verificar**

En el SQL Editor, ejecuta:

```sql
SELECT * FROM mensajes LIMIT 1;
```

Esperado: resultado vacío sin errores (tabla creada correctamente).

- [ ] **Step 1.3 — Commit**

```bash
git commit --allow-empty -m "feat(mensajes): tabla mensajes creada en Supabase (migración manual)"
```

---

## Task 2: MensajesService

**Files:**
- Create: `src/app/pages/cuaquiverso/services/mensajes.service.ts`

- [ ] **Step 2.1 — Crear el servicio**

```typescript
// src/app/pages/cuaquiverso/services/mensajes.service.ts
import { Injectable, signal, inject } from '@angular/core';
import { SupabaseService } from '../../../core/services/supabase.service';

export type TipoMensaje = 'comentario' | 'producto' | 'duda' | 'pedido';

@Injectable({ providedIn: 'root' })
export class MensajesService {
  private sb = inject(SupabaseService);

  readonly sending = signal(false);
  readonly error   = signal<string | null>(null);

  async send(tipo: TipoMensaje, mensaje: string, correo?: string): Promise<void> {
    this.sending.set(true);
    this.error.set(null);
    const { error } = await this.sb.db
      .from('mensajes')
      .insert({ tipo, mensaje, correo: correo ?? null });
    this.sending.set(false);
    if (error) this.error.set('No se pudo enviar el mensaje. Intenta de nuevo.');
  }
}
```

- [ ] **Step 2.2 — Commit**

```bash
git add src/app/pages/cuaquiverso/services/mensajes.service.ts
git commit -m "feat(mensajes): MensajesService con insert a Supabase"
```

---

## Task 3: MensajesFormComponent

**Files:**
- Create: `src/app/pages/cuaquiverso/mensajes-form/mensajes-form.component.ts`
- Create: `src/app/pages/cuaquiverso/mensajes-form/mensajes-form.component.html`
- Create: `src/app/pages/cuaquiverso/mensajes-form/mensajes-form.component.scss`

- [ ] **Step 3.1 — Crear el componente TypeScript**

```typescript
// src/app/pages/cuaquiverso/mensajes-form/mensajes-form.component.ts
import { Component, signal, inject } from '@angular/core';
import { MensajesService, TipoMensaje } from '../services/mensajes.service';

@Component({
  selector: 'app-mensajes-form',
  standalone: true,
  imports: [],
  templateUrl: './mensajes-form.component.html',
  styleUrl: './mensajes-form.component.scss',
})
export class MensajesFormComponent {
  private svc = inject(MensajesService);

  tipo    = signal<TipoMensaje>('comentario');
  mensaje = signal('');
  correo  = signal('');
  enviado = signal(false);

  readonly sending = this.svc.sending;
  readonly error   = this.svc.error;

  readonly CHIPS: { id: TipoMensaje; emoji: string; label: string; placeholder: string }[] = [
    {
      id: 'comentario', emoji: '💬', label: 'Comentario',
      placeholder: '¿Cuál personaje merece su propia camiseta? ¿Una queja? ¿Una idea loca? Cuéntanos.',
    },
    {
      id: 'producto', emoji: '🛍', label: 'Sugerir producto',
      placeholder: '¿Qué objeto o personaje te gustaría ver en la tienda?',
    },
    {
      id: 'duda', emoji: '❓', label: 'Duda',
      placeholder: '¿Tienes alguna pregunta sobre la tienda, envíos o productos?',
    },
    {
      id: 'pedido', emoji: '📦', label: 'Pedido',
      placeholder: 'Escribe tu número de pedido y cuéntanos qué pasó.',
    },
  ];

  get placeholder(): string {
    return this.CHIPS.find(c => c.id === this.tipo())?.placeholder ?? '';
  }

  async onSubmit(e: Event): Promise<void> {
    e.preventDefault();
    await this.svc.send(this.tipo(), this.mensaje(), this.correo() || undefined);
    if (!this.svc.error()) {
      this.enviado.set(true);
    }
  }
}
```

- [ ] **Step 3.2 — Crear la plantilla HTML**

```html
<!-- src/app/pages/cuaquiverso/mensajes-form/mensajes-form.component.html -->
@if (!enviado()) {
  <section class="mf-section">
    <div class="mf-inner">
      <div class="mf-eyebrow"><span class="dot"></span> Escríbenos</div>
      <h2 class="mf-heading">Lo que sea. <em>En serio.</em></h2>
      <p class="mf-sub">Una duda, una idea de producto, un comentario — todo llega directo al equipo de Cuac.</p>

      <form (submit)="onSubmit($event)">
        <div class="mf-chips">
          @for (chip of CHIPS; track chip.id) {
            <button
              type="button"
              class="mf-chip"
              [class.active]="tipo() === chip.id"
              (click)="tipo.set(chip.id)"
            >
              {{ chip.emoji }} {{ chip.label }}
            </button>
          }
        </div>

        <textarea
          class="mf-textarea"
          [placeholder]="placeholder"
          [value]="mensaje()"
          (input)="mensaje.set($any($event.target).value)"
          required
        ></textarea>

        <input
          type="email"
          class="mf-email"
          placeholder="tu&#64;correo.co — solo si quieres que te respondamos (opcional)"
          [value]="correo()"
          (input)="correo.set($any($event.target).value)"
        />

        @if (error()) {
          <p class="mf-error">{{ error() }}</p>
        }

        <div class="mf-actions">
          <button
            type="submit"
            class="mf-btn"
            [disabled]="!mensaje().trim() || sending()"
          >
            {{ sending() ? 'Enviando…' : 'Enviar →' }}
          </button>
        </div>
      </form>
    </div>
  </section>
} @else {
  <section class="mf-section mf-section--success">
    <div class="mf-inner mf-inner--center">
      <div class="mf-success-icon">✉️</div>
      <h3 class="mf-success-h">Mensaje recibido</h3>
      <p class="mf-success-sub">El equipo de Cuac lo leerá pronto.<br>Si dejaste tu correo, te respondemos.</p>
    </div>
  </section>
}
```

- [ ] **Step 3.3 — Crear los estilos**

```scss
// src/app/pages/cuaquiverso/mensajes-form/mensajes-form.component.scss
:host { display: block; }

.mf-section {
  background: var(--mist);
  padding: var(--s-9) var(--s-7);

  @media (max-width: 640px) {
    padding: var(--s-8) var(--s-5);
  }

  &--success {
    display: flex;
    align-items: center;
    min-height: 320px;
  }
}

.mf-inner {
  max-width: 680px;
  margin: 0 auto;

  &--center {
    text-align: center;
    width: 100%;
  }
}

.mf-eyebrow {
  display: flex;
  align-items: center;
  gap: 8px;
  font-family: var(--mono);
  font-size: 11px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--ember);
  margin-bottom: var(--s-4);

  .dot {
    width: 5px;
    height: 5px;
    border-radius: 50%;
    background: var(--ember);
    flex-shrink: 0;
  }
}

.mf-heading {
  font-family: var(--display);
  font-size: clamp(1.75rem, 4vw, 2.5rem);
  font-weight: 400;
  color: var(--ink);
  line-height: 1.1;
  margin-bottom: var(--s-3);

  em {
    font-style: italic;
    color: var(--ember);
  }
}

.mf-sub {
  font-size: 15px;
  color: rgba(21, 31, 40, 0.55);
  line-height: 1.6;
  margin-bottom: var(--s-6);
}

.mf-chips {
  display: flex;
  gap: var(--s-3);
  flex-wrap: wrap;
  margin-bottom: var(--s-5);
}

.mf-chip {
  font-family: var(--sans);
  font-size: 13px;
  padding: 7px 15px;
  border-radius: var(--r-pill);
  border: 1.5px solid rgba(21, 31, 40, 0.18);
  color: rgba(21, 31, 40, 0.6);
  background: transparent;
  cursor: pointer;
  transition: border-color 0.15s, color 0.15s, background 0.15s;

  &:hover {
    border-color: rgba(21, 31, 40, 0.35);
    color: var(--ink);
  }

  &.active {
    background: var(--ember);
    border-color: var(--ember);
    color: var(--paper);
    font-weight: 600;
  }
}

.mf-textarea {
  width: 100%;
  background: var(--paper);
  border: 1.5px solid rgba(21, 31, 40, 0.12);
  border-radius: 8px;
  font-family: var(--sans);
  font-size: 14px;
  color: var(--ink);
  padding: 14px;
  resize: none;
  height: 110px;
  margin-bottom: var(--s-3);
  outline: none;
  transition: border-color 0.15s;

  &:focus { border-color: var(--ember); }
  &::placeholder { color: rgba(21, 31, 40, 0.35); }
}

.mf-email {
  width: 100%;
  background: var(--paper);
  border: 1.5px solid rgba(21, 31, 40, 0.12);
  border-radius: 8px;
  font-family: var(--sans);
  font-size: 14px;
  color: var(--ink);
  padding: 12px 14px;
  margin-bottom: var(--s-4);
  outline: none;
  transition: border-color 0.15s;

  &:focus { border-color: var(--ember); }
  &::placeholder { color: rgba(21, 31, 40, 0.35); }
}

.mf-error {
  font-size: 13px;
  color: var(--ember);
  margin-bottom: var(--s-3);
}

.mf-actions {
  display: flex;
  justify-content: flex-end;
}

.mf-btn {
  font-family: var(--sans);
  font-size: 14px;
  font-weight: 600;
  background: var(--ember);
  color: var(--paper);
  border: none;
  border-radius: 6px;
  padding: 11px 26px;
  cursor: pointer;
  transition: background 0.15s;

  &:hover:not(:disabled) { background: #d43010; }
  &:disabled { opacity: 0.55; cursor: not-allowed; }
}

// ── Success state ────────────────────────────────
.mf-success-icon { font-size: 40px; margin-bottom: var(--s-4); }

.mf-success-h {
  font-family: var(--sans);
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--ink);
  margin-bottom: var(--s-3);
}

.mf-success-sub {
  font-size: 15px;
  color: rgba(21, 31, 40, 0.55);
  line-height: 1.6;
}
```

- [ ] **Step 3.4 — Commit**

```bash
git add src/app/pages/cuaquiverso/mensajes-form/
git commit -m "feat(mensajes): MensajesFormComponent — form con chips, textarea y estado de éxito"
```

---

## Task 4: Montar el form en Cuaquiverso (reemplaza newsletter)

**Files:**
- Modify: `src/app/pages/cuaquiverso/cuaquiverso.component.ts`
- Modify: `src/app/pages/cuaquiverso/cuaquiverso.component.html`

- [ ] **Step 4.1 — Actualizar cuaquiverso.component.ts**

Añadir el import de ES al bloque de imports existentes:

```typescript
import { MensajesFormComponent } from './mensajes-form/mensajes-form.component';
```

En el decorador `@Component`, actualizar el array `imports`:

```typescript
imports: [CartModalComponent, RouterLink, CuaquiversoFooterComponent, HelpModalComponent, MensajesFormComponent],
```

Eliminar las líneas `newsletterSubmitted` y `onNewsletterSubmit` del cuerpo de la clase:

```typescript
// ELIMINAR estas dos líneas:
newsletterSubmitted = false;

// ELIMINAR este método completo:
onNewsletterSubmit(event: Event): void {
  event.preventDefault();
  this.newsletterSubmitted = true;
}
```

- [ ] **Step 4.2 — Reemplazar la sección newsletter en el HTML**

En `src/app/pages/cuaquiverso/cuaquiverso.component.html`, reemplazar el bloque completo:

```html
<!-- ANTES: eliminar desde <!-- NEWSLETTER --> hasta </section> (inclusive) -->
<!-- NEWSLETTER -->
<section class="nl">
  <div class="nl-inner">
    <div class="eyebrow"><span class="dot"></span> Carta del Cuaquiverso</div>
    <h3>Cuéntale a tu correo dónde <em>aterriza Cuac</em> esta semana.</h3>
    <p>Una carta corta cada quince días: lanzamientos, historias detrás de cada personaje, y descuentos para suscriptores.</p>
    <form (ngSubmit)="onNewsletterSubmit($event)">
      <input type="email" placeholder="tu&#64;correo.co" required />
      <button type="submit">{{ newsletterSubmitted ? '✓ Suscrito' : 'Suscribirme' }}</button>
    </form>
  </div>
</section>
```

```html
<!-- DESPUÉS: -->
<app-mensajes-form />
```

- [ ] **Step 4.3 — Verificar que compila**

```bash
ng build --configuration development 2>&1 | tail -5
```

Esperado: `Build at: ... - Time: ...ms` sin errores.

- [ ] **Step 4.4 — Commit**

```bash
git add src/app/pages/cuaquiverso/cuaquiverso.component.ts src/app/pages/cuaquiverso/cuaquiverso.component.html
git commit -m "feat(mensajes): reemplazar newsletter por MensajesFormComponent en landing Cuaquiverso"
```

---

## Task 5: Admin MensajesAdminComponent

**Files:**
- Create: `src/app/pages/admin/mensajes/mensajes-admin.component.ts`
- Create: `src/app/pages/admin/mensajes/mensajes-admin.component.html`
- Create: `src/app/pages/admin/mensajes/mensajes-admin.component.scss`

- [ ] **Step 5.1 — Crear el componente TypeScript**

```typescript
// src/app/pages/admin/mensajes/mensajes-admin.component.ts
import { Component, signal, computed, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SupabaseService } from '../../../core/services/supabase.service';

interface Mensaje {
  id: string;
  tipo: 'comentario' | 'producto' | 'duda' | 'pedido';
  mensaje: string;
  correo: string | null;
  leido: boolean;
  created_at: string;
}

@Component({
  selector: 'app-mensajes-admin',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './mensajes-admin.component.html',
  styleUrl: './mensajes-admin.component.scss',
})
export class MensajesAdminComponent implements OnInit {
  private sb = inject(SupabaseService);

  cargando   = signal(true);
  error      = signal<string | null>(null);
  items      = signal<Mensaje[]>([]);
  expandedId = signal<string | null>(null);

  noLeidos = computed(() => this.items().filter(m => !m.leido).length);

  async ngOnInit() {
    await this.cargar();
  }

  async cargar() {
    this.cargando.set(true);
    const { data, error } = await this.sb.db
      .from('mensajes')
      .select('*')
      .order('created_at', { ascending: false });
    this.cargando.set(false);
    if (error) { this.error.set('Error al cargar mensajes.'); return; }
    this.items.set(data ?? []);
  }

  async toggle(m: Mensaje) {
    if (this.expandedId() === m.id) {
      this.expandedId.set(null);
      return;
    }
    this.expandedId.set(m.id);
    if (!m.leido) {
      await this.sb.db.from('mensajes').update({ leido: true }).eq('id', m.id);
      this.items.update(list =>
        list.map(i => i.id === m.id ? { ...i, leido: true } : i)
      );
    }
  }

  tipoLabel(tipo: string): string {
    const map: Record<string, string> = {
      comentario: '💬 Comentario',
      producto:   '🛍 Producto',
      duda:       '❓ Duda',
      pedido:     '📦 Pedido',
    };
    return map[tipo] ?? tipo;
  }

  fechaRelativa(iso: string): string {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 2)   return 'ahora';
    if (mins < 60)  return `hace ${mins} min`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24)   return `hace ${hrs}h`;
    const days = Math.floor(hrs / 24);
    return days === 1 ? 'ayer' : `hace ${days} días`;
  }
}
```

- [ ] **Step 5.2 — Crear la plantilla HTML**

```html
<!-- src/app/pages/admin/mensajes/mensajes-admin.component.html -->
<div class="ma-wrap">
  <div class="ma-head">
    <h1>Mensajes</h1>
    @if (noLeidos() > 0) {
      <span class="ma-badge">{{ noLeidos() }} sin leer</span>
    }
  </div>

  @if (cargando()) {
    <div class="ma-state">Cargando mensajes…</div>
  } @else if (error()) {
    <div class="ma-state ma-state--error">{{ error() }}</div>
  } @else if (items().length === 0) {
    <div class="ma-state">Sin mensajes todavía.</div>
  } @else {
    <div class="ma-list">
      @for (m of items(); track m.id) {
        <div class="ma-row" [class.unread]="!m.leido" (click)="toggle(m)">
          <div class="ma-row-top">
            <span class="ma-dot" [class.unread]="!m.leido"></span>
            <span class="ma-tipo" [attr.data-tipo]="m.tipo">{{ tipoLabel(m.tipo) }}</span>
            <span class="ma-preview">{{ m.mensaje | slice:0:80 }}{{ m.mensaje.length > 80 ? '…' : '' }}</span>
            <span class="ma-correo">{{ m.correo ?? 'sin correo' }}</span>
            <span class="ma-fecha">{{ fechaRelativa(m.created_at) }}</span>
            <span class="ma-chevron">{{ expandedId() === m.id ? '▲' : '▼' }}</span>
          </div>
          @if (expandedId() === m.id) {
            <div class="ma-body" (click)="$event.stopPropagation()">
              <p class="ma-msg-full">{{ m.mensaje }}</p>
              @if (m.correo) {
                <a class="ma-correo-link" [href]="'mailto:' + m.correo">{{ m.correo }}</a>
              }
            </div>
          }
        </div>
      }
    </div>
  }
</div>
```

- [ ] **Step 5.3 — Crear los estilos**

```scss
// src/app/pages/admin/mensajes/mensajes-admin.component.scss
.ma-wrap {
  padding: 28px 32px;
  max-width: 960px;
}

.ma-head {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 24px;

  h1 {
    font-size: 20px;
    font-weight: 700;
    color: var(--carbon);
  }
}

.ma-badge {
  background: #EC3813;
  color: #fff;
  font-size: 11px;
  font-weight: 700;
  padding: 3px 9px;
  border-radius: 20px;
}

.ma-state {
  font-size: 14px;
  color: rgba(21, 31, 40, 0.45);
  padding: 48px 0;
  text-align: center;

  &--error { color: #EC3813; }
}

.ma-list {
  border: 1px solid rgba(21, 31, 40, 0.08);
  border-radius: 10px;
  overflow: hidden;
}

.ma-row {
  padding: 14px 16px;
  border-bottom: 1px solid rgba(21, 31, 40, 0.06);
  cursor: pointer;
  transition: background 0.12s;

  &:last-child { border-bottom: none; }
  &:hover      { background: rgba(236, 56, 19, 0.03); }
  &.unread     { background: rgba(236, 56, 19, 0.04); }
}

.ma-row-top {
  display: grid;
  grid-template-columns: 10px auto 1fr auto auto 12px;
  gap: 10px;
  align-items: center;
}

.ma-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: transparent;
  flex-shrink: 0;

  &.unread { background: #EC3813; }
}

.ma-tipo {
  font-size: 11px;
  font-weight: 600;
  padding: 3px 9px;
  border-radius: 12px;
  white-space: nowrap;
  background: rgba(236, 56, 19, 0.1);
  color: #EC3813;

  &[data-tipo="pedido"]   { background: rgba(42, 111, 219, 0.1); color: #2A6FDB; }
  &[data-tipo="duda"]     { background: rgba(255, 200, 60, 0.15); color: #B8860B; }
  &[data-tipo="producto"] { background: rgba(50, 180, 100, 0.12); color: #2A7A4A; }
}

.ma-preview {
  font-size: 13px;
  color: rgba(21, 31, 40, 0.65);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ma-correo {
  font-size: 11px;
  color: rgba(21, 31, 40, 0.35);
  white-space: nowrap;
}

.ma-fecha {
  font-size: 11px;
  color: rgba(21, 31, 40, 0.3);
  white-space: nowrap;
}

.ma-chevron {
  font-size: 9px;
  color: rgba(21, 31, 40, 0.3);
}

.ma-body {
  margin-top: 12px;
  padding: 14px 16px;
  background: rgba(21, 31, 40, 0.03);
  border-radius: 8px;
  border: 1px solid rgba(21, 31, 40, 0.07);
}

.ma-msg-full {
  font-size: 14px;
  color: rgba(21, 31, 40, 0.78);
  line-height: 1.65;
  white-space: pre-wrap;
  margin-bottom: 8px;
}

.ma-correo-link {
  font-size: 13px;
  color: #EC3813;
  text-decoration: underline;
  text-underline-offset: 3px;
}
```

- [ ] **Step 5.4 — Commit**

```bash
git add src/app/pages/admin/mensajes/
git commit -m "feat(mensajes): MensajesAdminComponent — bandeja con expand y mark leído"
```

---

## Task 6: Ruta + nav en admin

**Files:**
- Modify: `src/app/app.routes.ts`
- Modify: `src/app/pages/admin/admin-shell.component.ts`
- Modify: `src/app/pages/admin/admin-shell.component.html`

- [ ] **Step 6.1 — Registrar ruta en app.routes.ts**

En `src/app/app.routes.ts`, dentro del bloque `children` del path `admin`, añadir después de la ruta `eventos/:id`:

```typescript
{
  path: 'mensajes',
  loadComponent: () =>
    import('./pages/admin/mensajes/mensajes-admin.component').then(
      m => m.MensajesAdminComponent,
    ),
},
```

- [ ] **Step 6.2 — Actualizar admin-shell.component.ts**

**a) Añadir computed y método** — después de `isPersonajesRoute`:

```typescript
isMensajesRoute = computed(() => this.routerUrl().includes('/admin/mensajes'));
unreadMensajes  = signal(0);
```

**b) Añadir `goMensajes()`** — después de `goPersonajes()`:

```typescript
goMensajes() { this.router.navigate(['/admin/mensajes']); }
```

**c) Añadir breadcrumb** — en el método `crumbs`, antes del bloque `if (url.includes('/ajustes'))`:

```typescript
if (url.includes('/mensajes')) return ['Tienda', 'Mensajes'];
```

**d) Cargar unread en `ngOnInit`** — añadir al final del método `ngOnInit`:

```typescript
ngOnInit() {
  this.sb.db.auth.onAuthStateChange(() => {});
  this.loadUnreadMensajes();
}

private async loadUnreadMensajes() {
  const { count } = await this.sb.db
    .from('mensajes')
    .select('*', { count: 'exact', head: true })
    .eq('leido', false);
  this.unreadMensajes.set(count ?? 0);
}
```

- [ ] **Step 6.3 — Añadir nav item en admin-shell.component.html**

En la sección `<div class="sb-section">Tienda</div>`, dentro del `<div class="sb-nav">` que contiene los NAV_TIENDA, añadir al final del loop `@for` (después del `}`) el siguiente item:

```html
<a [class.is-active]="isMensajesRoute()" (click)="goMensajes()">
  <svg class="sb-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
  </svg>
  <span>Mensajes</span>
  @if (unreadMensajes() > 0) { <span class="count">{{ unreadMensajes() }}</span> }
</a>
```

- [ ] **Step 6.4 — Verificar que compila**

```bash
ng build --configuration development 2>&1 | tail -5
```

Esperado: sin errores.

- [ ] **Step 6.5 — Commit**

```bash
git add src/app/app.routes.ts src/app/pages/admin/admin-shell.component.ts src/app/pages/admin/admin-shell.component.html
git commit -m "feat(mensajes): ruta /admin/mensajes + nav item con badge de no leídos"
```

---

## Task 7: Edge Function `notify-mensaje`

**Files:**
- Create: `supabase/functions/notify-mensaje/index.ts`

- [ ] **Step 7.1 — Crear la función**

```typescript
// supabase/functions/notify-mensaje/index.ts
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? '';
const TO_EMAIL       = 'hola@cuacdesign.com';

const TIPO_LABEL: Record<string, string> = {
  comentario: '💬 Comentario',
  producto:   '🛍 Sugerencia de producto',
  duda:       '❓ Duda',
  pedido:     '📦 Problema con pedido',
};

serve(async (req) => {
  try {
    const payload = await req.json();
    const { tipo, mensaje, correo, created_at } = payload.record as {
      tipo: string;
      mensaje: string;
      correo: string | null;
      created_at: string;
    };

    const tipoLabel   = TIPO_LABEL[tipo] ?? tipo;
    const correoHtml  = correo
      ? `<p><strong>Correo:</strong> <a href="mailto:${correo}">${correo}</a></p>`
      : `<p><strong>Correo:</strong> sin correo</p>`;
    const fechaStr = new Date(created_at).toLocaleString('es-CO', { timeZone: 'America/Bogota' });

    const html = `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px;">
        <h2 style="color:#EC3813;margin-bottom:4px;">Nuevo mensaje en Cuaquiverso</h2>
        <p style="color:#888;font-size:13px;margin-bottom:24px;">${fechaStr} (Bogotá)</p>
        <p><strong>Tipo:</strong> ${tipoLabel}</p>
        ${correoHtml}
        <div style="background:#f5f5f0;border-radius:8px;padding:16px;margin-top:16px;">
          <p style="margin:0;white-space:pre-wrap;font-size:15px;color:#151F28;">${mensaje}</p>
        </div>
        <hr style="margin-top:32px;border:none;border-top:1px solid #eee;" />
        <p style="color:#aaa;font-size:12px;">
          Ver todos los mensajes en el
          <a href="https://cuacdesign.com/admin/mensajes" style="color:#EC3813;">panel de admin</a>.
        </p>
      </div>
    `;

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from:    'Cuaquiverso <noreply@cuacdesign.com>',
        to:      [TO_EMAIL],
        subject: `[Cuaquiverso] ${tipoLabel} — nuevo mensaje`,
        html,
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      return new Response(JSON.stringify({ ok: false, error: body }), { status: 500 });
    }

    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  } catch (err) {
    return new Response(JSON.stringify({ ok: false, error: String(err) }), { status: 500 });
  }
});
```

- [ ] **Step 7.2 — Deployar la función**

Con la Supabase CLI instalada y el proyecto vinculado:

```bash
supabase functions deploy notify-mensaje
```

Si no tienes la CLI: en el dashboard de Supabase → Edge Functions → New Function → pegar el código.

- [ ] **Step 7.3 — Configurar el secret RESEND_API_KEY**

```bash
supabase secrets set RESEND_API_KEY=re_xxxxxxxxxx
```

O en el dashboard: Edge Functions → Secrets → añadir `RESEND_API_KEY`.

> **Nota sobre el dominio:** El `from` usa `noreply@cuacdesign.com`. Para que Resend lo acepte, el dominio `cuacdesign.com` debe estar verificado en Resend → Domains. Mientras tanto, puedes usar `onboarding@resend.dev` como from durante desarrollo.

- [ ] **Step 7.4 — Crear el webhook en Supabase**

En el dashboard de Supabase → Database → Webhooks → Create a new hook:

- **Name:** `on_mensaje_insert`
- **Table:** `mensajes`
- **Events:** ✅ Insert
- **Type:** Supabase Edge Functions
- **Edge Function:** `notify-mensaje`

- [ ] **Step 7.5 — Commit**

```bash
git add supabase/functions/notify-mensaje/index.ts
git commit -m "feat(mensajes): Edge Function notify-mensaje — email vía Resend en cada INSERT"
```

---

## Task 8: Verificación final en navegador

- [ ] **Step 8.1 — Arrancar el servidor**

```bash
ng serve
```

Abrir `http://localhost:4200/cuaquiverso`.

- [ ] **Step 8.2 — Verificar el formulario**

1. Navegar a `/cuaquiverso` → hacer scroll al formulario (donde estaba el newsletter).
2. El chip "💬 Comentario" debe estar activo por defecto.
3. Cambiar chip → el placeholder del textarea debe cambiar.
4. Escribir un mensaje → botón "Enviar →" se habilita.
5. Dejar correo vacío → enviar → debe mostrar estado de éxito.
6. Revisar Supabase → tabla `mensajes` → debe haber un nuevo registro.

- [ ] **Step 8.3 — Verificar el admin**

1. Navegar a `http://localhost:4200/admin` → iniciar sesión.
2. En el sidebar debe aparecer "Mensajes" bajo Tienda, con badge si hay mensajes sin leer.
3. Navegar a `/admin/mensajes` → el mensaje enviado debe aparecer con punto rojo.
4. Click en la fila → expande y el punto rojo desaparece.

- [ ] **Step 8.4 — Verificar el email (si el webhook está configurado)**

Enviar otro mensaje con correo → revisar `hola@cuacdesign.com` → debe llegar el email de notificación.

- [ ] **Step 8.5 — Verificar mobile (DevTools 375px)**

El formulario debe ser legible, los chips deben hacer wrap, el botón debe ser tocable.

- [ ] **Step 8.6 — Commit final**

```bash
git add .
git commit -m "feat(mensajes): verificación completa — formulario, admin y email funcionales"
```
