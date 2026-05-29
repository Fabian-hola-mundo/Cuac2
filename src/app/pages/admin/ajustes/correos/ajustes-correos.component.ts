import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

interface Plantilla { id: string; nombre: string; asunto: string; cuerpo: string; activa: boolean; }

@Component({
  selector: 'app-ajustes-correos',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './ajustes-correos.component.html',
  styleUrl: './ajustes-correos.component.scss',
})
export class AjustesCorreosComponent {
  plantillas = signal<Plantilla[]>([
    { id: 'confirmacion', nombre: 'Confirmación de pedido',   activa: true,  asunto: '¡Tu pedido {{numero_orden}} está confirmado!', cuerpo: 'Hola {{nombre}},\n\nGracias por tu compra en Cuaquiverso. Tu pedido {{numero_orden}} por {{total}} ha sido confirmado.\n\nTe avisaremos cuando sea despachado.\n\nCon cariño,\nEl equipo Cuaquiverso' },
    { id: 'enviado',      nombre: 'Pedido enviado',            activa: true,  asunto: 'Tu pedido {{numero_orden}} está en camino', cuerpo: 'Hola {{nombre}},\n\nTu pedido {{numero_orden}} fue despachado. Puedes rastrear tu envío aquí: {{link_rastreo}}' },
    { id: 'entregado',    nombre: 'Pedido entregado',          activa: true,  asunto: '¡Tu pedido {{numero_orden}} llegó!', cuerpo: 'Hola {{nombre}},\n\n¡Tu pedido llegó! Esperamos que ames tus productos Cuaquiverso.\n\n{{productos}}' },
    { id: 'reembolso',    nombre: 'Reembolso aprobado',        activa: true,  asunto: 'Reembolso procesado — {{numero_orden}}', cuerpo: 'Hola {{nombre}},\n\nTu reembolso de {{total}} para el pedido {{numero_orden}} fue procesado. Verás el dinero en 3-5 días hábiles.' },
    { id: 'bienvenida',   nombre: 'Bienvenida al cliente',     activa: false, asunto: '¡Bienvenido al Cuaquiverso, {{nombre}}!', cuerpo: 'Hola {{nombre}},\n\nBienvenido al Cuaquiverso. Somos una marca de personajes colombianos con alma.\n\nExplora la tienda en cuaquiverso.co' },
    { id: 'carrito',      nombre: 'Recuperar carrito abandonado', activa: false, asunto: '{{nombre}}, olvidaste algo en el Cuaquiverso', cuerpo: 'Hola {{nombre}},\n\nDejaste {{productos}} en tu carrito. ¿Los recuperamos?\n\ncuaquiverso.co/carrito' },
  ]);

  plantillaActiva = signal<string | null>('confirmacion');

  readonly VARIABLES = ['{{nombre}}', '{{numero_orden}}', '{{total}}', '{{link_rastreo}}', '{{productos}}'];

  saving = signal(false);
  saved  = signal(false);

  activePlantilla() {
    return this.plantillas().find(p => p.id === this.plantillaActiva()) ?? null;
  }

  toggleActiva(id: string) {
    this.plantillas.update(ps => ps.map(p => p.id === id ? { ...p, activa: !p.activa } : p));
  }

  updateAsunto(id: string, val: string) {
    this.plantillas.update(ps => ps.map(p => p.id === id ? { ...p, asunto: val } : p));
  }

  updateCuerpo(id: string, val: string) {
    this.plantillas.update(ps => ps.map(p => p.id === id ? { ...p, cuerpo: val } : p));
  }

  insertarVariable(v: string) {
    const p = this.activePlantilla();
    if (!p) return;
    this.updateCuerpo(p.id, p.cuerpo + v);
  }

  async guardar() {
    this.saving.set(true);
    await new Promise(r => setTimeout(r, 800));
    this.saving.set(false);
    this.saved.set(true);
    setTimeout(() => this.saved.set(false), 2000);
  }
}
