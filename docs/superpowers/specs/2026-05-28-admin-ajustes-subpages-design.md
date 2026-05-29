# Spec: Sub-páginas de Configuración en /admin

**Fecha:** 2026-05-28  
**Proyecto:** cuac-design — Admin Cuaquiverso  
**Scope:** Sección "Ajustes" del panel admin — 7 sub-páginas routed

---

## Contexto

La vista `ajustes` del admin existe actualmente como un `@case('ajustes')` dentro de `admin-home.component.html`. Tiene un nav lateral estático con 7 ítems pero solo "Negocio" y "Equipo" tienen contenido real; el nav no responde al clic.

Este spec define la conversión a sub-rutas Angular reales (`/admin/ajustes/*`) con un shell propio y 7 componentes independientes, cada uno funcional con signals y guardado mock.

---

## Arquitectura

### Patrón elegido: Shell propio + router-outlet hijo

Sigue el mismo patrón que `portafolio/`, `inventario/` y `eventos/` en el proyecto.

### Estructura de carpetas

```
src/app/pages/admin/ajustes/
  ajustes-shell.component.ts/html/scss
  negocio/        ajustes-negocio.component.ts/html/scss
  impuestos/      ajustes-impuestos.component.ts/html/scss
  envios/         ajustes-envios.component.ts/html/scss
  correos/        ajustes-correos.component.ts/html/scss
  equipo/         ajustes-equipo.component.ts/html/scss
  integraciones/  ajustes-integraciones.component.ts/html/scss
  dominios/       ajustes-dominios.component.ts/html/scss
```

### Rutas

```
/admin/ajustes              → redirect → /admin/ajustes/negocio
/admin/ajustes/negocio      → AjustesNegocioComponent
/admin/ajustes/impuestos    → AjustesImpuestosComponent
/admin/ajustes/envios       → AjustesEnviosComponent
/admin/ajustes/correos      → AjustesCorreosComponent
/admin/ajustes/equipo       → AjustesEquipoComponent
/admin/ajustes/integraciones → AjustesIntegracionesComponent
/admin/ajustes/dominios     → AjustesDominiosComponent
```

### ajustes-shell.component

- Contiene el nav lateral de 7 ítems con `routerLink` y `routerLinkActive="is-active"`
- Incluye `<router-outlet>` para renderizar la sub-página activa
- El nav muestra iconos SVG inline por ítem (igual al sidebar del admin principal)
- No tiene lógica propia más allá de navegación

### Cambios en admin-shell

- El `@case('ajustes')` en `admin-home.component.html` se elimina — en su lugar solo llama `router.navigate(['/admin/ajustes'])`
- El método `goHome('ajustes')` en `admin-shell.component.ts` navega a `/admin/ajustes`
- Se agrega `isAjustesRoute = computed(() => this.routerUrl().includes('/admin/ajustes'))` para el estado activo del sidebar
- Los breadcrumbs se extienden para reconocer `/ajustes/*`:
  - `/ajustes/negocio` → `['Sistema', 'Ajustes', 'Negocio']`
  - `/ajustes/impuestos` → `['Sistema', 'Ajustes', 'Impuestos']`
  - etc.

---

## Comportamiento compartido

Todas las sub-páginas implementan:

```typescript
saving = signal(false);
saved  = signal(false);

async guardar() {
  this.saving.set(true);
  await new Promise(r => setTimeout(r, 800)); // mock delay
  this.saving.set(false);
  this.saved.set(true);
  setTimeout(() => this.saved.set(false), 2000);
}
```

El botón "Guardar" muestra:
- Estado normal: "Guardar cambios"
- `saving()`: spinner inline + "Guardando…"
- `saved()`: checkmark + "Guardado"

Formularios usan `FormsModule` con `[(ngModel)]` igual al resto del admin. Estilos reutilizan las clases existentes: `.panel`, `.panel-h`, `.panel-b`, `.field`, `.input`, `.select`, `.textarea`, `.btn-sm`, `.tbl`, `.badge`.

---

## Sub-páginas

### 1. Negocio (`/admin/ajustes/negocio`)

Migra el contenido actual del `@case('ajustes')` más secciones nuevas.

**Bloque: Datos del negocio**
- Razón social, NIT, email de contacto, teléfono, dirección fiscal
- Régimen tributario (select: Régimen Simple / Responsable de IVA / No responsable)
- Moneda (select: COP / USD)
- Zona horaria (select: América/Bogotá / América/New_York / UTC)
- Idioma del panel (select: Español / English)

**Bloque: Identidad visual**
- Slot de logo: área de upload con imagen placeholder o inicial de la marca
- Nombre visible de la tienda (puede diferir de razón social)
- Color primario (input de color)

**Bloque: Guardar**
- Botón con estado `saving/saved`

Signals: `razonSocial`, `nit`, `email`, `telefono`, `direccion`, `regimen`, `moneda`, `zona`, `idioma`, `nombreTienda`, `colorPrimario`

---

### 2. Impuestos (`/admin/ajustes/impuestos`)

**Bloque: Configuración general**
- Toggle "Cobrar IVA en todos los productos" (signal booleano `cobrarIva`)
- Info contextual: "Los precios en la tienda ya incluyen IVA" (toggle entre incluido/no incluido)

**Bloque: Tasas personalizadas**
- Tabla editable con columnas: Nombre, Porcentaje, Aplica a (Todos / select de categoría), Activo (toggle)
- Filas editables inline con inputs
- Botón "Agregar tasa" que añade fila vacía
- Botón eliminar por fila

**Bloque: Facturación electrónica**
- Prefijo de factura (input texto, ej: "FE-")
- Numeración inicial (input número)
- Resolución DIAN (input texto)
- Fecha vencimiento resolución (input date)

Signals: `cobrarIva`, `ivaIncluido`, `tasas` (array signal), `prefijoFactura`, `numeracionInicial`, `resolucionDIAN`, `fechaResolucion`

---

### 3. Envíos y tarifas (`/admin/ajustes/envios`)

**Bloque: Envío gratis**
- Toggle "Activar envío gratis"
- Input "A partir de $X" (habilitado solo si toggle activo)

**Bloque: Zonas de envío**
- Tabla con: Nombre zona, Municipios (texto resumido), Tarifa plana (COP), Plazo estimado, Activo
- Filas editables inline
- Botón "Nueva zona"
- Botón eliminar por fila

**Bloque: Transportadoras**
- Tarjetas de: Servientrega, Coordinadora, Envia, TCC
- Cada tarjeta: nombre, descripción corta, toggle activo/inactivo, campo API key (type="password" con toggle de visibilidad)
- Tarjeta "Contra-entrega": toggle + campo "Recargo adicional (COP)"

Signals: `envioGratis`, `montoMinimoEnvio`, `zonas` (array), `transportadoras` (array con estado activo y credencial)

---

### 4. Plantillas de correo (`/admin/ajustes/correos`)

**Layout: lista izquierda + editor derecha (grid 280px / 1fr)**

**Lista de plantillas (6):**
1. Confirmación de pedido
2. Pedido enviado
3. Pedido entregado
4. Reembolso aprobado
5. Bienvenida al cliente
6. Recuperar carrito abandonado

Cada ítem de lista: nombre, badge estado (Activa/Inactiva), toggle activo, click para editar

**Panel editor (signal `plantillaActiva`):**
- Campo "Asunto del correo" (input)
- Chips de variables disponibles clickeables: `{{nombre}}`, `{{numero_orden}}`, `{{total}}`, `{{link_rastreo}}`, `{{productos}}` — al hacer click insertan la variable en el textarea
- Textarea grande para el cuerpo (HTML simplificado o texto plano)
- Vista previa mock: panel con estilo de email renderizado (fondo blanco, tipografía legible)
- Botón "Guardar plantilla" por plantilla individual

Signals: `plantillas` (array con id, nombre, asunto, cuerpo, activa), `plantillaActiva`, `cursorPos`

---

### 5. Equipo y permisos (`/admin/ajustes/equipo`)

Migra la tabla actual más funcionalidades nuevas.

**Bloque: Miembros activos**
- Tabla: Avatar inicial, Nombre, Email, Rol (badge coloreado), Último acceso, Acciones (editar, revocar)
- Roles: Owner (badge ok), Operaciones (badge rio), Contenido (badge lila), Solo-lectura (badge gris)
- Click "Editar" → signal `editingMember` abre panel inline debajo de la fila (o panel lateral)

**Panel de edición de miembro:**
- Nombre (read-only, es informativo)
- Select de rol con descripción de permisos de cada rol
- Botón "Revocar acceso" (danger) con confirmación inline
- Botón "Guardar cambios"

**Bloque: Invitar persona**
- Input email
- Select rol
- Botón "Enviar invitación" → flash "Invitación enviada a X"

**Bloque: Log de accesos recientes**
- Tabla pequeña: Persona, Acción, Fecha — últimos 10 eventos (datos estáticos)

Signals: `miembros` (array), `editingMember`, `inviteEmail`, `inviteRol`

---

### 6. Integraciones (`/admin/ajustes/integraciones`)

**Layout: grid de tarjetas (3 columnas)**

**Tarjetas (8):**

| Integración    | Estado        | Categoría   |
|----------------|---------------|-------------|
| Bold           | Conectado     | Pagos       |
| PSE            | Conectado     | Pagos       |
| Nequi          | Conectado     | Pagos       |
| Mailchimp      | Disponible    | Email       |
| Google Analytics | Disponible  | Analytics   |
| Meta Pixel     | Disponible    | Marketing   |
| Servientrega   | Configurado   | Envíos      |
| Coordinadora   | Próximamente  | Envíos      |

Cada tarjeta: ícono/inicial en color de marca, nombre, descripción corta (1 línea), badge estado, botón "Configurar" (disabled si "Próximamente")

**Panel de configuración (signal `activeIntegration`):**
- Se abre inline bajo la tarjeta seleccionada (expand/collapse)
- Campos según integración:
  - Pagos (Bold/PSE/Nequi): API Key, Secret, Webhook URL, toggle sandbox/producción
  - Email (Mailchimp): API Key, Audience ID
  - Analytics (GA): Measurement ID
  - Marketing (Meta Pixel): Pixel ID
  - Envíos: ya configurado desde la sección Envíos

Signals: `integraciones` (array con estado y config), `activeIntegration`

---

### 7. Dominios (`/admin/ajustes/dominios`)

**Bloque: Dominio principal**
- Dominio actual: `cuaquiverso.co` con badge "DNS verificado" (verde)
- Info: fecha de vencimiento, registrador

**Bloque: Dominios adicionales**
- Tabla: Dominio, Tipo (Principal / Alias / Redirect), Estado SSL (badge), Acciones (configurar, eliminar)
- Botón "Agregar dominio"

**Formulario agregar dominio (signal `addingDomain`):**
- Input de dominio
- Select tipo
- Botón "Verificar" → mock flow de verificación con pasos:
  1. "Verificando DNS…" (spinner 1.5s)
  2. "Registros DNS requeridos" — tabla con Tipo, Host, Valor a configurar
  3. Botón "Verificar de nuevo"

**Bloque: Redirects**
- Tabla: Origen, Destino, Tipo (301/302), Activo
- Botón "Agregar redirect"
- Filas editables inline

Signals: `dominios` (array), `addingDomain`, `verificationState`, `redirects` (array)

---

## Eliminación del contenido legacy

- Eliminar el `@case('ajustes')` completo de `admin-home.component.html`
- El nav lateral del ajustes actual (grid 220px / 1fr con botones estáticos) desaparece — lo reemplaza el `ajustes-shell`
- Los datos de equipo hardcodeados en `admin-home` no se migran (cada sub-componente tiene sus propios datos estáticos)

---

## Archivos a modificar (resumen)

| Archivo | Cambio |
|---------|--------|
| `app.config.ts` o routes file | Agregar rutas `/admin/ajustes/*` |
| `admin-shell.component.ts` | `isAjustesRoute`, breadcrumbs, `goAjustes()` |
| `admin-shell.component.html` | Link de sidebar "Ajustes" → `goAjustes()` |
| `admin-home.component.html` | Eliminar `@case('ajustes')` |
| `admin-home.component.ts` | Eliminar imports/signals relacionados con ajustes inline |

**Archivos nuevos:** 1 shell + 7 sub-componentes = 24 archivos nuevos (ts/html/scss × 8)
