import { Component, OnInit, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { PersonajesService, Personaje } from '../../../core/services/personajes.service';
import { InventarioService, ProductoEvento } from '../../../core/services/inventario.service';
import { CartService } from '../services/cart.service';
import { CartModalComponent } from '../cart-modal/cart-modal.component';
import { SeoService } from '../../../core/services/seo.service';

@Component({
  selector: 'app-personaje-page',
  standalone: true,
  imports: [CommonModule, CartModalComponent],
  templateUrl: './personaje-page.component.html',
  styleUrl: './personaje-page.component.scss',
})
export class PersonajePageComponent implements OnInit {
  private route   = inject(ActivatedRoute);
  private router  = inject(Router);
  private seo     = inject(SeoService);
  readonly svcP   = inject(PersonajesService);
  readonly svcI   = inject(InventarioService);
  readonly cart   = inject(CartService);
  readonly String = String;

  personaje  = signal<Personaje | null>(null);
  productos  = signal<ProductoEvento[]>([]);
  selectedImg = signal<string | null>(null);

  prev = computed(() => {
    const p = this.personaje();
    if (!p) return null;
    const all = this.svcP.activos();
    const idx = all.findIndex(x => x.id === p.id);
    return idx > 0 ? all[idx - 1] : null;
  });

  next = computed(() => {
    const p = this.personaje();
    if (!p) return null;
    const all = this.svcP.activos();
    const idx = all.findIndex(x => x.id === p.id);
    return idx < all.length - 1 ? all[idx + 1] : null;
  });

  async ngOnInit() {
    const slug = this.route.snapshot.paramMap.get('slug')!;
    await this.svcP.load();
    const p = this.svcP.activos().find(x => x.key === slug);
    if (!p) { this.router.navigate(['/cuaquiverso/universo']); return; }
    this.personaje.set(p);
    if (p.galeria_urls.length > 0) this.selectedImg.set(p.galeria_urls[0]);

    this.seo.set({
      title:       `${p.nombre} — Cuaquiverso`,
      description: p.bio ? p.bio.slice(0, 160) : `Conoce a ${p.nombre} del Cuaquiverso.`,
      canonical:   `https://cuacdesign.com/cuaquiverso/personaje/${p.key}`,
    });

    await this.svcI.cargarTodos();
    this.productos.set(
      this.svcI.productos().filter(pr => pr.personaje === slug && pr.activo)
    );
  }

  addToCart(event: Event, p: ProductoEvento) {
    event.preventDefault();
    event.stopPropagation();
    this.cart.add({
      id:    p.id,
      name:  p.nombre,
      sub:   p.categoria,
      price: p.precio,
      color: p.color ?? '#ccc',
    });
  }
}
