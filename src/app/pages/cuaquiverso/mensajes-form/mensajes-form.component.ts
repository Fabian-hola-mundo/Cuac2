import { Component, signal, inject } from '@angular/core';
import { MensajesService, TipoMensaje } from '../services/mensajes.service';

@Component({
  selector: 'app-mensajes-form',
  standalone: true,
  imports: [],
  templateUrl: './mensajes-form.component.html',
  styleUrl: './mensajes-form.component.scss',
})
export class MensajesFormComponent {
  private svc = inject(MensajesService);

  tipo    = signal<TipoMensaje>('comentario');
  mensaje = signal('');
  correo  = signal('');
  enviado = signal(false);

  readonly sending = this.svc.sending;
  readonly error   = this.svc.error;

  readonly CHIPS: { id: TipoMensaje; emoji: string; label: string; placeholder: string }[] = [
    {
      id: 'comentario', emoji: '💬', label: 'Comentario',
      placeholder: '¿Cuál personaje merece su propia camiseta? ¿Una queja? ¿Una idea loca? Cuéntanos.',
    },
    {
      id: 'producto', emoji: '🛍', label: 'Sugerir producto',
      placeholder: '¿Qué objeto o personaje te gustaría ver en la tienda?',
    },
    {
      id: 'duda', emoji: '❓', label: 'Duda',
      placeholder: '¿Tienes alguna pregunta sobre la tienda, envíos o productos?',
    },
    {
      id: 'pedido', emoji: '📦', label: 'Pedido',
      placeholder: 'Escribe tu número de pedido y cuéntanos qué pasó.',
    },
  ];

  get placeholder(): string {
    return this.CHIPS.find(c => c.id === this.tipo())?.placeholder ?? '';
  }

  async onSubmit(e: Event): Promise<void> {
    e.preventDefault();
    await this.svc.send(this.tipo(), this.mensaje(), this.correo() || undefined);
    if (!this.svc.error()) {
      this.enviado.set(true);
    }
  }
}
