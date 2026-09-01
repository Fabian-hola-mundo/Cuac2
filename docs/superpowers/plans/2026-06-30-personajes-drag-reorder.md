# Personajes Drag Reorder Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the ▲/▼ order buttons in `/admin` → Contenido (`PersonajesListComponent`) with a drag handle so personajes can be reordered by dragging rows, using Angular CDK Drag & Drop.

**Architecture:** `.drag-list` becomes a `cdkDropList`; each `.drag-row` becomes a `cdkDrag` with a dedicated `.drag-handle` icon (`cdkDragHandle`) replacing the old `.order-btns`. On drop, `moveItemInArray` reorders a local copy of the signal array, `sort_order` is recalculated for the whole list, and `PersonajesService.updateOrder()` persists it — same save flow as the current `moveUp`/`moveDown`.

**Tech Stack:** Angular 21 standalone components, `@angular/cdk/drag-drop` (already a dependency, no install needed), SCSS.

## Global Constraints

- Scope is limited to `src/app/pages/admin/personajes/personajes-list.component.{ts,html,scss}` — no other admin list is touched (per spec, `docs/superpowers/specs/2026-06-30-personajes-drag-reorder-design.md`).
- No new npm dependency — `@angular/cdk` is already in `package.json` (`^21.2.13`).
- `PersonajesService.updateOrder()` is not modified.
- Auto-save on drop (no separate "Guardar orden" button) — matches current `moveUp`/`moveDown` behavior.
- This codebase has no `*.spec.ts` files under `src/app/pages/admin` — verification is manual in the browser, not via `ng test`. Follow that existing convention; don't introduce a spec file for this component.

---

### Task 1: Drag-and-drop reorder for personajes list

**Files:**
- Modify: `src/app/pages/admin/personajes/personajes-list.component.ts`
- Modify: `src/app/pages/admin/personajes/personajes-list.component.html`
- Modify: `src/app/pages/admin/personajes/personajes-list.component.scss`

**Interfaces:**
- Consumes: `PersonajesService.personajes` (a `WritableSignal<Personaje[]>`, read via `svc.personajes()`, written via `svc.personajes.set(...)`), `PersonajesService.updateOrder(items: { id: string; sort_order: number }[]): Promise<{ error: string | null }>`, `Personaje` type — all from `../../../core/services/personajes.service`, unchanged.
- Produces: `PersonajesListComponent.onDrop(event: CdkDragDrop<Personaje[]>): Promise<void>` — replaces `moveUp`/`moveDown`, called from the template's `(cdkDropListDropped)` binding.

- [ ] **Step 1: Update component TypeScript — replace `moveUp`/`moveDown` with `onDrop`**

Edit `src/app/pages/admin/personajes/personajes-list.component.ts`:

Replace the imports block:

```typescript
import { Component, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { PersonajesService, Personaje } from '../../../core/services/personajes.service';
```

with:

```typescript
import { Component, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { DragDropModule, CdkDragDrop, moveItemInArray } from '@angular/cdk/drag-drop';
import { PersonajesService, Personaje } from '../../../core/services/personajes.service';
```

Replace the `@Component` decorator's `imports` array:

```typescript
  imports: [CommonModule],
```

with:

```typescript
  imports: [CommonModule, DragDropModule],
```

Replace the `moveUp` and `moveDown` methods:

```typescript
  async moveUp(p: Personaje) {
    const items = [...this.svc.personajes()];
    const idx = items.findIndex(x => x.id === p.id);
    if (idx <= 0) return;
    [items[idx - 1], items[idx]] = [items[idx], items[idx - 1]];
    this.svc.personajes.set(items);
    const updates = items.map((x, i) => ({ id: x.id, sort_order: i + 1 }));
    await this.svc.updateOrder(updates);
    this.flash('Orden guardado');
  }

  async moveDown(p: Personaje) {
    const items = [...this.svc.personajes()];
    const idx = items.findIndex(x => x.id === p.id);
    if (idx < 0 || idx >= items.length - 1) return;
    [items[idx], items[idx + 1]] = [items[idx + 1], items[idx]];
    this.svc.personajes.set(items);
    const updates = items.map((x, i) => ({ id: x.id, sort_order: i + 1 }));
    await this.svc.updateOrder(updates);
    this.flash('Orden guardado');
  }
```

with:

```typescript
  async onDrop(event: CdkDragDrop<Personaje[]>) {
    if (event.previousIndex === event.currentIndex) return;
    const items = [...this.svc.personajes()];
    moveItemInArray(items, event.previousIndex, event.currentIndex);
    this.svc.personajes.set(items);
    const updates = items.map((x, i) => ({ id: x.id, sort_order: i + 1 }));
    await this.svc.updateOrder(updates);
    this.flash('Orden guardado');
  }
```

The rest of the file (`toggleActivo`, `confirmDelete`, `deleteConfirmed`, `cancelDelete`, `goNuevo`, `goDetalle`, `goEditar`, `flash`) is unchanged.

- [ ] **Step 2: Update the template — wire up `cdkDropList`/`cdkDrag` and replace the order buttons with a drag handle**

Edit `src/app/pages/admin/personajes/personajes-list.component.html`.

Replace:

```html
<div class="drag-list">
  @for (p of svc.personajes(); track p.id; let first = $first; let last = $last) {
    <div class="drag-row">
      <div class="order-btns">
        <button class="order-btn" [disabled]="first" (click)="moveUp(p)" title="Subir">▲</button>
        <button class="order-btn" [disabled]="last"  (click)="moveDown(p)" title="Bajar">▼</button>
      </div>
```

with:

```html
<div class="drag-list" cdkDropList (cdkDropListDropped)="onDrop($event)">
  @for (p of svc.personajes(); track p.id) {
    <div class="drag-row" cdkDrag [cdkDragData]="p">
      <div class="drag-handle" cdkDragHandle title="Arrastrar para reordenar">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="6" r="1.5" fill="currentColor" stroke="none"/><circle cx="15" cy="6" r="1.5" fill="currentColor" stroke="none"/><circle cx="9" cy="12" r="1.5" fill="currentColor" stroke="none"/><circle cx="15" cy="12" r="1.5" fill="currentColor" stroke="none"/><circle cx="9" cy="18" r="1.5" fill="currentColor" stroke="none"/><circle cx="15" cy="18" r="1.5" fill="currentColor" stroke="none"/></svg>
      </div>
```

`first`/`last` template variables are no longer used anywhere else in this file (they were only used by the removed `[disabled]` bindings), so dropping them from the `@for` is correct — confirm with a search before moving on (Step 3 below covers this).

The rest of the rows (`.row-thumb`, `.row-info`, `.row-order`, `.toggle-btn`, `.row-actions`, the closing `}` for `@for`, the confirm overlay, the toast) stay exactly as they are — only the opening `<div class="drag-list">` line, the `@for` line, the row's opening `<div class="drag-row">` line, and the `.order-btns` block change.

- [ ] **Step 3: Confirm no other references to `first`, `last`, `moveUp`, or `moveDown` remain**

Run:

```bash
grep -n "moveUp\|moveDown\|\$first\|\$last" src/app/pages/admin/personajes/personajes-list.component.html src/app/pages/admin/personajes/personajes-list.component.ts
```

Expected: no output (empty match). If anything matches, it's leftover from Steps 1–2 — remove it.

- [ ] **Step 4: Update styles — drag handle + CDK drag feedback classes**

Edit `src/app/pages/admin/personajes/personajes-list.component.scss`.

Replace:

```scss
.order-btns {
  display: flex; flex-direction: column; gap: 2px; flex-shrink: 0;
}
.order-btn {
  width: 22px; height: 22px; border: none; border-radius: 4px;
  background: transparent; color: var(--carbon-40); cursor: pointer;
  font-size: 10px; display: flex; align-items: center; justify-content: center;
  padding: 0; line-height: 1;
  &:hover:not(:disabled) { background: var(--carbon-08); color: var(--carbon); }
  &:disabled { opacity: 0.2; cursor: default; }
}
```

with:

```scss
.drag-handle {
  width: 22px; height: 32px; flex-shrink: 0;
  display: flex; align-items: center; justify-content: center;
  color: var(--carbon-40); border-radius: 4px;
  cursor: grab;
  &:hover { background: var(--carbon-08); color: var(--carbon); }
  &:active { cursor: grabbing; }
}

.cdk-drag-preview {
  box-shadow: 0 8px 24px rgba(0,0,0,.16);
  background: var(--paper);
  border-radius: var(--r-md);
  opacity: 1;
}

.cdk-drag-placeholder {
  opacity: 0.3;
}

.cdk-drop-list-dragging .drag-row:not(.cdk-drag-placeholder) {
  transition: transform 200ms cubic-bezier(0, 0, 0.2, 1);
}
```

The rest of the SCSS file (`.list-header`, `.btn-primary`, `.loading`, `.drag-list`, `.drag-row`, `.row-thumb`, `.row-info`, `.row-order`, `.toggle-btn`, `.row-actions`, `.confirm-overlay`, `.confirm-box`, `.confirm-actions`, `.toast`) is unchanged.

- [ ] **Step 5: Build check**

Run:

```bash
pnpm run build
```

Expected: build completes with no TypeScript or template compilation errors (no "Can't bind to 'cdkDropList'" or unresolved `moveUp`/`moveDown` reference errors). Pre-existing warnings unrelated to this file are fine; a new error referencing `personajes-list.component` is not.

- [ ] **Step 6: Manual verification in the browser**

Run:

```bash
pnpm start
```

Then in the browser:
1. Navigate to `/admin/personajes` (or click "Contenido" in the admin nav).
2. Confirm the ▲/▼ buttons are gone and each row shows a ⋮⋮ drag handle on the left instead.
3. Press and drag a row by its handle to a different position in the list, then release. Confirm: the row visually moves to the new position, a "Orden guardado" toast appears, and the `#N` order number column (`.row-order`) updates to match the new positions for the affected rows.
4. Refresh the page. Confirm the new order persisted (i.e. it was actually written to Supabase via `updateOrder`, not just held in local state).
5. Drag the first row further down and the last row further up, to confirm there's no leftover `first`/`last`-disabled behavior blocking moves at the list boundaries (the old buttons disabled at the edges; the drag handle should have no such restriction).
6. Confirm dragging does **not** accidentally trigger `goDetalle`/`goEditar`/`confirmDelete`/`toggleActivo` — clicking those buttons normally (not dragging) should still work as before.
7. Confirm a normal click on a row outside the handle (e.g. on `.row-info`) does not start a drag.

Stop the dev server (Ctrl+C) once verified.

- [ ] **Step 7: Commit**

```bash
git add src/app/pages/admin/personajes/personajes-list.component.ts src/app/pages/admin/personajes/personajes-list.component.html src/app/pages/admin/personajes/personajes-list.component.scss
git commit -m "feat(admin): reemplaza botones de orden por drag handle en personajes"
```
