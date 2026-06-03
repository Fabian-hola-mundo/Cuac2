# Brandbook y Design System

_Started 2026-05-21 01:32 UTC_

---

## User

Quiero que dividas entre brandbook y design system y hagas cuidadosamente las dos secciones, quiero que el brandbook esté muy completo y específico, hablando de aplicaciones y variaciones del logo, colores y tipografías, y luego el design system enfocado 100% en la aplicación web y mobile de la marca, que especifique muy bien la aplicación de cada elemento

## Assistant

_[tool: list_files]_

_[tool: read_file]_

_[tool: read_file]_

_[tool: read_file]_

_[tool: read_file]_

_[tool: read_file]_

_[tool: update_todos]_

Perfecto, voy a dividir esto en dos documentos completos. Te explico el plan rápido y arranco:

**Brandbook** (estratégico, identidad): esencia + voz, **logo** (versiones, construcciones, área de respeto, tamaños mínimos, usos especiales, comportamiento sobre fotos, favicon), **color** (paleta extendida con HEX/RGB/CMYK/Pantone, combinaciones, contraste, gradientes), **tipografía** (especímenes, jerarquía editorial, pairing), **aplicaciones gráficas** (papelería, afiches, social, merch, vehículos).

**Design System** (100% web + mobile app): foundations semánticos (tokens, tipo UI, spacing, radii, sombras, iconografía, grid + breakpoints), librería de componentes UI con estados y tamaños, patrones móviles en iPhone, patrones web (hero, dashboard, nav).

Voy a usar el mismo lenguaje visual y registrar ambos como assets.

_[tool: write_file]_

Voy a empezar creando el Brandbook. Para mantenerlo manejable, voy a definir el SVG del logo una sola vez como variable JS e inyectarlo donde haga falta.

_[tool: write_file]_

Ahora voy a reemplazar el archivo del Design System con un documento 100% enfocado en aplicación web y mobile.

_[tool: update_todos]_

_[tool: done]_

_[tool: fork_verifier_agent]_

Listo. Dividí todo en dos documentos enlazados, cada uno con su propio rail y un switch arriba a la izquierda para saltar entre ellos:

**`Cuac Brandbook.html`** — manual de marca estratégico
- Esencia, voz, pilares + diccionario "no/sí" y verbos
- Logo: imagotipo / lockup / isotipo, construcción modular, área de respeto, **5 tamaños mínimos** (digital + impresión), **8 versiones cromáticas** incluyendo sobre foto, sistema de favicon/íconos por plataforma, **8 misuses**
- Color: paleta con HEX/RGB/CMYK/Pantone, roles, **8 pares de contraste WCAG**, 4 atmósferas de fondo
- Tipografía: especímenes editoriales, charset completo, pairing
- Aplicaciones: tarjeta, membrete, sobre, afiche, post IG, story, tote, camiseta, vehículo, señalética

**`Cuac Design System.html`** — 100 % aplicación web + mobile
- **Foundations:** tokens semánticos de superficie/texto/acción/estado (no colores crudos), escala tipográfica UI distinta a la editorial, escala 4 pt + grid 12 col web / 4 col mobile, breakpoints, 5 niveles de elevación, 6 radios, set de íconos 24 px
- **Componentes:** botones (6 variantes × 3 tamaños × 4 estados + icon button), inputs/textarea/select/check/radio/toggle/chips con validación, alerts, tooltip, badges, modal, empty state, skeleton, tabs, breadcrumbs, navs web/mobile, avatares, tabla, lista
- **Patrones:** 3 pantallas mobile en iPhone (home, detalle, formulario con bottom CTA), landing web (hero + features) y dashboard (sidebar + stats + chart + activity)

Cada componente trae notas de uso y nombre de clase. El archivo anterior se sobrescribió con el nuevo Design System; el Brandbook es nuevo.

