# Legal Pages — Términos, Privacidad y Cookies

**Fecha:** 2026-06-04
**Proyecto:** Cuac Design + Cuaquiverso
**Estado:** Aprobado

---

## 1. Objetivo

Crear tres páginas legales accesibles desde el footer de Cuac y el footer de Cuaquiverso, más un banner global de consentimiento de cookies.

---

## 2. Rutas nuevas

| Ruta         | Componente                | Archivo                                          |
|-------------|---------------------------|--------------------------------------------------|
| `/terminos`  | `LegalTerminosComponent`  | `src/app/pages/legal/terminos.component.ts`      |
| `/privacidad`| `LegalPrivacidadComponent`| `src/app/pages/legal/privacidad.component.ts`    |
| `/cookies`   | `LegalCookiesComponent`   | `src/app/pages/legal/cookies.component.ts`       |

Todos lazy-loaded en `app.routes.ts`. No se crean rutas duplicadas bajo `/cuaquiverso/`; ambos footers enlazan a las mismas rutas.

---

## 3. Arquitectura de componentes

### 3.1 Páginas legales

Cada página es un componente standalone Angular que:
- Importa el `FooterComponent` existente (`src/app/layout/footer/`).
- Importa el `TopbarComponent` existente (`src/app/layout/topbar/`).
- Usa un layout de artículo: columna central ~680px, responsive.

Estructura HTML de cada página:
```
<app-topbar />                      ← TopbarComponent de src/app/layout/topbar/
<main class="legal-page">
  <div class="legal-hero">
    <span class="eyebrow">...</span>
    <h1>Título</h1>
    <p class="updated">Última actualización: junio 2026</p>
  </div>
  <div class="legal-body">
    <!-- secciones h2 numeradas -->
  </div>
</main>
<app-footer />                      ← FooterComponent de src/app/layout/footer/
```

### 3.2 CookieBannerComponent

- Selector: `app-cookie-banner`
- Archivo: `src/app/shared/cookie-banner/cookie-banner.component.ts`
- Registrado en `app.ts` (template global junto a `<router-outlet />`)
- **Lógica:**
  - Al init: lee `localStorage['cookie_consent']`
  - Si no existe: muestra el banner
  - Auto-oculta a los **30 segundos** (sin guardar preferencia — el usuario simplemente no interactuó)
  - Botón "Aceptar": guarda `'accepted'`, oculta banner
  - Botón "Rechazar": guarda `'rejected'`, oculta banner
  - Si ya hay valor en localStorage: nunca muestra el banner

### 3.3 CookieConsentService

- Archivo: `src/app/core/services/cookie-consent.service.ts`
- Expone:
  - `getConsent(): 'accepted' | 'rejected' | null`
  - `setConsent(value: 'accepted' | 'rejected'): void`
  - `hasConsent(): boolean`

---

## 4. Contenido de las páginas

### 4.1 Términos y condiciones

Secciones numeradas:
1. Identificación del responsable — Cuac Design SAS, Bogotá, Colombia
2. Objeto y alcance — uso del sitio cuac.design y tienda Cuaquiverso
3. Condiciones de uso del sitio
4. Propiedad intelectual — todo el contenido visual, textual y de marca pertenece a Cuac Design
5. Condiciones de compra (Cuaquiverso) — proceso de pedido, precios en COP, disponibilidad de stock
6. Limitación de responsabilidad
7. Modificaciones a los términos
8. Ley aplicable — República de Colombia, jurisdicción Bogotá D.C.

### 4.2 Política de privacidad

Secciones numeradas (marco: Ley 1581 de 2012 y Decreto 1377 de 2013):
1. Responsable del tratamiento — Cuac Design, hola@cuacdesign.com
2. Datos que recolectamos — nombre, email, teléfono (cotizaciones); datos de envío (checkout); analytics anónimos
3. Finalidad del tratamiento — responder cotizaciones, procesar pedidos, mejorar el sitio
4. Base legal del tratamiento
5. Derechos del titular — acceso, rectificación, supresión, portabilidad; ejercibles vía hola@cuacdesign.com
6. Transferencia de datos a terceros — proveedores de pago y envío únicamente
7. Tiempo de conservación — datos de pedido 5 años por obligación fiscal
8. Seguridad de los datos
9. Cambios a esta política

### 4.3 Política de cookies

Secciones numeradas:
1. Qué son las cookies
2. Cookies que usamos:
   - Funcionales: sesión de carrito (Cuaquiverso)
   - Analíticas: comportamiento de navegación anónimo
   - De preferencia: `cookie_consent` en localStorage
3. Cookies de terceros — si aplica (analytics)
4. Cómo gestionar o deshabilitar cookies — instrucciones por navegador
5. Más información — link a `/privacidad`

---

## 5. Cambios en footers

### Footer Cuac (`footer.component.html`)

Añadir en `footer-bottom` links de navegación legal:
```html
<div class="footer-bottom">
  <span>© {{ year }} Cuac Design — Bogotá, Colombia</span>
  <div class="footer-legal">
    <a routerLink="/terminos">Términos</a>
    <a routerLink="/privacidad">Privacidad</a>
    <a routerLink="/cookies">Cookies</a>
  </div>
  <span>Hecho a mano, pensado en sistema</span>
</div>
```

### Footer Cuaquiverso (`cuaquiverso.component.html`)

Reemplazar `href="#"` existentes:
```html
<a routerLink="/terminos">Términos</a>
<a routerLink="/privacidad">Privacidad</a>
<a routerLink="/cookies">Cookies</a>
```

---

## 6. Estilos

- Crear `src/app/pages/legal/_legal.scss` con estilos compartidos para las tres páginas.
- El cookie banner usa variables CSS del sistema Cuac (fondo oscuro, tipografía existente).
- Las páginas legales son responsive: en mobile la columna es full-width con padding lateral.

---

## 7. No incluido en este scope

- Páginas legales bajo `/cuaquiverso/terminos` etc. (innecesario, mismas URLs para ambos)
- Integración con CMP externo (Cookiebot, OneTrust)
- Gestión de cookies analíticas de terceros (si se añaden analytics en el futuro, se extiende el servicio)
- Panel de admin para editar el contenido legal desde CMS
