// src/app/pages/admin/cotizaciones/cotizaciones-list.component.ts
import { Component, signal, computed, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SupabaseService } from '../../../core/services/supabase.service';

interface Cotizacion {
  id: string;
  created_at: string;
  nombre: string;
  email: string;
  empresa: string;
  telefono: string | null;
  servicios: string[];
  descripcion: string;
  presupuesto: string | null;
  timeline: string | null;
  estimador_servicio: string | null;
  estimador_escala: string | null;
  estimador_rango: string | null;
  estado: 'pendiente' | 'respondida' | 'descartada';
}

type EstadoFiltro = 'todos' | 'pendiente' | 'respondida' | 'descartada';

@Component({
  selector: 'app-cotizaciones-list',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './cotizaciones-list.component.html',
  styleUrl: './cotizaciones-list.component.scss',
})
export class CotizacionesListComponent implements OnInit {
  private sb = inject(SupabaseService);

  cargando   = signal(true);
  error      = signal<string | null>(null);
  items      = signal<Cotizacion[]>([]);
  filtro     = signal<EstadoFiltro>('todos');
  expandedId = signal<string | null>(null);
  toast      = signal<string | null>(null);
  private toastTimer?: ReturnType<typeof setTimeout>;

  readonly FILTROS: { id: EstadoFiltro; label: string }[] = [
    { id: 'todos',       label: 'Todas'       },
    { id: 'pendiente',   label: 'Pendientes'  },
    { id: 'respondida',  label: 'Respondidas' },
    { id: 'descartada',  label: 'Descartadas' },
  ];

  filtradas = computed(() => {
    const f = this.filtro();
    const list = this.items();
    return f === 'todos' ? list : list.filter(c => c.estado === f);
  });

  filtrosVisibles = computed(() => {
    const estados = new Set(this.items().map(c => c.estado));
    return this.FILTROS.filter(f => f.id === 'todos' || estados.has(f.id as Cotizacion['estado']));
  });

  async ngOnInit() {
    await this.cargar();
  }

  async cargar() {
    this.cargando.set(true);
    this.error.set(null);
    const { data, error } = await this.sb.db
      .from('cotizaciones')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      this.error.set(error.message);
    } else {
      this.items.set(data as Cotizacion[]);
    }
    this.cargando.set(false);
  }

  toggleExpand(id: string) {
    this.expandedId.set(this.expandedId() === id ? null : id);
  }

  async cambiarEstado(id: string, estado: 'respondida' | 'descartada') {
    const { error } = await this.sb.db
      .from('cotizaciones')
      .update({ estado })
      .eq('id', id);

    if (error) {
      this.flash('Error al actualizar');
      return;
    }
    this.items.update(list =>
      list.map(c => c.id === id ? { ...c, estado } : c)
    );
    this.flash(estado === 'respondida' ? '✓ Marcada como respondida' : '✓ Descartada');
  }

  copiarEmail(email: string) {
    navigator.clipboard.writeText(email);
    this.flash(`✓ ${email} copiado`);
  }

  flash(msg: string) {
    this.toast.set(msg);
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => this.toast.set(null), 2400);
  }

  fmtFecha(iso: string): string {
    return new Date(iso).toLocaleDateString('es-CO', {
      day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  }

  estadoBadge(estado: string): string {
    const map: Record<string, string> = {
      pendiente:  'badge-warn',
      respondida: 'badge-ok',
      descartada: 'badge-muted',
    };
    return map[estado] ?? '';
  }
}
