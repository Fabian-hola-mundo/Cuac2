import { Component, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { DragDropModule, CdkDragDrop, moveItemInArray } from '@angular/cdk/drag-drop';
import { PersonajesService, Personaje } from '../../../core/services/personajes.service';

@Component({
  selector: 'app-personajes-list',
  standalone: true,
  imports: [CommonModule, DragDropModule],
  templateUrl: './personajes-list.component.html',
  styleUrl: './personajes-list.component.scss',
})
export class PersonajesListComponent implements OnInit {
  readonly svc    = inject(PersonajesService);
  private router  = inject(Router);

  toast           = signal<string | null>(null);
  confirmDeleteId = signal<string | null>(null);
  private toastTimer?: ReturnType<typeof setTimeout>;

  async ngOnInit() {
    await this.svc.load();
  }

  onDrop(event: CdkDragDrop<Personaje[]>) {
    const items = [...this.svc.personajes()];
    moveItemInArray(items, event.previousIndex, event.currentIndex);
    this.svc.personajes.set(items);
    const updates = items.map((p, i) => ({ id: p.id, sort_order: i + 1 }));
    this.svc.updateOrder(updates).then(() => this.flash('Orden guardado'));
  }

  async toggleActivo(p: Personaje) {
    const { error } = await this.svc.toggleActivo(p.id, !p.activo);
    if (error) this.flash('Error: ' + error);
    else this.flash(p.activo ? 'Desactivado' : 'Activado');
  }

  async confirmDelete(id: string) {
    this.confirmDeleteId.set(id);
  }

  async deleteConfirmed() {
    const id = this.confirmDeleteId();
    if (!id) return;
    const { error } = await this.svc.delete(id);
    this.confirmDeleteId.set(null);
    this.flash(error ? 'Error: ' + error : 'Personaje eliminado');
  }

  cancelDelete() { this.confirmDeleteId.set(null); }

  goNuevo()          { this.router.navigate(['/admin/personajes/nuevo']); }
  goDetalle(id: string) { this.router.navigate(['/admin/personajes', id]); }
  goEditar(id: string)  { this.router.navigate(['/admin/personajes', id, 'editar']); }

  flash(msg: string) {
    this.toast.set(msg);
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => this.toast.set(null), 2400);
  }
}
