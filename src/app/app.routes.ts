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
        path: 'inventario',
        loadComponent: () =>
          import('./pages/admin/inventario/inventario-list.component').then(
            m => m.InventarioListComponent,
          ),
      },
      {
        path: 'inventario/nuevo',
        loadComponent: () =>
          import('./pages/admin/inventario/inventario-form.component').then(
            m => m.InventarioFormComponent,
          ),
      },
      {
        path: 'inventario/:id/editar',
        loadComponent: () =>
          import('./pages/admin/inventario/inventario-form.component').then(
            m => m.InventarioFormComponent,
          ),
      },
      {
        path: 'inventario/ventas',
        loadComponent: () =>
          import('./pages/admin/inventario/inventario-ventas.component').then(
            m => m.InventarioVentasComponent,
          ),
      },
      {
        path: 'cotizaciones',
        loadComponent: () =>
          import('./pages/admin/cotizaciones/cotizaciones-list.component').then(
            m => m.CotizacionesListComponent,
          ),
      },
    ],
  },
];
