# Cuac Design System

_Started 2026-05-01 19:01 UTC_

---

## User

Crea el design system para Cuac, esta es la base gráfica de la marca, parte de esto y crea un sistema sólido, que muestre profesionalismos de la marca.

Cuac Design es una agencia de diseño enfocado en el branding, la ilustración, el diseño editorial, motion graphics y diseño web.

Adjunto el logo en 2 de sus versiones  y una base inicial de la web (solo como boceto, no te bases 100% en este sino en lo especificado en el pdf)

## Assistant

I'll start by exploring the brand materials you've provided to understand Cuac's visual identity before building the design system.

_[tool: list_files]_

_[tool: read_file]_

_[tool: read_file]_

Now let me read the PDF brand guidelines and the existing HTML draft.

_[tool: invoke_skill]_

_[tool: read_file]_

Now let me read the PDF brand guidelines.

_[tool: run_script]_

Excelente, ya tengo todo lo necesario. La paleta y tipografías oficiales son:

**Paleta:**
- `#151F28` (negro carbón)
- `#011E54` (azul profundo)
- `#C0E8FD` (azul cielo claro)
- `#EC3813` (rojo/naranja vibrante)
- `#FF8D75` (coral suave)
- `#F0F1F6` (gris claro)

**Tipografías:** Manrope (títulos/párrafos) + Fauna One (acentos serif/regular)

Voy a crear un design system sólido y profesional, presentado como un documento de identidad visual interactivo. Lo construiré como una sola página tipo guía de marca con secciones navegables (logo, paleta, tipografía, componentes, voz, aplicaciones).

_[tool: update_todos]_

_[tool: copy_files]_

_[tool: snip]_

Antes de construir, necesito ajustar los colores del logo SVG para que respeten la paleta de marca (los SVG no traen color asignado).

_[tool: str_replace_edit]_

_[tool: str_replace_edit]_

Ahora voy a construir el design system completo. Diseño como un brand book editorial — cada sección con peso visual fuerte, usando el negro `#151F28` como base, el rojo `#EC3813` como acento vibrante, y la tipografía Manrope/Fauna One.

_[tool: write_file]_

_[tool: snip]_

_[tool: done]_

_[tool: fork_verifier_agent]_

Listo. El **Sistema de Identidad Visual de Cuac Design** está construido como un brand book editorial de una sola página con navegación lateral fija.

**Lo que incluye:**

- **00 · Portada** — manifiesto en negro carbón con marca en grande y metadata.
- **01 · Esencia & Voz** — promesa, misión, 4 pilares y guía de tono "sí decimos / evitamos".
- **02 · Logotipo** — marca principal, 6 versiones cromáticas, construcción con área de respeto (X = altura de la C), y errores comunes.
- **03 · Paleta** — los 6 colores oficiales del PDF (Carbón, Profundo, Brasa, Coral, Cielo, Niebla) con HEX/RGB/CMYK, roles y proporciones de uso.
- **04 · Tipografía** — Fauna One (display) + Manrope (sistema) + JetBrains Mono (caption), jerarquía completa y demo de pareja.
- **05 · Componentes** — botones, badges, tiles, citas, formularios, feature cards + escala de espaciado 8pt + radios.
- **06 · Aplicaciones** — tarjetas de presentación, afiche, post de Instagram y home web mostrando el sistema vivo.

**Decisiones clave:** mantuve la paleta y tipografías exactas del PDF; el logo es ahora `currentColor` para reasignarse a cualquier color de marca; el rojo `#EC3813` es acento, no protagonista (15 % del balance), priorizando carbón + niebla como base profesional.

**Próximos pasos sugeridos:** definir grilla editorial específica para piezas impresas, sistema de iconografía propio, lenguaje de ilustración del Cuaquiverso, y guía de motion (timing, curvas, transiciones).

## User

Save as standalone HTML: Cuac Design System.html

## Assistant

_[tool: snip]_

_[tool: copy_files]_

The HTML uses inline SVGs and a Google Fonts `<link>` — both are resources the bundler can pick up automatically (no JS-string references). I just need to add the required thumbnail template, then bundle.

_[tool: str_replace_edit]_

_[tool: super_inline_html]_

_[tool: snip]_

_[tool: show_html]_

_[tool: show_html]_

_[tool: get_webview_logs]_

_[tool: snip]_

_[tool: present_fs_item_for_download]_

_[tool: snip]_

Archivo standalone listo para descargar — funciona offline con todas las fuentes y recursos embebidos.

