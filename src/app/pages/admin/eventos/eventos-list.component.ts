import { Component, signal, inject, OnInit } from '@angular/core';
import { CommonModule }  from '@angular/common';
import { FormsModule }   from '@angular/forms';
import { Router }        from '@angular/router';
import { EventosService, Evento } from '../../../core/services/eventos.service';

@Component({
  selector: 'app-eventos-list',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './eventos-list.component.html',
  styleUrl: './eventos-list.component.scss',
})
export class EventosListComponent implements OnInit {
  private router  = inject(Router);
  private svc     = inject(EventosService);

  readonly eventos  = signal<Evento[]>([]);
  readonly cargando = signal(false);
  readonly errorMsg = signal<string | null>(null);

  // Totals per event (loaded lazily after eventos load)
  readonly totales  = signal<Record<string, number>>({});

  // Drawer state for "+ Nuevo evento"
  drawerOpen    = signal(false);
  nuevoNombre   = '';
  creando       = signal(false);
  createError   = signal<string | null>(null);

  async ngOnInit() {
    await this.cargar();
    if (history.state?.abrirNuevo) this.abrirDrawer();
  }

  async cargar() {
    this.cargando.set(true);
    this.errorMsg.set(null);
    try {
      const data = await this.svc.getEventos();
      this.eventos.set(data);
      // Load totals for each event in background
      this.cargarTotales(data);
    } catch (e: any) {
      this.errorMsg.set(e.message);
    }
    this.cargando.set(false);
  }

  private async cargarTotales(eventos: Evento[]) {
    const entries = await Promise.all(
      eventos.map(async e => {
        const t = await this.svc.getTotalUnidadesEvento(e);
        return [e.id, t] as [string, number];
      })
    );
    this.totales.set(Object.fromEntries(entries));
  }

  irAEvento(e: Evento) { this.router.navigate(['/admin/eventos', e.id]); }

  abrirDrawer() {
    this.nuevoNombre = '';
    this.createError.set(null);
    this.drawerOpen.set(true);
  }
  cerrarDrawer() { this.drawerOpen.set(false); }

  async crearEvento() {
    if (!this.nuevoNombre.trim()) {
      this.createError.set('El nombre del evento es requerido.');
      return;
    }
    this.creando.set(true);
    this.createError.set(null);
    try {
      const { error } = await this.svc.crearEvento(this.nuevoNombre.trim());
      if (error) {
        this.createError.set(error);
      } else {
        this.cerrarDrawer();
        await this.cargar();
      }
    } catch (e: any) {
      this.createError.set(e.message ?? 'Error al crear el evento.');
    }
    this.creando.set(false);
  }

  fmtFecha(iso: string) {
    return new Date(iso).toLocaleDateString('es-CO', {
      day: '2-digit', month: 'short', year: 'numeric',
    });
  }

  duracion(e: Evento): string {
    const inicio = new Date(e.fecha_inicio);
    const fin    = e.fecha_fin ? new Date(e.fecha_fin) : new Date();
    const dias   = Math.ceil((fin.getTime() - inicio.getTime()) / (1000 * 60 * 60 * 24));
    return `${dias} día${dias !== 1 ? 's' : ''}`;
  }
}
