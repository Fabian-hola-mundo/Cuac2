# Spec: SEO completo — Cuac Design

**Fecha:** 2026-06-03  
**Estado:** Aprobado

## Contexto

El sitio cuacdesign.com es Angular CSR puro sin meta tags dinámicos. Todas las páginas comparten el mismo `<title>` y `<meta name="description">` estáticos del `index.html`. No existe `robots.txt`, `sitemap.xml`, JSON-LD ni imagen OG. El objetivo es implementar SEO completo con prerendering estático (SSG) para Firebase Hosting.

## Alcance

- Instalar `@angular/ssr` y configurar prerendering de rutas estáticas
- Crear `SeoService` centralizado
- Aplicar meta tags dinámicos en todas las páginas públicas
- JSON-LD `DesignCompany` en home y `CreativeWork` en portafolio-detail
- `robots.txt` y `sitemap.xml` estáticos
- Limpiar `index.html` (script dev, OG base completo)
- Placeholder para imagen OG (`public/assets/og-cuac.jpg`)

Fuera de alcance: SSR con Cloud Functions, generación dinámica del sitemap desde Supabase, analytics, Search Console setup.

---

## 1. SSG con `@angular/ssr`

### Instalación

```bash
ng add @angular/ssr
```

Esto genera:
- `server.ts` — servidor Express
- `src/app/app.config.server.ts` — config del servidor
- Modifica `angular.json` para el builder SSR

### Rutas a prerender

Configurar en `angular.json` bajo `prerender.routes`:

```json
["/", "/cotizar", "/portafolio", "/portafolio/natalia", "/portafolio/nathali",
 "/cuaquiverso", "/cuaquiverso/tienda", "/cuaquiverso/universo"]
```

Las rutas `/portafolio/:slug` y `/admin/*` **no** se prerenderizan.

### `app.config.ts`

Agregar `provideClientHydration()` a los providers.

### Firebase Hosting

`firebase.json` debe apuntar a `dist/cuac-design/browser` y tener rewrite catch-all a `index.html`:

```json
{
  "hosting": {
    "public": "dist/cuac-design/browser",
    "ignore": ["firebase.json", "**/.*", "**/node_modules/**"],
    "rewrites": [{ "source": "**", "destination": "/index.html" }]
  }
}
```

---

## 2. `SeoService`

**Archivo:** `src/app/core/services/seo.service.ts`

### Interfaz

```typescript
interface SeoConfig {
  title:       string;   // sin sufijo — el servicio agrega " | Cuac Design"
  description: string;   // 120-160 chars
  canonical:   string;   // URL absoluta, ej. "https://cuacdesign.com/cotizar"
  ogImage?:    string;   // URL absoluta (default: BASE_URL + "/assets/og-cuac.jpg")
  ogType?:     'website' | 'article';  // default: 'website'
  noindex?:    boolean;  // default: false
}
```

### Constantes

```typescript
const SITE_NAME = 'Cuac Design';
const BASE_URL  = 'https://cuacdesign.com';
const OG_IMAGE  = `${BASE_URL}/assets/og-cuac.jpg`;
```

### Métodos públicos

**`set(config: SeoConfig): void`**
Actualiza:
- `<title>`: `config.title + ' | Cuac Design'` (si title ya contiene "Cuac Design", no dobla el sufijo)
- `meta[name=description]`
- `link[rel=canonical]` (crear/actualizar elemento `<link>`)
- `meta[property=og:title]`
- `meta[property=og:description]`
- `meta[property=og:url]`
- `meta[property=og:image]`
- `meta[property=og:type]`
- `meta[name=twitter:card]` → `summary_large_image`
- `meta[name=twitter:title]`
- `meta[name=twitter:description]`
- `meta[name=twitter:image]`
- `meta[name=robots]` → `"noindex, nofollow"` si `noindex: true`, sino `"index, follow"`

**`setProject(project: PortfolioProject): void`**
Wrapper para páginas de portafolio dinámicas:
```typescript
this.set({
  title:       project.title,
  description: this.truncate(project.headline ?? project.description ?? '', 155),
  canonical:   `${BASE_URL}/portafolio/${project.slug}`,
  ogImage:     project.cover_url ?? OG_IMAGE,
  ogType:      'article',
});
```

**`setJsonLd(schema: object): void`**
Inyecta un `<script type="application/ld+json">` en el `<head>`. Si ya existe uno, lo reemplaza.

### Dependencias

Inyecta: `Title` (de `@angular/platform-browser`), `Meta` (ídem), `DOCUMENT` (de `@angular/common`).

---

## 3. Meta por página

Cada componente de ruta pública inyecta `SeoService` y llama `set()` en `ngOnInit`.

| Componente | title | description | noindex |
|---|---|---|---|
| `HomeComponent` | `Cuac Design — Estudio creativo` | `Branding, diseño editorial, ilustración y web desde Bogotá para marcas que quieren verse tan bien como son.` | false |
| `CotizadorComponent` | `Cotiza tu proyecto` | `Estima el costo de tu proyecto de diseño en segundos. Branding, web, editorial e ilustración desde Bogotá.` | false |
| `PortafolioShellComponent` (cuac) | `Portafolio` | `Proyectos de branding, diseño editorial, ilustración y web del estudio Cuac Design en Bogotá.` | false |
| `PortafolioShellComponent` (natalia) | `Portafolio — Natalia Castañeda` | `Diseño editorial, ilustración y branding. Portafolio personal de Natalia Castañeda Caicedo.` | false |
| `PortafolioShellComponent` (nathali) | `Portafolio — Nathali Ramírez` | `Diseño UI/UX, ilustración y branding. Portafolio personal de Nathali Ramírez Ortiz.` | false |
| `PortafolioDetailComponent` | `project.title` | `project.headline ?? project.description` (155 chars) | false |
| `CuaquiversoComponent` | `Cuaquiverso — División de producto de Cuac` | `Personajes colombianos traducidos a objetos: camisetas, libretas, stickers y más.` | false |
| `TiendaComponent` | `Tienda — Cuaquiverso` | `Compra productos del universo Cuaquiverso: camisetas, libretas, stickers y peluches.` | false |
| `UniversoComponent` | `El universo — Cuaquiverso` | `Conoce los personajes del Cuaquiverso: Cuac, Kiki, Roar, Yeison y más.` | false |
| `IdentidadCorporativaComponent` | `Brandbook` | — | **true** |
| `DesignSystemComponent` | `Design System` | — | **true** |

**Canonical URL**: `BASE_URL + ruta`. Para `PortafolioShellComponent`, el canonical varía según el tema (`/portafolio`, `/portafolio/natalia`, `/portafolio/nathali`) — leer de `ActivatedRoute` o de la propiedad `theme()`.

---

## 4. JSON-LD

### `HomeComponent` — `DesignCompany`

```json
{
  "@context": "https://schema.org",
  "@type": "DesignCompany",
  "name": "Cuac Design",
  "description": "Estudio creativo colombiano especializado en branding, diseño editorial, ilustración y diseño web.",
  "url": "https://cuacdesign.com",
  "logo": "https://cuacdesign.com/assets/og-cuac.jpg",
  "foundingDate": "2024",
  "address": {
    "@type": "PostalAddress",
    "addressLocality": "Bogotá",
    "addressCountry": "CO"
  },
  "sameAs": [
    "https://www.instagram.com/cuac.design/",
    "https://www.linkedin.com/company/cuac-design/"
  ]
}
```

### `PortafolioDetailComponent` — `CreativeWork`

Llamado tras cargar el proyecto:
```json
{
  "@context": "https://schema.org",
  "@type": "CreativeWork",
  "name": "[project.title]",
  "description": "[project.headline ?? project.description]",
  "creator": { "@type": "Organization", "name": "Cuac Design" },
  "image": "[project.cover_url]",
  "url": "https://cuacdesign.com/portafolio/[project.slug]"
}
```

---

## 5. Archivos estáticos

### `public/robots.txt`

```
User-agent: *
Allow: /

Disallow: /admin/
Disallow: /identidadcorporativa
Disallow: /designsystem

Sitemap: https://cuacdesign.com/sitemap.xml
```

### `public/sitemap.xml`

```xml
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://cuacdesign.com/</loc><changefreq>weekly</changefreq><priority>1.0</priority></url>
  <url><loc>https://cuacdesign.com/cotizar</loc><changefreq>monthly</changefreq><priority>0.9</priority></url>
  <url><loc>https://cuacdesign.com/portafolio</loc><changefreq>weekly</changefreq><priority>0.8</priority></url>
  <url><loc>https://cuacdesign.com/portafolio/natalia</loc><changefreq>weekly</changefreq><priority>0.7</priority></url>
  <url><loc>https://cuacdesign.com/portafolio/nathali</loc><changefreq>weekly</changefreq><priority>0.7</priority></url>
  <url><loc>https://cuacdesign.com/cuaquiverso</loc><changefreq>monthly</changefreq><priority>0.7</priority></url>
  <url><loc>https://cuacdesign.com/cuaquiverso/tienda</loc><changefreq>weekly</changefreq><priority>0.6</priority></url>
  <url><loc>https://cuacdesign.com/cuaquiverso/universo</loc><changefreq>monthly</changefreq><priority>0.6</priority></url>
</urlset>
```

### `public/assets/og-cuac.jpg`

Imagen de 1200×630px para compartir en redes sociales. **Debe reemplazarse con la imagen real del estudio antes de producción.** El plan incluye un paso explícito para esto.

---

## 6. Limpieza de `index.html`

### Eliminar

```html
<!-- impeccable-live-start -->
<script src="http://localhost:8400/live.js"></script>
<!-- impeccable-live-end -->
```

### Actualizar/agregar meta base

```html
<meta property="og:site_name" content="Cuac Design">
<meta property="og:locale" content="es_CO">
<meta property="og:image" content="https://cuacdesign.com/assets/og-cuac.jpg">
<meta property="og:url" content="https://cuacdesign.com">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:site" content="@cuacdesign">
<meta name="robots" content="index, follow">
```

---

## Criterios de éxito

1. `ng build` produce HTML pre-renderizado para las 8 rutas configuradas
2. `curl https://cuacdesign.com/cotizar` devuelve HTML con `<title>Cotiza tu proyecto | Cuac Design</title>`
3. Cada página tiene description única y relevante
4. Google Search Console muestra las rutas indexadas sin errores de canonical
5. Compartir en Twitter/LinkedIn muestra la imagen OG correcta
6. `https://cuacdesign.com/robots.txt` y `/sitemap.xml` responden correctamente
7. `/admin/` retorna `noindex, nofollow` en sus meta robots
8. El script `localhost:8400` no aparece en ningún archivo de producción
