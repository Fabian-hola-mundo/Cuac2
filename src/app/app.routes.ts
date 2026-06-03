import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./pages/home/home.component').then(m => m.HomeComponent),
  },
  {
    path: 'cotizar',
    loadComponent: () =>
      import('./pages/cotizador/cotizador.component').then(m => m.CotizadorComponent),
  },
  {
    path: 'cuaquiverso',
    loadComponent: () =>
      import('./pages/cuaquiverso/cuaquiverso.component').then(m => m.CuaquiversoComponent),
  },
  {
    path: 'identidadcorporativa',
    loadComponent: () =>
      import('./pages/identidadcorporativa/identidadcorporativa.component').then(
        m => m.IdentidadCorporativaComponent,
      ),
  },
  {
    path: 'designsystem',
    loadComponent: () =>
      import('./pages/designsystem/designsystem.component').then(
        m => m.DesignSystemComponent,
      ),
  },
  {
    path: 'cuaquiverso/tienda',
    loadComponent: () =>
      import('./pages/cuaquiverso/tienda/tienda.component').then(m => m.TiendaComponent),
  },
  {
    path: 'cuaquiverso/universo',
    loadComponent: () =>
      import('./pages/cuaquiverso/universo/universo.component').then(m => m.UniversoComponent),
  },
  {
    path: 'portafolio',
    loadComponent: () =>
      import('./pages/portafolio/portafolio-shell.component').then(m => m.PortafolioShellComponent),
    data: { theme: 'cuac' },
  },
  {
    path: 'portafolio/natalia',
    loadComponent: () =>
      import('./pages/portafolio/portafolio-shell.component').then(m => m.PortafolioShellComponent),
    data: { theme: 'natalia' },
  },
  {
    path: 'portafolio/nathali',
    loadComponent: () =>
      import('./pages/portafolio/portafolio-shell.component').then(m => m.PortafolioShellComponent),
    data: { theme: 'nathali' },
  },
  {
    path: 'portafolio/:slug',
    loadComponent: () =>
      import('./pages/portafolio/portafolio-detail.component').then(m => m.PortafolioDetailComponent),
  },
  {
    path: 'admin',
    loadComponent: () =>
      import('./pages/admin/admin-shell.component').then(m => m.AdminShellComponent),
    children: [
      {
        path: '',
        loadComponent: () =>
          import('./pages/admin/admin-home.component').then(m => m.AdminHomeComponent),
      },

      {
        path: 'cotizaciones',
        loadComponent: () =>
          import('./pages/admin/cotizaciones/cotizaciones-list.component').then(
            m => m.CotizacionesListComponent,
          ),
      },
      {
        path: 'portafolio',
        loadComponent: () =>
          import('./pages/admin/portafolio/admin-portafolio-list.component').then(
            m => m.AdminPortafolioListComponent,
          ),
      },
      {
        path: 'portafolio/logros',
        loadComponent: () =>
          import('./pages/admin/portafolio/admin-logros.component').then(
            m => m.AdminLogrosComponent,
          ),
      },
      {
        path: 'portafolio/perfiles',
        loadComponent: () =>
          import('./pages/admin/portafolio/admin-perfiles.component').then(
            m => m.AdminPerfilesComponent,
          ),
      },
      {
        path: 'portafolio/nuevo',
        loadComponent: () =>
          import('./pages/admin/portafolio/admin-portafolio-form.component').then(
            m => m.AdminPortafolioFormComponent,
          ),
      },
      {
        path: 'portafolio/:id/editar',
        loadComponent: () =>
          import('./pages/admin/portafolio/admin-portafolio-form.component').then(
            m => m.AdminPortafolioFormComponent,
          ),
      },
      // New productos routes
      {
        path: 'productos',
        loadComponent: () =>
          import('./pages/admin/productos/productos-list.component').then(
            m => m.ProductosListComponent,
          ),
      },
      {
        path: 'productos/ventas',
        loadComponent: () =>
          import('./pages/admin/productos/ventas-general.component').then(
            m => m.VentasGeneralComponent,
          ),
      },
      {
        path: 'productos/nuevo',
        loadComponent: () =>
          import('./pages/admin/productos/producto-form.component').then(
            m => m.ProductoFormComponent,
          ),
      },
      {
        path: 'productos/:id/editar',
        loadComponent: () =>
          import('./pages/admin/productos/producto-form.component').then(
            m => m.ProductoFormComponent,
          ),
      },
      // New eventos routes
      {
        path: 'eventos',
        loadComponent: () =>
          import('./pages/admin/eventos/eventos-list.component').then(
            m => m.EventosListComponent,
          ),
      },
      {
        path: 'eventos/:id',
        loadComponent: () =>
          import('./pages/admin/eventos/evento-detail.component').then(
            m => m.EventoDetailComponent,
          ),
      },
      // Ajustes
      {
        path: 'ajustes',
        loadComponent: () =>
          import('./pages/admin/ajustes/ajustes-shell.component').then(m => m.AjustesShellComponent),
        children: [
          { path: '', redirectTo: 'negocio', pathMatch: 'full' },
          {
            path: 'negocio',
            loadComponent: () =>
              import('./pages/admin/ajustes/negocio/ajustes-negocio.component').then(m => m.AjustesNegocioComponent),
          },
          {
            path: 'impuestos',
            loadComponent: () =>
              import('./pages/admin/ajustes/impuestos/ajustes-impuestos.component').then(m => m.AjustesImpuestosComponent),
          },
          {
            path: 'envios',
            loadComponent: () =>
              import('./pages/admin/ajustes/envios/ajustes-envios.component').then(m => m.AjustesEnviosComponent),
          },
          {
            path: 'correos',
            loadComponent: () =>
              import('./pages/admin/ajustes/correos/ajustes-correos.component').then(m => m.AjustesCorreosComponent),
          },
          {
            path: 'equipo',
            loadComponent: () =>
              import('./pages/admin/ajustes/equipo/ajustes-equipo.component').then(m => m.AjustesEquipoComponent),
          },
          {
            path: 'integraciones',
            loadComponent: () =>
              import('./pages/admin/ajustes/integraciones/ajustes-integraciones.component').then(m => m.AjustesIntegracionesComponent),
          },
          {
            path: 'dominios',
            loadComponent: () =>
              import('./pages/admin/ajustes/dominios/ajustes-dominios.component').then(m => m.AjustesDominiosComponent),
          },
        ],
      },
    ],
  },
];
