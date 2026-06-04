import { Component, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { PersonajesService, Personaje } from '../../../core/services/personajes.service';
import { InventarioService } from '../../../core/services/inventario.service';

@Component({
  selector: 'app-personaje-detail',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './personaje-detail.component.html',
  styleUrl: './personaje-detail.component.scss',
})
export class PersonajeDetailComponent implements OnInit {
  readonly svc     = inject(PersonajesService);
  readonly inv     = inject(InventarioService);
  private router   = inject(Router);
  private route    = inject(ActivatedRoute);

  personaje        = signal<Personaje | null>(null);
  productoCount    = signal(0);
  confirmDelete    = signal(false);
  selectedGalleryImg = signal<string | null>(null);

  async ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id')!;
    await this.svc.load();
    const p = this.svc.personajes().find(x => x.id === id);
    if (!p) { this.router.navigate(['/admin/personajes']); return; }
    this.personaje.set(p);
    if (p.galeria_urls.length > 0) this.selectedGalleryImg.set(p.galeria_urls[0]);

    await this.inv.cargarTodos();
    this.productoCount.set(
      this.inv.productos().filter(pr => pr.personaje === p.key).length
    );
  }

  goEditar() { this.router.navigate(['/admin/personajes', this.personaje()!.id, 'editar']); }
  goLista()  { this.router.navigate(['/admin/personajes']); }
  goSitio()  { window.open(`/cuaquiverso/personaje/${this.personaje()!.key}`, '_blank'); }

  async deleteConfirmed() {
    const id = this.personaje()?.id;
    if (!id) return;
    await this.svc.delete(id);
    this.router.navigate(['/admin/personajes']);
  }
}
