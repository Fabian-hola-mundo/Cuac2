# Spec: Admin Mock Data Coherence + Drawers de Cliente y Pago

**Fecha:** 2026-05-29
**Proyecto:** cuac-design — Admin Cuaquiverso
**Scope:** Refactor de datos del admin-home a servicio compartido + drawers de detalle para Clientes y Pagos

---

## Contexto

`admin-home.component.ts` contiene todos los datos mock del admin (CUSTOMERS, ORDERS, PAYMENTS, PRODUCTS, CHARACTERS) como arrays `readonly` hardcodeados en el componente. Esto causa:
- Incoherencia: los totales de clientes no coinciden con los pedidos/pagos
- Componente de 360+ líneas con datos que crecerán al agregar drawers
- Dashboard KPIs hardcodeados como strings, no derivados de datos reales

Este spec define la extracción a un `MockAdminDataService` compartido, la expansión a 20 pedidos/pagos coherentes, y dos nuevos drawers (Cliente, Pago).

---

## Arquitectura

### Patrón: Servicio compartido de datos mock

Sigue el patrón de `InventarioService` ya presente en el proyecto.

### Archivos nuevos

| Archivo | Responsabilidad |
|---------|----------------|
| `src/app/core/services/mock-admin-data.service.ts` | Todas las entidades + helpers de resolución |
| `src/app/pages/admin/clientes/cliente-detail.component.ts/html/scss` | Drawer de detalle/edición de cliente |
| `src/app/pages/admin/pagos/pago-detail.component.ts/html/scss` | Drawer de detalle de pago + acciones |

### Archivos modificados

| Archivo | Cambio |
|---------|--------|
| `src/app/pages/admin/admin-home.component.ts` | Inyecta MockAdminDataService, elimina arrays inline, agrega signals clienteId/pagoId, KPIs computed |
| `src/app/pages/admin/admin-home.component.html` | Importa y renderiza los dos nuevos drawers |

---

## MockAdminDataService

### Interfaces exportadas

```typescript
export interface Customer {
  id: string; nombre: string; email: string; phone: string;
  ciudad: string; direccion: string; tag: string;
  since: string; orders: number; spent: number;
}

export interface Order {
  id: string; customerId: string; customer: string; email: string;
  items: number; total: number; status: string; shipping: string;
  date: string; city: string; method: string;
}

export interface Payment {
  id: string; orderId: string; order: string; date: string;
  method: string; amount: number; fee: number; net: number; status: string;
}

export interface Product {
  id: string; sku: string; name: string; category: string;
  character: string; price: number; stock: number;
  status: string; flag: string | null; color: string; updated: string;
}

export interface Character {
  id: string; name: string; region: string; color: string; accent: string;
}
```

### Datos: 8 clientes

Mismos 8 clientes actuales, expandidos con `phone`, `direccion`, `since`:

| ID | Nombre | Tag | Pedidos | Gastado | Teléfono | Ciudad |
|----|--------|-----|---------|---------|----------|--------|
| C-401 | Mariana Restrepo | VIP | 4 | $487.000 | +57 311 444 2891 | Medellín |
| C-389 | Diana Cárdenas | VIP | 7 | $982.000 | +57 320 551 0034 | Cali |
| C-377 | Jhon Sebastián López | Activo | 2 | $178.000 | +57 314 222 8801 | Bogotá |
| C-365 | Camilo Henao | Activo | 3 | $268.000 | +57 316 889 4412 | Manizales |
| C-358 | Laura Patiño | Devolución | 1 | $0 | +57 300 774 1209 | Bogotá |
| C-341 | Andrés Quintero | Activo | 2 | $196.000 | +57 312 003 5566 | Barranquilla |
| C-329 | Valentina Ruiz | Fallido | 1 | $0 | +57 318 662 9987 | Pereira |
| C-318 | Carolina Mejía | Activo | 5 | $412.000 | +57 315 445 7723 | Bucaramanga |

### Datos: 20 órdenes

Órdenes `#CQ-2800` a `#CQ-2819`. Cada orden referencia `customerId`. Distribución coherente:
- Mariana (C-401): #CQ-2814, #CQ-2803, #CQ-2798, #CQ-2791 → 4 órdenes
- Diana (C-389): #CQ-2819, #CQ-2812, #CQ-2806, #CQ-2800, #CQ-2795, #CQ-2788, #CQ-2781 → 7 órdenes
- Jhon (C-377): #CQ-2813, #CQ-2802 → 2 órdenes
- Camilo (C-365): #CQ-2808, #CQ-2797, #CQ-2785 → 3 órdenes
- Laura (C-358): #CQ-2809 → 1 orden (refunded)
- Andrés (C-341): #CQ-2810, #CQ-2794 → 2 órdenes
- Valentina (C-329): #CQ-2807 → 1 orden (failed)
- Carolina (C-318): #CQ-2818, #CQ-2811, #CQ-2804, #CQ-2793, #CQ-2783 → 5 órdenes

La suma de `total` de órdenes pagadas por cliente debe coincidir con `spent` del cliente.

### Datos: 20 pagos

1:1 con órdenes (misma fecha, mismo monto). Métodos: Bold Tarjeta, Bold Mastercard, PSE Bancolombia, PSE Davivienda, Nequi, Contra-entrega. Fees coherentes (Bold ~3%, PSE ~2%, Nequi ~1%).

### Métodos helpers

```typescript
getCustomer(id: string): Customer | undefined
getOrdersByCustomer(customerId: string): Order[]
getPaymentByOrder(orderId: string): Payment | undefined
getPaymentById(pagoId: string): Payment | undefined
getOrderById(id: string): Order | undefined
```

### KPI helpers para dashboard (computed-friendly)

```typescript
totalIngresos7d(): number     // suma de órdenes paid de los últimos 7 días
totalPedidos7d(): number      // count de órdenes de los últimos 7 días
clientesNuevos7d(): number    // count de clientes con since en últimos 7 días
ticketPromedio(): number      // totalIngresos7d / totalPedidos7d
```

---

## Cambios en admin-home.component.ts

### Eliminar

Todos los arrays `readonly` inline: CHARACTERS, CATEGORIES, SIZES, PRODUCTS, ORDERS, ORDER_DETAIL, CUSTOMERS, PAYMENTS, GATEWAYS, TONE, STATUS_BADGE.

### Agregar

```typescript
private data = inject(MockAdminDataService);

// Exponer datos del servicio
readonly CUSTOMERS   = this.data.CUSTOMERS;
readonly ORDERS      = this.data.ORDERS;
readonly PAYMENTS    = this.data.PAYMENTS;
readonly PRODUCTS    = this.data.PRODUCTS;
readonly CHARACTERS  = this.data.CHARACTERS;
// ... resto de constantes

// Signals para drawers
clienteId = signal<string | null>(null);
pagoId    = signal<string | null>(null);

// KPIs derivados
readonly kpiIngresos   = computed(() => this.data.totalIngresos7d());
readonly kpiPedidos    = computed(() => this.data.totalPedidos7d());
readonly kpiClientes   = computed(() => this.data.clientesNuevos7d());
readonly kpiTicket     = computed(() => this.data.ticketPromedio());

// ORDER_DETAIL dinámico
readonly activeOrder = computed(() =>
  this.data.getOrderById(/* primer orden paid como default */)
);
```

### Métodos nuevos

```typescript
openCliente(id: string) { this.clienteId.set(id); }
closeCliente()          { this.clienteId.set(null); }
openPago(id: string)    { this.pagoId.set(id); }
closePago()             { this.pagoId.set(null); }
```

### Template

En la tabla de Clientes, cada `<tr>` pasa a tener `(click)="openCliente(c.id)"`.
En la tabla de Pagos, cada `<tr>` pasa a tener `(click)="openPago(p.id)"`.
Al final del template, dos drawers condicionales:
```html
@if (clienteId()) {
  <app-cliente-detail [clienteId]="clienteId()!" (close)="closeCliente()" />
}
@if (pagoId()) {
  <app-pago-detail [pagoId]="pagoId()!" (close)="closePago()" />
}
```

---

## ClienteDetailComponent

**Archivo:** `src/app/pages/admin/clientes/cliente-detail.component.ts/html/scss`

**Inputs/outputs:**
```typescript
@Input() clienteId!: string;
@Output() close = new EventEmitter<void>();
```

**Datos:**
- Resuelve cliente: `this.data.getCustomer(this.clienteId)`
- Resuelve órdenes: `this.data.getOrdersByCustomer(this.clienteId)`

**Secciones del drawer:**

1. **Header** — avatar con iniciales, nombre, tag badge, botón cerrar
2. **Info de contacto (editable)** — email, teléfono, ciudad, dirección; signals locales para edición; botón Guardar
3. **Stats** — total gastado, nº pedidos, ticket promedio, cliente desde
4. **Historial de pedidos** — tabla: ID orden, fecha, items, total, estado; click en fila abre drawer de pago (emite evento al parent o navega)

**Estado local:**
```typescript
saving = signal(false);
saved  = signal(false);
editEmail    = signal('');
editPhone    = signal('');
editCiudad   = signal('');
editDireccion = signal('');
```

Inicializa los signals en `ngOnInit` o `ngOnChanges` con los valores del cliente.

---

## PagoDetailComponent

**Archivo:** `src/app/pages/admin/pagos/pago-detail.component.ts/html/scss`

**Inputs/outputs:**
```typescript
@Input() pagoId!: string;
@Output() close = new EventEmitter<void>();
```

**Datos:**
- Resuelve pago: `this.data.getPaymentByOrder(/* orderId from pagoId */)` o por pagoId directo
- Resuelve orden: `this.data.getOrderById(pago.orderId)`
- Resuelve cliente: `this.data.getCustomer(orden.customerId)`

**Secciones del drawer:**

1. **Header** — ID pago, monto, badge estado, botón cerrar
2. **Orden vinculada** — ID orden, fecha, items (count), método de pago
3. **Cliente** — nombre, email, ciudad (link visual al perfil del cliente)
4. **Desglose financiero** — tabla: Monto bruto / Comisión (%) / Neto
5. **Acciones** — botones según estado:
   - Si `pending`: "Marcar pagado", "Cancelar pago"
   - Si `paid`: "Emitir reembolso"
   - Si `refunded`/`failed`: solo "Descargar comprobante"
6. **Estado visual** — badge grande con estado actual

---

## Coherencia de datos: verificación

Al construir el servicio, los datos deben cumplir:

| Regla | Verificación |
|-------|-------------|
| `customer.orders` == count de órdenes del cliente en ORDERS | Sí |
| `customer.spent` == suma de `order.total` donde `status !== 'failed' && status !== 'refunded'` | Sí |
| Cada `payment.orderId` existe en ORDERS | Sí |
| Cada `order.customerId` existe en CUSTOMERS | Sí |
| `payment.amount` == `order.total` (1:1) | Sí |

---

## Archivos a modificar/crear — resumen

| Acción | Archivo |
|--------|---------|
| Crear | `src/app/core/services/mock-admin-data.service.ts` |
| Crear | `src/app/pages/admin/clientes/cliente-detail.component.ts` |
| Crear | `src/app/pages/admin/clientes/cliente-detail.component.html` |
| Crear | `src/app/pages/admin/clientes/cliente-detail.component.scss` |
| Crear | `src/app/pages/admin/pagos/pago-detail.component.ts` |
| Crear | `src/app/pages/admin/pagos/pago-detail.component.html` |
| Crear | `src/app/pages/admin/pagos/pago-detail.component.scss` |
| Modificar | `src/app/pages/admin/admin-home.component.ts` |
| Modificar | `src/app/pages/admin/admin-home.component.html` |
