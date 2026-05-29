import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

export type Rol = 'owner' | 'operaciones' | 'contenido' | 'lectura';

interface Miembro {
  id: string; nombre: string; email: string;
  rol: Rol; ultimoAcceso: string; activo: boolean;
}

interface AccesoLog { persona: string; accion: string; fecha: string; }

const ROL_META: Record<Rol, { label: string; tone: string; desc: string }> = {
  owner:      { label: 'Owner',         tone: 'ok',   desc: 'Acceso total. Puede eliminar la cuenta.' },
  operaciones:{ label: 'Operaciones',   tone: 'rio',  desc: 'Pedidos, clientes, pagos, inventario.' },
  contenido:  { label: 'Contenido',     tone: 'lila', desc: 'Portafolio, personajes, plantillas.' },
  lectura:    { label: 'Solo lectura',  tone: '',     desc: 'Solo puede ver, no puede editar nada.' },
};

@Component({
  selector: 'app-ajustes-equipo',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './ajustes-equipo.component.html',
  styleUrl: './ajustes-equipo.component.scss',
})
export class AjustesEquipoComponent {
  readonly ROL_META = ROL_META;
  readonly ROLES: Rol[] = ['owner', 'operaciones', 'contenido', 'lectura'];

  miembros = signal<Miembro[]>([
    { id: 'm1', nombre: 'Capitán Cuac',  email: 'admin@cuaquiverso.co',  rol: 'owner',       ultimoAcceso: 'Ahora',    activo: true },
    { id: 'm2', nombre: 'María José',    email: 'mj@cuaquiverso.co',     rol: 'operaciones', ultimoAcceso: 'Ayer 18:22', activo: true },
    { id: 'm3', nombre: 'Felipe Andrade',email: 'fa@cuaquiverso.co',     rol: 'contenido',   ultimoAcceso: 'Hace 3d',  activo: true },
  ]);

  editingMember = signal<string | null>(null);
  editingRol    = signal<Rol>('lectura');

  inviteEmail = signal('');
  inviteRol   = signal<Rol>('operaciones');
  inviteSent  = signal(false);

  readonly LOG: AccesoLog[] = [
    { persona: 'Capitán Cuac',   accion: 'Inicio de sesión',    fecha: 'Hoy 09:14'    },
    { persona: 'María José',     accion: 'Editó pedido #CQ-2814', fecha: 'Ayer 18:22' },
    { persona: 'Felipe Andrade', accion: 'Publicó proyecto',    fecha: 'Hace 3 días'  },
    { persona: 'María José',     accion: 'Inicio de sesión',    fecha: 'Hace 4 días'  },
    { persona: 'Capitán Cuac',   accion: 'Cambió ajuste de IVA', fecha: 'Hace 5 días' },
  ];

  startEdit(m: Miembro) {
    this.editingMember.set(m.id);
    this.editingRol.set(m.rol);
  }

  saveEdit() {
    const id = this.editingMember();
    if (!id) return;
    this.miembros.update(ms => ms.map(m => m.id === id ? { ...m, rol: this.editingRol() } : m));
    this.editingMember.set(null);
  }

  revocar(id: string) {
    this.miembros.update(ms => ms.filter(m => m.id !== id));
  }

  async enviarInvitacion() {
    if (!this.inviteEmail().trim()) return;
    this.inviteSent.set(true);
    await new Promise(r => setTimeout(r, 600));
    this.inviteEmail.set('');
    setTimeout(() => this.inviteSent.set(false), 3000);
  }

  initials(nombre: string): string {
    return nombre.split(' ').map(s => s[0] ?? '').slice(0, 2).join('').toUpperCase();
  }
}
