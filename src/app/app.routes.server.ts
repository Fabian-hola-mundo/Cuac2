import { RenderMode, ServerRoute } from '@angular/ssr';

export const serverRoutes: ServerRoute[] = [
  // Safe static routes — prerendered at build time
  { path: '', renderMode: RenderMode.Prerender },
  { path: 'cotizar', renderMode: RenderMode.Prerender },

  // Routes with Three.js / browser-only APIs — served as client-side shells
  { path: 'portafolio', renderMode: RenderMode.Client },
  { path: 'portafolio/natalia', renderMode: RenderMode.Client },
  { path: 'portafolio/nathali', renderMode: RenderMode.Client },
  { path: 'portafolio/:slug', renderMode: RenderMode.Client },
  { path: 'cuaquiverso', renderMode: RenderMode.Client },
  { path: 'cuaquiverso/tienda', renderMode: RenderMode.Client },
  { path: 'cuaquiverso/universo', renderMode: RenderMode.Client },
  { path: 'identidadcorporativa', renderMode: RenderMode.Client },
  { path: 'designsystem', renderMode: RenderMode.Client },

  // Admin — always client-side
  { path: 'admin/**', renderMode: RenderMode.Client },

  // Fallback
  { path: '**', renderMode: RenderMode.Client },
];
