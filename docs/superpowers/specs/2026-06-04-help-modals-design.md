# Cuaquiverso Help Modals — Spec

**Fecha:** 2026-06-04
**Estado:** Aprobado

---

## 1. Objetivo

Tres modales informativos centrados (Envíos, Devoluciones, Guía de tallas) accesibles desde los links de "Ayuda" en el footer de Cuaquiverso. El link Contacto mantiene su `mailto:`.

---

## 2. Archivos

| Acción  | Archivo                                                                         | Responsabilidad                                  |
|---------|---------------------------------------------------------------------------------|--------------------------------------------------|
| Crear   | `src/app/pages/cuaquiverso/help-modal/help-modal.service.ts`                   | Signal `activeModal`, `open()`, `close()`        |
| Crear   | `src/app/pages/cuaquiverso/help-modal/help-modal.component.ts`                 | Modal centrado con cambio de contenido por tipo  |
| Crear   | `src/app/pages/cuaquiverso/help-modal/help-modal.component.html`               | Template del modal                               |
| Crear   | `src/app/pages/cuaquiverso/help-modal/help-modal.component.scss`               | Estilos (overlay + card centrada)                |
| Modificar | `src/app/pages/cuaquiverso/cuaquiverso.component.html`                       | Montar `<app-help-modal>`                        |
| Modificar | `src/app/pages/cuaquiverso/cuaquiverso.component.ts`                         | Importar `HelpModalComponent`                    |
| Modificar | `src/app/pages/cuaquiverso/footer/cuaquiverso-footer.component.html`         | Links llaman `helpModal.open(...)`               |
| Modificar | `src/app/pages/cuaquiverso/footer/cuaquiverso-footer.component.ts`           | Inyectar `HelpModalService`                      |

---

## 3. HelpModalService

```typescript
export type HelpModalType = 'envios' | 'devoluciones' | 'tallas';

@Injectable({ providedIn: 'root' })
export class HelpModalService {
  activeModal = signal<HelpModalType | null>(null);
  open(type: HelpModalType): void  { this.activeModal.set(type); }
  close(): void                     { this.activeModal.set(null); }
}
```

---

## 4. HelpModalComponent

- Selector: `app-help-modal`
- Standalone, importa `RouterLink`
- Inyecta `HelpModalService`
- `@HostListener('document:keydown.escape')` llama `service.close()`
- Renderiza con `@if (service.activeModal() !== null)`
- Estructura DOM:
  ```
  .hm-overlay  (click) → close()
    .hm-card    (click.stop) → nada
      .hm-head
        .hm-eyebrow + h2 + button.hm-close
      .hm-body
        @switch (service.activeModal())
          'envios'       → contenido envíos
          'devoluciones' → contenido devoluciones
          'tallas'       → tabla de tallas
  ```

---

## 5. Contenido de los modales

### 5.1 Envíos
- **Eyebrow:** Ayuda
- **Título:** Envíos
- Cobertura: todo Colombia vía Coordinadora / Servientrega
- Tiempo: Bogotá 1–2 días hábiles; resto del país 3–5 días hábiles
- Costo: desde $8.000 COP, calculado al hacer checkout según destino
- Nota: tirajes cortos — despachamos dentro de 5 días hábiles tras confirmar el pago
- Footer del modal: link a `hola@cuacdesign.com`

### 5.2 Devoluciones
- **Eyebrow:** Ayuda
- **Título:** Cambios y devoluciones
- Plazo: 10 días calendario desde recibir el pedido
- Condiciones: producto sin uso, con empaque original
- No aplica: productos personalizados o ediciones especiales
- Proceso: escribir a `hola@cuacdesign.com` con foto y número de pedido
- Cambio de talla: sujeto a disponibilidad de stock
- Footer del modal: link a `hola@cuacdesign.com`

### 5.3 Guía de tallas
- **Eyebrow:** Camisetas
- **Título:** Guía de tallas
- Tabla:

| Talla | Pecho | Largo | Hombro |
|-------|-------|-------|--------|
| S     | 48 cm | 68 cm | 42 cm  |
| M     | 51 cm | 70 cm | 44 cm  |
| L     | 54 cm | 72 cm | 46 cm  |
| XL    | 57 cm | 74 cm | 48 cm  |

- Nota: medidas del producto plano. Se recomienda talla normal o una arriba para fit holgado.

---

## 6. Estilos

### Overlay
```scss
.hm-overlay {
  position: fixed;
  inset: 0;
  z-index: 300;
  background: rgba(21, 31, 40, 0.6);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--s-5);
  animation: hm-overlay-in 0.22s ease-out both;
}
@keyframes hm-overlay-in {
  from { opacity: 0; }
  to   { opacity: 1; }
}
```

### Card
```scss
.hm-card {
  background: #151F28;
  border-radius: var(--r-lg);
  border: 1px solid rgba(236, 239, 243, 0.08);
  width: 100%;
  max-width: 480px;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  animation: hm-card-in 0.22s cubic-bezier(0.16, 1, 0.3, 1) both;
}
@keyframes hm-card-in {
  from { opacity: 0; transform: scale(0.95); }
  to   { opacity: 1; transform: scale(1); }
}
```

### Header, body, tabla
- `.hm-head`: `padding: 20px 24px`, border-bottom, flex space-between
- `.hm-eyebrow`: mono 10px, ember color, uppercase
- `.hm-head h2`: 17px, font-weight 600
- `.hm-close`: 36×36px, circular, same style as cart modal close btn
- `.hm-body`: `padding: 24px`, `overflow-y: auto`, `flex: 1`
- `.hm-table`: `width: 100%`, `border-collapse: collapse`, filas alternadas `rgba(255,255,255,0.04)`
- `.hm-footer`: `padding: 16px 24px`, border-top, link a email

---

## 7. Footer wiring

```html
<!-- cuaquiverso-footer.component.html -->
<li><button (click)="helpModal.open('envios')">Envíos</button></li>
<li><button (click)="helpModal.open('devoluciones')">Devoluciones</button></li>
<li><button (click)="helpModal.open('tallas')">Guía de tallas</button></li>
<li><a href="mailto:hola@cuacdesign.com">Contacto</a></li>
```

Los `<button>` toman el estilo visual de los `<a>` del footer (misma fuente, color, sin border/bg).

---

## 8. No incluido

- Contenido de modales gestionado desde CMS/admin
- Animación de salida (el cierre es instantáneo — aceptable para este scope)
- Tallas para productos distintos a camisetas (se añaden cuando existan)
