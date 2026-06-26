# Pagos Export (CSV + XLSX) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Conectar los botones "Exportar para contador" y "Descargar reporte" en la sección Pagos del admin con descarga real de CSV y XLSX, con selector de rango de fechas via dropdown.

**Architecture:** Se crea `PagosExportService` con lógica pura de generación de archivos. El componente `AdminHomeComponent` agrega signals de control de dropdown y métodos que filtran pagos por rango y llaman al servicio. Los dropdowns se cierran con click-outside y Escape via `@HostListener`.

**Tech Stack:** Angular 21 signals, SheetJS (`xlsx`) para XLSX, Blob API del navegador para CSV.

## Global Constraints

- Angular 21, standalone components, signals API (no BehaviorSubject, no NgRx)
- Separador CSV: `;` (compatibilidad Excel Colombia)
- BOM UTF-8 (`﻿`) en el CSV para que Excel abra tildes correctamente
- SheetJS Community Edition: sin estilos de celda (`.s` no disponible en la versión gratuita)
- Nombres de archivo: `cuac-pagos-contador-YYYY-MM.csv` / `cuac-reporte-pagos-YYYY-MM.xlsx`
- `Payment.date` tiene formato `'YYYY-MM-DD HH:mm'`; extraer mes con `.substring(0, 7)`
- El flash toast usa el método `flash()` existente en `AdminHomeComponent`
- No modificar `MockAdminDataService`, `PagoDetailComponent` ni ningún otro archivo fuera de los listados

---

## File Map

| Acción | Archivo |
|--------|---------|
| Instalar dependencia | `package.json` (via `pnpm add xlsx`) |
| **Crear** | `src/app/pages/admin/pagos/pagos-export.service.ts` |
| **Modificar** | `src/app/pages/admin/admin-home.component.ts` |
| **Modificar** | `src/app/pages/admin/admin-home.component.html` (líneas 311-314) |
| **Modificar** | `src/app/pages/admin/admin-home.component.scss` |

---

## Task 1: Instalar xlsx y crear PagosExportService

**Files:**
- Create: `src/app/pages/admin/pagos/pagos-export.service.ts`

**Interfaces:**
- Produces:
  - `exportCsv(payments: Payment[], periodoSlug: string): void`
  - `exportXlsx(payments: Payment[], periodoSlug: string): void`

- [ ] **Step 1: Instalar la librería xlsx**

```bash
pnpm add xlsx
```

Salida esperada: `+ xlsx X.X.X` sin errores.

- [ ] **Step 2: Crear el servicio**

Crear el archivo `src/app/pages/admin/pagos/pagos-export.service.ts` con este contenido exacto:

```typescript
import { Injectable } from '@angular/core';
import { Payment } from '../../../core/services/mock-admin-data.service';
import * as XLSX from 'xlsx';

@Injectable({ providedIn: 'root' })
export class PagosExportService {

  exportCsv(payments: Payment[], periodoSlug: string): void {
    const headers = ['ID Pago', 'Fecha', 'Orden', 'Método', 'Monto', 'Comisión', 'Neto', 'Estado'];
    const rows = payments.map(p => [p.id, p.date, p.order, p.method, p.amount, p.fee, p.net, p.status]);
    const csv = [headers, ...rows].map(r => r.join(';')).join('\n');
    const bom = '﻿';
    const blob = new Blob([bom + csv], { type: 'text/csv;charset=utf-8;' });
    this.triggerDownload(blob, `cuac-pagos-contador-${periodoSlug}.csv`);
  }

  exportXlsx(payments: Payment[], periodoSlug: string): void {
    const paid = payments.filter(p => p.status === 'paid');
    const neto       = paid.reduce((s, p) => s + p.net, 0);
    const comisiones = paid.reduce((s, p) => s + p.fee, 0);
    const pendiente  = payments.filter(p => p.status === 'pending').reduce((s, p) => s + p.amount, 0);
    const reembolsos = payments.filter(p => p.status === 'refunded').reduce((s, p) => s + p.amount, 0);

    const sheetResumen = XLSX.utils.aoa_to_sheet([
      ['KPI', 'Valor (COP)'],
      ['Neto del periodo', neto],
      ['Comisiones',       comisiones],
      ['Pendiente',        pendiente],
      ['Reembolsos',       reembolsos],
    ]);

    const movRows = payments.map(p => [p.id, p.date, p.order, p.method, p.amount, p.fee, p.net, p.status]);
    const sheetMov = XLSX.utils.aoa_to_sheet([
      ['ID Pago', 'Fecha', 'Orden', 'Método', 'Monto', 'Comisión', 'Neto', 'Estado'],
      ...movRows,
    ]);

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, sheetResumen, 'Resumen');
    XLSX.utils.book_append_sheet(wb, sheetMov, 'Movimientos');

    const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
    const blob = new Blob([buf], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    this.triggerDownload(blob, `cuac-reporte-pagos-${periodoSlug}.xlsx`);
  }

  private triggerDownload(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }
}
```

- [ ] **Step 3: Verificar que compila**

```bash
npx ng build --configuration development 2>&1 | tail -5
```

Esperado: `Build at: ... - Hash: ...` sin errores de TypeScript.

- [ ] **Step 4: Commit**

```bash
git add src/app/pages/admin/pagos/pagos-export.service.ts
git commit -m "feat(pagos): add PagosExportService with CSV and XLSX generation"
```

---

## Task 2: Agregar lógica al AdminHomeComponent

**Files:**
- Modify: `src/app/pages/admin/admin-home.component.ts`

**Interfaces:**
- Consumes: `PagosExportService.exportCsv(payments, slug)` y `exportXlsx(payments, slug)` del Task 1
- Produces (para el HTML del Task 3):
  - `exportContadorOpen: Signal<boolean>`
  - `exportReporteOpen: Signal<boolean>`
  - `toggleExportContador(): void`
  - `toggleExportReporte(): void`
  - `descargarContador(rango: string): void`
  - `descargarReporte(rango: string): void`

- [ ] **Step 1: Añadir import y inyección del servicio**

En `src/app/pages/admin/admin-home.component.ts`, añadir el import al inicio del archivo junto a los imports existentes:

```typescript
import { PagosExportService } from './pagos/pagos-export.service';
```

Y dentro de la clase, junto a los otros injects (después de `private ga = inject(...)`):

```typescript
private exportSvc = inject(PagosExportService);
```

- [ ] **Step 2: Añadir signals de control de dropdown**

Dentro de la clase `AdminHomeComponent`, después del bloque `// ── Drawer states`:

```typescript
// ── Export dropdowns ───────────────────────────────────────────────────────
exportContadorOpen = signal(false);
exportReporteOpen  = signal(false);
```

- [ ] **Step 3: Añadir HostListener para click-outside y Escape**

Añadir el decorator `HostListener` al import existente de `@angular/core` si no está (ya está importado como `HostListener` en el archivo — verificar).

Añadir los dos listeners dentro de la clase, antes de `ngOnInit`:

```typescript
@HostListener('document:click')
onDocClick() {
  this.exportContadorOpen.set(false);
  this.exportReporteOpen.set(false);
}

@HostListener('document:keydown.escape')
onExportEscape() {
  this.exportContadorOpen.set(false);
  this.exportReporteOpen.set(false);
}
```

> Nota: `HostListener` ya está importado desde `@angular/core` en la línea 1. No duplicar el import.

- [ ] **Step 4: Añadir los métodos de exportación**

Dentro de la clase, después del método `closePago()`:

```typescript
// ── Export helpers ─────────────────────────────────────────────────────────
toggleExportContador() {
  this.exportContadorOpen.update(v => !v);
  this.exportReporteOpen.set(false);
}

toggleExportReporte() {
  this.exportReporteOpen.update(v => !v);
  this.exportContadorOpen.set(false);
}

filterPayments(rango: string): Payment[] {
  const hoy     = new Date();
  const mesActual = hoy.toISOString().substring(0, 7);
  const mesPasado = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1)
    .toISOString().substring(0, 7);
  const hace90 = new Date(hoy.getTime() - 90 * 24 * 60 * 60 * 1000);

  switch (rango) {
    case 'mes':       return this.PAYMENTS.filter(p => p.date.substring(0, 7) === mesActual);
    case 'mes-pasado':return this.PAYMENTS.filter(p => p.date.substring(0, 7) === mesPasado);
    case '3meses':    return this.PAYMENTS.filter(p => new Date(p.date) >= hace90);
    default:          return [...this.PAYMENTS];
  }
}

periodoSlug(rango: string): string {
  const hoy = new Date();
  switch (rango) {
    case 'mes':        return hoy.toISOString().substring(0, 7);
    case 'mes-pasado': return new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1)
      .toISOString().substring(0, 7);
    case '3meses':     return `${hoy.toISOString().substring(0, 7)}-3m`;
    default:           return 'todo';
  }
}

periodoLabel(rango: string): string {
  const hoy = new Date();
  const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
                 'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  switch (rango) {
    case 'mes':
      return `${MESES[hoy.getMonth()]} ${hoy.getFullYear()}`;
    case 'mes-pasado': {
      const m = hoy.getMonth() === 0 ? 11 : hoy.getMonth() - 1;
      const y = hoy.getMonth() === 0 ? hoy.getFullYear() - 1 : hoy.getFullYear();
      return `${MESES[m]} ${y}`;
    }
    case '3meses': return 'Últimos 3 meses';
    default:       return 'Historial completo';
  }
}

descargarContador(rango: string) {
  const pagos = this.filterPayments(rango);
  this.exportSvc.exportCsv(pagos, this.periodoSlug(rango));
  this.exportContadorOpen.set(false);
  this.flash(`✓ Exportado · ${pagos.length} movimientos · ${this.periodoLabel(rango)}`);
}

descargarReporte(rango: string) {
  const pagos = this.filterPayments(rango);
  this.exportSvc.exportXlsx(pagos, this.periodoSlug(rango));
  this.exportReporteOpen.set(false);
  this.flash(`✓ Exportado · ${pagos.length} movimientos · ${this.periodoLabel(rango)}`);
}
```

- [ ] **Step 5: Verificar que compila**

```bash
npx ng build --configuration development 2>&1 | tail -5
```

Esperado: sin errores de TypeScript.

- [ ] **Step 6: Commit**

```bash
git add src/app/pages/admin/admin-home.component.ts
git commit -m "feat(pagos): wire export signals and methods in AdminHomeComponent"
```

---

## Task 3: Actualizar el HTML con los dropdowns

**Files:**
- Modify: `src/app/pages/admin/admin-home.component.html` (líneas 311-314)

**Interfaces:**
- Consumes: todos los métodos y signals del Task 2

- [ ] **Step 1: Reemplazar los dos botones del header de Pagos**

Localizar en `admin-home.component.html` el bloque de líneas 311-314 (dentro de `@case ('pagos')`):

```html
          <div class="ph-r">
            <button class="btn-sm ghost">Exportar para contador</button>
            <button class="btn-sm solid">Descargar reporte</button>
          </div>
```

Reemplazarlo con:

```html
          <div class="ph-r">
            <div class="export-wrap" (click)="$event.stopPropagation()">
              <button class="btn-sm ghost" (click)="toggleExportContador()">Exportar para contador</button>
              @if (exportContadorOpen()) {
                <div class="export-dropdown">
                  <button class="export-opt" (click)="descargarContador('mes')">Este mes</button>
                  <button class="export-opt" (click)="descargarContador('mes-pasado')">Mes pasado</button>
                  <button class="export-opt" (click)="descargarContador('3meses')">Últimos 3 meses</button>
                  <button class="export-opt" (click)="descargarContador('todo')">Todo el historial</button>
                </div>
              }
            </div>
            <div class="export-wrap" (click)="$event.stopPropagation()">
              <button class="btn-sm solid" (click)="toggleExportReporte()">Descargar reporte</button>
              @if (exportReporteOpen()) {
                <div class="export-dropdown">
                  <button class="export-opt" (click)="descargarReporte('mes')">Este mes</button>
                  <button class="export-opt" (click)="descargarReporte('mes-pasado')">Mes pasado</button>
                  <button class="export-opt" (click)="descargarReporte('3meses')">Últimos 3 meses</button>
                  <button class="export-opt" (click)="descargarReporte('todo')">Todo el historial</button>
                </div>
              }
            </div>
          </div>
```

- [ ] **Step 2: Verificar que compila**

```bash
npx ng build --configuration development 2>&1 | tail -5
```

Esperado: sin errores de template.

- [ ] **Step 3: Commit**

```bash
git add src/app/pages/admin/admin-home.component.html
git commit -m "feat(pagos): add export dropdowns to Pagos header"
```

---

## Task 4: Añadir estilos del dropdown

**Files:**
- Modify: `src/app/pages/admin/admin-home.component.scss`

**Interfaces:**
- Consumes: clases `.export-wrap`, `.export-dropdown`, `.export-opt` usadas en el HTML del Task 3
- Variables CSS existentes del proyecto: `--paper`, `--carbon-12`, `--carbon-08`, `--carbon`, `--cream-2`

- [ ] **Step 1: Añadir los estilos**

El archivo actualmente solo contiene:
```scss
:host {
  display: block;
}
```

Añadir debajo:

```scss
// ── Export dropdown ──────────────────────────────────────────────────────────
.export-wrap {
  position: relative;
  display: inline-flex;
}

.export-dropdown {
  position: absolute;
  top: calc(100% + 6px);
  right: 0;
  min-width: 180px;
  background: var(--paper);
  border: 1px solid var(--carbon-12);
  border-radius: 10px;
  box-shadow: 0 12px 48px rgba(21, 31, 40, 0.14), 0 2px 8px rgba(21, 31, 40, 0.08);
  z-index: 200;
  overflow: hidden;
  animation: exportIn 0.12s ease;
}

@keyframes exportIn {
  from { opacity: 0; transform: translateY(-5px); }
  to   { opacity: 1; transform: translateY(0); }
}

.export-opt {
  display: block;
  width: 100%;
  padding: 9px 14px;
  font: inherit;
  font-size: 13px;
  text-align: left;
  background: none;
  border: 0;
  color: var(--carbon);
  cursor: pointer;
  transition: background 0.1s;

  &:not(:last-child) {
    border-bottom: 1px solid var(--carbon-08);
  }

  &:hover {
    background: var(--cream-2);
  }
}
```

- [ ] **Step 2: Build final y verificación manual**

```bash
npx ng build --configuration development 2>&1 | tail -5
```

Luego iniciar el servidor de desarrollo:

```bash
npx ng serve
```

Verificar en `http://localhost:4200/admin`:
1. Ir a la sección **Pagos** (clic en "Pagos" en el nav lateral)
2. Clic en "Exportar para contador" → debe aparecer dropdown con 4 opciones
3. Clic en "Mes pasado" → debe descargarse `cuac-pagos-contador-2026-05.csv` (los datos mock son de mayo 2026)
4. Abrir el CSV en Excel/Numbers: verificar 8 columnas con separador `;`, tildes correctas
5. Clic en "Descargar reporte" → dropdown aparece, el contador se cierra automáticamente
6. Clic en "Todo el historial" → descarga `cuac-reporte-pagos-todo.xlsx`
7. Abrir el XLSX: verificar hoja "Resumen" con KPIs y hoja "Movimientos" con 20 filas
8. Clic fuera de cualquier dropdown → se cierra
9. Abrir dropdown + presionar Escape → se cierra

- [ ] **Step 3: Commit final**

```bash
git add src/app/pages/admin/admin-home.component.scss
git commit -m "feat(pagos): export dropdown styles"
```
