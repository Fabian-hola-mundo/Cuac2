# Cotizador — Spec de diseño
**Fecha:** 2026-05-25  
**Proyecto:** cuac-design (Angular + Supabase)  
**Ruta:** `/cotizar`

---

## Resumen

Nueva página dedicada accesible desde el botón "Cotiza tu proyecto" del topbar. Tiene dos secciones:

1. **Estimador rápido** — el cliente elige servicio y escala, hace clic en un botón y ve un rango de precio al instante.
2. **Formulario de cotización personalizada** — oculto por defecto, se despliega cuando el cliente lo solicita. Se envía a Supabase y dispara un email vía Resend.

---

## Rutas y navegación

- **Nueva ruta:** `/cotizar` — componente standalone `CotizadorComponent`
- **Topbar:** el enlace `href="#contacto"` (desktop y móvil) pasa a `routerLink="/cotizar"`
- **`app.routes.ts`:** nueva entrada con `loadComponent` lazy

---

## Sección 1 — Estimador rápido

### Interacción

1. El cliente selecciona **un servicio** (chips, selección exclusiva)
2. Selecciona **escala** (Básico / Estándar / Completo)
3. Hace clic en el botón primario **"Ver mi estimado →"**
4. Aparece el bloque de resultado con animación de entrada

Los chips y botones de escala son reactivos (señales Angular), pero el resultado **no se muestra** hasta que el cliente hace clic en el botón. Esto hace que el resultado se sienta como una respuesta a una acción, no como un ticker automático.

### Servicios disponibles

| ID | Etiqueta |
|---|---|
| `branding` | Branding |
| `editorial` | Editorial |
| `web` | Diseño Web |
| `ilustracion` | Ilustración |
| `video` | Video & Movimiento |

### Matriz de precios (COP, sin IVA)

| Servicio | Básico | Estándar | Completo |
|---|---|---|---|
| Branding | $2M–$4M | $4M–$8M | $8M–$18M |
| Editorial | $1.5M–$3M | $3M–$6M | $6M–$12M |
| Diseño Web | $2M–$4M | $4M–$9M | $9M–$20M |
| Ilustración | $500K–$1.5M | $1.5M–$4M | $4M–$8M |
| Video & Movimiento | $800K–$2M | $2M–$5M | $5M–$10M |

### Duraciones estimadas

| Servicio | Básico | Estándar | Completo |
|---|---|---|---|
| Branding | 2–3 sem | 4–6 sem | 8–14 sem |
| Editorial | 1–2 sem | 3–5 sem | 6–10 sem |
| Diseño Web | 2–3 sem | 4–7 sem | 8–16 sem |
| Ilustración | 1–2 sem | 2–4 sem | 4–8 sem |
| Video & Movimiento | 1–2 sem | 2–4 sem | 4–8 sem |

### Entregables por servicio (lista "qué incluye")

Cada servicio tiene una lista fija de ítems representativos que se muestra con el resultado. No varían por escala (la escala afecta profundidad, no la lista de conceptos).

| Servicio | Ítems |
|---|---|
| Branding | Estrategia de marca · Logotipo + variantes · Paleta y tipografía · Manual de marca |
| Editorial | Dirección tipográfica · Maquetación y rejilla · Revisiones incluidas · Export para impresión y digital |
| Diseño Web | Diseño UI/UX · Desarrollo frontend · Responsive · SEO básico |
| Ilustración | Estilo definido · Set de piezas · Archivos fuente · Licencia de uso |
| Video & Movimiento | Guion y storyboard · Producción y animación · Revisiones · Export en todos los formatos |

### Bloque de resultado

```
╔══════════════════════════════════════════════╗
║  Rango estimado · {Servicio} {escala}        ║
║  $X.XXX.XXX – $X.XXX.XXX   [N–N semanas]    ║
║  COP · sin IVA                               ║
╚══════════════════════════════════════════════╝
→ Ítem 1   → Ítem 2
→ Ítem 3   → Ítem 4
```

---

## Transición entre secciones

Debajo del bloque de resultado hay una tarjeta de transición (fondo `--mist`):

> **¿Quieres una cotización 100% personalizada?**  
> Te respondemos en 2 días hábiles con una propuesta a la medida de tu proyecto.  
> [Quiero cotización →]  
> *O escríbenos a hola@cuacdesign.com*

Al hacer clic en "Quiero cotización →":
- Se activa la señal `formVisible = true`
- El formulario aparece debajo con animación CSS (`@keyframes` fadeIn + translateY)
- La página hace scroll automático al formulario (`scrollIntoView({ behavior: 'smooth' })`)

---

## Sección 2 — Formulario de cotización personalizada

### Estado por defecto

El formulario **no existe en el DOM** mientras `formVisible === false`. Se usa `@if` de Angular (no `[hidden]`) para no pre-renderizarlo.

### Pre-relleno desde el estimador

Cuando el formulario se despliega, hereda automáticamente:
- **Servicios seleccionados:** el chip del estimador queda marcado
- **Presupuesto aproximado:** se auto-completa con el rango del resultado (`"$4.000.000 – $8.000.000 COP"`)

### Campos del formulario

| Campo | Tipo | Requerido |
|---|---|---|
| Nombre | text | ✓ |
| Correo electrónico | email | ✓ |
| Empresa / Marca | text | ✓ |
| Teléfono / WhatsApp | tel | — |
| Servicio(s) que necesitas | chips multi-select | ✓ (≥1) |
| Cuéntanos sobre tu proyecto | textarea | ✓ |
| Presupuesto aproximado | text (pre-rellenado) | — |
| ¿Cuándo necesitas empezar? | select | — |

**Opciones de "¿Cuándo necesitas empezar?":**  
`Urgente (esta semana)` · `En el próximo mes` · `En 2–3 meses` · `Aún lo estoy evaluando`

### Validación

- Validación con Angular Reactive Forms (`Validators.required`, `Validators.email`)
- Errores inline debajo de cada campo al hacer blur o al intentar enviar
- El botón de envío queda deshabilitado mientras el formulario es inválido

### Estados del formulario

| Estado | Señal | Descripción |
|---|---|---|
| Oculto | `formVisible = false` | Por defecto — no está en el DOM |
| Visible / editable | `formVisible = true` | Tras hacer clic en el CTA |
| Enviando | `submitting = true` | Spinner en el botón, campos deshabilitados |
| Enviado con éxito | `submitted = true` | Formulario reemplazado por mensaje de confirmación |
| Error | `submitError = string` | Mensaje de error debajo del botón, puede reintentar |

### Mensaje de confirmación (estado `submitted`)

```
✓ ¡Solicitud enviada!
Tu cotización está en nuestras manos.
Te respondemos a {email} en menos de 2 días hábiles.
— Equipo Cuac · hola@cuacdesign.com
```

---

## Backend — Supabase Edge Function

### Endpoint

`POST /functions/v1/cotizar`  
Autenticación: ninguna (anon, pública)

### Payload

```typescript
{
  nombre: string;
  email: string;
  empresa: string;
  telefono?: string;
  servicios: string[];          // ['branding', 'web']
  descripcion: string;
  presupuesto?: string;
  timeline?: string;
  // contexto del estimador
  estimador_servicio?: string;
  estimador_escala?: string;
  estimador_rango?: string;
}
```

### Lógica de la Edge Function

1. Valida campos requeridos (nombre, email, empresa, servicios, descripcion)
2. Inserta en la tabla `cotizaciones` de Supabase con `created_at = now()`
3. Llama a Resend API para enviar el email de notificación a `hola@cuacdesign.com`
4. Retorna `{ ok: true, id: uuid }` o `{ ok: false, error: string }`

### Tabla Supabase — `cotizaciones`

```sql
create table cotizaciones (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz default now(),
  nombre      text not null,
  email       text not null,
  empresa     text not null,
  telefono    text,
  servicios   text[],
  descripcion text,
  presupuesto text,
  timeline    text,
  estimador_servicio text,
  estimador_escala   text,
  estimador_rango    text,
  estado      text default 'pendiente'  -- pendiente | respondida | descartada
);
```

RLS: `INSERT` permitido para `anon`. `SELECT/UPDATE` solo para `authenticated`.

### Email de notificación (Resend)

**Destinatario:** `hola@cuacdesign.com`  
**Asunto:** `Nueva cotización de {empresa} — {servicios.join(', ')}`  
**Cuerpo:** HTML con todos los campos del formulario + contexto del estimador si existe.

---

## Panel admin — `/admin/cotizaciones`

Nueva vista hija del `AdminShellComponent`.

### Lista de solicitudes

Tabla con columnas: fecha, nombre, empresa, servicios, estado, acciones.  
Filtrables por estado (`pendiente` / `respondida` / `descartada`).

### Detalle

Al hacer clic en una fila se expande inline debajo de la fila (patrón acordeón, consistente con el admin existente). Muestra todos los campos de la cotización y tres botones de acción: **Marcar como respondida**, **Descartar**, **Copiar email**.

### Ruta

`/admin/cotizaciones` → `CotizacionesListComponent` (nueva, standalone)

---

## Archivos a crear / modificar

| Acción | Archivo |
|---|---|
| Crear | `src/app/pages/cotizador/cotizador.component.ts` |
| Crear | `src/app/pages/cotizador/cotizador.component.html` |
| Crear | `src/app/pages/cotizador/cotizador.component.scss` |
| Crear | `src/app/pages/admin/cotizaciones/cotizaciones-list.component.ts` |
| Crear | `src/app/pages/admin/cotizaciones/cotizaciones-list.component.html` |
| Crear | `src/app/pages/admin/cotizaciones/cotizaciones-list.component.scss` |
| Crear | `supabase/functions/cotizar/index.ts` |
| Modificar | `src/app/app.routes.ts` — agregar ruta `/cotizar` y `/admin/cotizaciones` |
| Modificar | `src/app/layout/topbar/topbar.component.html` — cambiar href a routerLink |

---

## Fuera de alcance

- Notificación de confirmación por email al cliente (solo al equipo Cuac)
- Adjuntar archivos en el formulario
- Sistema de seguimiento de cotizaciones (CRM completo)
- Integración con calendario para agendar llamadas
