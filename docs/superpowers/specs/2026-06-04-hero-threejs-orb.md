# Hero Three.js Ambient Orb — Personaje & Universo

**Date:** 2026-06-04  
**Scope:** `personaje-page.component` + `universo.component`

## Summary

Add an ambient Three.js blob-orb animation to the hero of two Cuaquiverso pages. No mouse interaction, no raycasting — purely atmospheric. Uses the same `makeBlobTexture` + `THREE.Sprite` pattern already established in `cuaquiverso.component.ts`.

## Architecture

Each component gets:
1. A `<div id="*-hero-canvas">` inside the hero section — `position: absolute; inset: 0; pointer-events: none; z-index: 0`.
2. All existing hero content elevated to `position: relative; z-index: 1`.
3. An `initHeroScene()` private method (async, lazy-imports `three`) triggered via `setTimeout(0)` after the hero data is available in `ngOnInit`.
4. Cleanup via `this.destroyRef.onDestroy()` (already injected in both components).

No shared utility is extracted — `makeBlobTexture` is inlined in each component (~12 lines). YAGNI.

## personaje-page

**Colors:** `p.color` (main orb) + `p.wire_color ?? '#5C95EA'` (2 satellites).  
**Orbs:**
- 1 main orb: scale 3.0, opacity 0.30, positioned top-right (`x: 1.2, y: 0.5, z: 0`)
- 2 satellites: scale 1.6 and 1.2, opacity 0.18, offset left/below
- Float animation: `Math.sin(t * speedX + phaseX) * 0.18` per axis (same formula as landing)
- Camera: PerspectiveCamera(38, aspect, 0.1, 100), position z: 5.5
- Group slow rotation: `group.rotation.y = t * 0.004`

**Trigger:** In `ngOnInit`, after `this.personaje.set(p)`:
```ts
if (isPlatformBrowser(this.platformId)) setTimeout(() => this.initHeroScene(p), 0);
```

## universo

**Colors:** First 4 characters from `personajesSvc.activos()` (or fewer if < 4 loaded). Each gets one orb.  
**Orbs:** 4 orbs, scales 2.0–2.6, opacity 0.20–0.25, scattered across the hero background.  
**Camera:** Same setup as personaje variant.  
**Trigger:** Same `setTimeout(0)` pattern after `personajesSvc.load()` resolves.

## Constraints

- `isPlatformBrowser` guard on both — SSR safe.
- `renderer.dispose()` + `cancelAnimationFrame` on destroy.
- `renderer.setPixelRatio(Math.min(devicePixelRatio, 2))` to cap GPU load.
- No GSAP dependency (intro animation not needed for ambient only).
- Canvas background: `transparent: true`, no clear color — hero background color shows through.
- Resize handler updates camera aspect + renderer size.

## Files Changed

| File | Change |
|------|--------|
| `personaje-page.component.ts` | Add `initHeroScene`, `PLATFORM_ID`, `isPlatformBrowser` |
| `personaje-page.component.html` | Add `#pj-hero-canvas` div inside `.pj-hero` |
| `personaje-page.component.scss` | Add canvas container styles |
| `universo.component.ts` | Add `initHeroScene`, `PLATFORM_ID`, `isPlatformBrowser` |
| `universo.component.html` | Add `#uni-hero-canvas` div inside `.uni-hero` |
| `universo.component.scss` | Add canvas container styles |
