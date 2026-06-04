// src/app/pages/admin/mensajes/mensajes-admin.component.ts
import { Component, signal, computed, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SupabaseService } from '../../../core/services/supabase.service';

interface Mensaje {
  id: string;
  tipo: 'comentario' | 'producto' | 'duda' | 'pedido';
  mensaje: string;
  correo: string | null;
  leido: boolean;
  created_at: string;
}

@Component({
  selector: 'app-mensajes-admin',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './mensajes-admin.component.html',
  styleUrl: './mensajes-admin.component.scss',
})
export class MensajesAdminComponent implements OnInit {
  private sb = inject(SupabaseService);

  cargando   = signal(true);
  error      = signal<string | null>(null);
  items      = signal<Mensaje[]>([]);
  expandedId = signal<string | null>(null);

  noLeidos = computed(() => this.items().filter(m => !m.leido).length);

  async ngOnInit() {
    await this.cargar();
  }

  async cargar() {
    this.cargando.set(true);
    const { data, error } = await this.sb.db
      .from('mensajes')
      .select('*')
      .order('created_at', { ascending: false });
    this.cargando.set(false);
    if (error) { this.error.set('Error al cargar mensajes.'); return; }
    this.items.set(data ?? []);
  }

  async toggle(m: Mensaje) {
    if (this.expandedId() === m.id) {
      this.expandedId.set(null);
      return;
    }
    this.expandedId.set(m.id);
    if (!m.leido) {
      await this.sb.db.from('mensajes').update({ leido: true }).eq('id', m.id);
      this.items.update(list =>
        list.map(i => i.id === m.id ? { ...i, leido: true } : i)
      );
    }
  }

  tipoLabel(tipo: string): string {
    const map: Record<string, string> = {
      comentario: '💬 Comentario',
      producto:   '🛍 Producto',
      duda:       '❓ Duda',
      pedido:     '📦 Pedido',
    };
    return map[tipo] ?? tipo;
  }

  fechaRelativa(iso: string): string {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 2)   return 'ahora';
    if (mins < 60)  return `hace ${mins} min`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24)   return `hace ${hrs}h`;
    const days = Math.floor(hrs / 24);
    return days === 1 ? 'ayer' : `hace ${days} días`;
  }
}
