# Pagos: Exportar para contador y Descargar reporte

**Fecha:** 2026-06-25
**Branch:** feat/favicon (a implementar sobre este branch)

## Resumen

Conectar los dos botones existentes en la sección Pagos del panel `/admin` ("Exportar para contador" y "Descargar reporte") con descarga real de archivos. Cada botón abre un dropdown de rango de fechas; al seleccionar un rango se descarga el archivo inmediatamente.

---

## Funcionalidad

### Botón "Exportar para contador"
- Produce un archivo **CSV** con separador `;` (compatibilidad con Excel en español/Colombia)
- Columnas: `ID Pago ; Fecha ; Orden ; Método ; Monto ; Comisión ; Neto ; Estado`
- Nombre de archivo: `cuac-pagos-contador-YYYY-MM.csv` (sufijo del periodo)

### Botón "Descargar reporte"
- Produce un archivo **XLSX** (SheetJS Community Edition)
- Hoja 1 — `Resumen`: 4 KPIs del periodo (Neto, Comisiones, Pendiente, Reembolsos)
- Hoja 2 — `Movimientos`: mismas columnas que el CSV, cabeceras en negrita, columnas numéricas como tipo número
- Nombre de archivo: `cuac-reporte-pagos-YYYY-MM.xlsx`

### Rango de fechas (común a ambos)
Dropdown con 4 opciones:
1. Este mes
2. Mes pasado
3. Últimos 3 meses
4. Todo el historial

El filtro opera sobre el campo `date` de cada `Payment`.

---

## Arquitectura

### Nuevo archivo
**`src/app/pages/admin/pagos/pagos-export.service.ts`**

Servicio `@Injectable({ providedIn: 'root' })` con dos métodos públicos:

```ts
exportCsv(payments: Payment[], periodo: string): void
exportXlsx(payments: Payment[], periodo: string): void
```

Ambos métodos:
1. Construyen el contenido del archivo en memoria
2. Crean un `Blob` y una URL temporal con `URL.createObjectURL`
3. Disparan la descarga via un `<a>` temporal con `click()`
4. Revocan la URL con `URL.revokeObjectURL`

El servicio no tiene dependencias de Angular más allá de la inyección; toda la lógica es pura.

### Cambios en `admin-home.component.ts`

Nuevos signals:
```ts
exportContadorOpen = signal(false);
exportReporteOpen  = signal(false);
```

Computed de pagos filtrados (recibe el rango como argumento, no como signal, para no mantener estado de rango):
```ts
filterPayments(rango: string): Payment[]
```

Lógica de rango en `filterPayments(rango)`:
El campo `Payment.date` tiene formato `'YYYY-MM-DD HH:mm'`. Se extrae el prefijo `date.substring(0, 7)` → `'YYYY-MM'` para comparar con el mes.

- `'mes'`: `date.substring(0,7) === hoy.toISOString().substring(0,7)`
- `'mes-pasado'`: prefijo igual al mes anterior calculado como `new Date(hoy.getFullYear(), hoy.getMonth()-1, 1).toISOString().substring(0,7)`
- `'3meses'`: `new Date(date) >= new Date(hoy - 90 días)`
- `'todo'`: todos los pagos sin filtro

Nuevos métodos:
```ts
descargarContador(rango: string): void  // llama exportCsv, cierra dropdown, flash()
descargarReporte(rango: string): void   // llama exportXlsx, cierra dropdown, flash()
toggleExportContador(): void
toggleExportReporte(): void
```

`@HostListener('document:keydown')` ya existe en `admin-shell`; en `admin-home` se añade solo el cierre con Escape para los dropdowns de exportación.

Click-outside: se usa el patrón de `(click)` con `$event.stopPropagation()` en el dropdown + `(document:click)` handler que cierra ambos.

### Cambios en `admin-home.component.html`

Los botones existentes (líneas 312-313) reciben `(click)` con `stopPropagation` y abren su dropdown:

```html
<div class="export-wrap" (click)="$event.stopPropagation()">
  <button class="btn-sm ghost" (click)="toggleExportContador()">
    Exportar para contador
  </button>
  @if (exportContadorOpen()) {
    <div class="export-dropdown">
      <button (click)="descargarContador('mes')">Este mes</button>
      <button (click)="descargarContador('mes-pasado')">Mes pasado</button>
      <button (click)="descargarContador('3meses')">Últimos 3 meses</button>
      <button (click)="descargarContador('todo')">Todo el historial</button>
    </div>
  }
</div>
```

(Idem para el botón "Descargar reporte")

### Dependencia nueva

**`xlsx`** (SheetJS Community Edition)

```bash
npm install xlsx
```

~600 KB minificado, tree-shakeable. Solo se importa dentro de `pagos-export.service.ts`.

---

## Estilos

El dropdown `.export-dropdown` se añade al SCSS de `admin-home.component.scss` con:
- `position: absolute`, `z-index: 200`, anclado al wrapper
- Mismo border-radius y sombra que los paneles del admin
- Hover sobre cada opción con `background: var(--cream-2)`
- `.export-wrap` con `position: relative; display: inline-flex`

---

## Toast de confirmación

Al completar la descarga se llama `this.flash()` con mensaje:
```
✓ Exportado · N movimientos · [Periodo]
```
Ejemplo: `✓ Exportado · 18 movimientos · Mayo 2026`

El periodo legible se mapea desde el valor del rango:
- `'mes'` → nombre del mes actual + año
- `'mes-pasado'` → nombre del mes anterior + año
- `'3meses'` → `Últimos 3 meses`
- `'todo'` → `Historial completo`

---

## Casos límite

- **Sin pagos en el rango**: se descarga el archivo vacío (CSV con solo cabeceras, XLSX con hoja de resumen en ceros y movimientos vacía) y el toast dice `✓ Exportado · 0 movimientos`.
- **Datos mock**: los pagos tienen fechas de abril-mayo 2026; "Este mes" (junio 2026) puede retornar 0 filas — comportamiento correcto y esperado con datos mock.
- **Cierre del dropdown**: Escape o click fuera cierra ambos dropdowns; abrir uno cierra el otro automáticamente.

---

## Fuera de alcance

- Filtro de estado (solo pagados, solo reembolsos, etc.)
- Filtro por pasarela
- Envío por email al contador
- Exportación desde la vista de detalle de un pago individual
