# Mensajes Cuaquiverso — Design Spec

**Fecha:** 2026-06-04
**Estado:** Aprobado

## Objetivo

Reemplazar la sección newsletter de la landing de Cuaquiverso con un formulario de contacto que guarda mensajes en Supabase, notifica al equipo por correo (Resend) y expone una bandeja en el panel de admin.

---

## Decisiones de diseño

| Decisión | Elección |
|----------|----------|
| Tipo de formulario | Chips de categoría + textarea + correo opcional |
| Categorías | 💬 Comentario · 🛍 Sugerir producto · ❓ Duda · 📦 Pedido |
| Ubicación | Reemplaza `<section class="nl">` en `cuaquiverso.component.html` |
| Persistencia | Tabla `mensajes` en Supabase |
| Notificación | Supabase Edge Function → Resend → `hola@cuacdesign.com` |
| Admin | Nueva sección `/admin/mensajes` con bandeja leído/no leído |

---

## Modelo de datos

```sql
CREATE TABLE mensajes (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo       TEXT        NOT NULL CHECK (tipo IN ('comentario','producto','duda','pedido')),
  mensaje    TEXT        NOT NULL,
  correo     TEXT,
  leido      BOOLEAN     NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

RLS: solo usuarios autenticados (admin) pueden leer y actualizar. Insertar es público (anon key).

---

## Arquitectura

```
Usuario → MensajesFormComponent
              ↓ MensajesService.send()
         supabase.insert('mensajes')
              ↓ (DB trigger)
         Edge Function "notify-mensaje"
              ↓ Resend API
         hola@cuacdesign.com

Admin → /admin/mensajes
              ↓ MensajesAdminService.list()
         supabase.select('mensajes').order('created_at', desc)
              ↓ MensajesAdminService.markLeido(id)
         supabase.update({ leido: true })
```

---

## Piezas a construir

### 1. Migración Supabase
- Crear tabla `mensajes` con las columnas definidas arriba.
- RLS: `INSERT` permitido para `anon`, `SELECT` y `UPDATE` solo para `authenticated`.

### 2. MensajesService
**Archivo:** `src/app/pages/cuaquiverso/services/mensajes.service.ts`

- `send(tipo, mensaje, correo?)` — inserta en `mensajes`, devuelve `Promise<void>`, lanza error si falla.
- `readonly sending = signal(false)` — flag de carga durante el insert.
- `readonly error = signal<string | null>(null)` — mensaje de error legible para mostrar en el form.

### 3. MensajesFormComponent
**Archivo:** `src/app/pages/cuaquiverso/mensajes-form/mensajes-form.component.ts`

Reemplaza `<section class="nl">` en `cuaquiverso.component.html`.

**UX del formulario:**
- Chips de tipo: uno activo a la vez, `comentario` preseleccionado.
- Textarea: `placeholder` contextual según el tipo activo:
  - comentario: `"¿Cuál personaje merece su propia camiseta? ¿Una queja? ¿Una idea loca? Cuéntanos."`
  - producto: `"¿Qué objeto o personaje te gustaría ver en la tienda?"`
  - duda: `"¿Tienes alguna pregunta sobre la tienda, envíos o productos?"`
  - pedido: `"Escribe tu número de pedido y cuéntanos qué pasó."`
- Campo email: `placeholder="tu@correo.co — solo si quieres que te respondamos (opcional)"`.
- Botón "Enviar →": deshabilitado si textarea vacía o si `sending()` es true.
- Al enviar exitosamente: mostrar estado de éxito inline (sin navegar). Texto: *"Mensaje recibido — El equipo de Cuac lo leerá pronto. Si dejaste tu correo, te respondemos."*
- Error: mostrar mensaje inline bajo el botón.

**Copy del eyebrow/heading:**
- Eyebrow: `Escríbenos`
- H2: `Lo que sea. *En serio.*`
- Subtítulo: `Una duda, una idea de producto, un comentario — todo llega directo al equipo de Cuac.`

**Estilos:** heredan los tokens de `_tokens.scss`. Fondo `var(--mist)` (igual que las secciones claras del resto de la página). Los chips usan `var(--ember)` para el estado activo.

### 4. Edge Function — `notify-mensaje`
**Archivo:** `supabase/functions/notify-mensaje/index.ts`

- Trigger: Supabase Database Webhook en `INSERT` sobre `mensajes`.
- Payload esperado: `{ record: { tipo, mensaje, correo, created_at } }`.
- Llama a Resend API (`POST /emails`) con:
  - `from`: `"Cuaquiverso <noreply@cuacdesign.com>"`
  - `to`: `["hola@cuacdesign.com"]`
  - `subject`: `"[Cuaquiverso] Nuevo mensaje: {tipo}"`
  - `html`: bloque simple con tipo, mensaje, correo (o "sin correo") y timestamp.
- Secret requerido: `RESEND_API_KEY` en las variables de entorno de Supabase.
- Prerequisito: verificar el dominio `cuacdesign.com` en Resend antes de deployar (o usar un `from` con dominio de Resend como fallback durante desarrollo).

### 5. Admin — MensajesAdminComponent
**Archivos:**
- `src/app/admin/mensajes/mensajes-admin.component.ts`
- Ruta: `{ path: 'mensajes', loadComponent: ... }` en las rutas del admin

**Funcionalidad:**
- Lista todos los mensajes ordenados por `created_at` DESC.
- Columnas: punto de estado (leído/no leído) · tipo (chip) · preview del mensaje · correo · fecha relativa.
- Click en una fila expande el mensaje completo y lo marca como leído (PATCH `leido = true`).
- Badge en el nav del admin con la cuenta de mensajes no leídos.

---

## Fuera del alcance

- Responder mensajes desde el admin (solo lectura + marcar leído).
- Borrar mensajes.
- Filtros y búsqueda en la bandeja.
- Paginación (se implementa cuando el volumen lo requiera).
- Newsletter: se elimina, no se reemplaza por otra funcionalidad.
