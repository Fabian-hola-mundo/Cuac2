import { Component } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';

interface NavItem { label: string; path: string; icon: string; }

@Component({
  selector: 'app-ajustes-shell',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './ajustes-shell.component.html',
  styleUrl: './ajustes-shell.component.scss',
})
export class AjustesShellComponent {
  readonly NAV: NavItem[] = [
    { label: 'Negocio',              path: 'negocio',       icon: 'building'    },
    { label: 'Impuestos',            path: 'impuestos',     icon: 'receipt'     },
    { label: 'Envíos y tarifas',     path: 'envios',        icon: 'truck'       },
    { label: 'Plantillas de correo', path: 'correos',       icon: 'mail'        },
    { label: 'Equipo y permisos',    path: 'equipo',        icon: 'users'       },
    { label: 'Integraciones',        path: 'integraciones', icon: 'plug'        },
    { label: 'Dominios',             path: 'dominios',      icon: 'globe'       },
  ];
}
