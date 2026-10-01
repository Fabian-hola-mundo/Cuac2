import { Component, OnInit, ElementRef, signal, inject, viewChild } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NgTemplateOutlet } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { ResenasService, Resena } from '../../../../core/services/resenas.service';

interface TestimonialDisplay {
  id:          string;
  quote:       string;
  name:        string;
  role:        string;
  initials:    string;
  avatarBg:    string;
  avatarColor: string;
  slug:        string | null;
  project:     string | null;
}

const AVATAR_PALETTE: Array<{ bg: string; color: string }> = [
  { bg: 'var(--ember)', color: 'white'           },
  { bg: 'var(--deep)',  color: 'white'           },
  { bg: 'var(--coral)', color: 'var(--carbon)'   },
];

function toInitials(name: string | null): string {
  if (!name) return '?';
  return name.split(' ')
    .filter(Boolean)
    .map(w => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

@Component({
  selector: 'app-testimonials',
  standalone: true,
  imports: [RouterLink, NgTemplateOutlet, ReactiveFormsModule],
  templateUrl: './testimonials.component.html',
  styleUrl: './testimonials.component.scss',
})
export class TestimonialsComponent implements OnInit {
  private resenas = inject(ResenasService);
  private fb      = inject(FormBuilder);

  private track = viewChild<ElementRef<HTMLElement>>('track');

  readonly loading      = signal(true);
  readonly testimonials = signal<TestimonialDisplay[]>([]);

  readonly formAbierto = signal(false);
  readonly enviando    = signal(false);
  readonly enviado     = signal(false);
  readonly errorEnvio  = signal<string | null>(null);

  readonly form = this.fb.nonNullable.group({
    nombre:        ['', [Validators.required, Validators.minLength(2), Validators.maxLength(80)]],
    cargo_empresa: ['', [Validators.maxLength(120)]],
    comentario:    ['', [Validators.required, Validators.minLength(10), Validators.maxLength(800)]],
    correo:        ['', [Validators.email, Validators.maxLength(160)]],
    // Campo trampa: invisible para personas, los bots suelen llenarlo.
    web:           [''],
  });

  async ngOnInit() {
    try {
      const resenas = await this.resenas.getVisibles();
      this.testimonials.set(resenas.map((r: Resena, i: number) => {
        const palette = AVATAR_PALETTE[i % AVATAR_PALETTE.length];
        return {
          id:          r.id,
          quote:       r.comentario,
          name:        r.nombre,
          role:        r.cargo_empresa ?? '',
          initials:    toInitials(r.nombre),
          avatarBg:    palette.bg,
          avatarColor: palette.color,
          slug:        r.proyecto?.slug ?? null,
          project:     r.proyecto?.title ?? null,
        };
      }));
    } finally {
      this.loading.set(false);
    }
  }

  scroll(dir: 1 | -1) {
    const el = this.track()?.nativeElement;
    if (!el) return;
    el.scrollBy({ left: dir * el.clientWidth * 0.8, behavior: 'smooth' });
  }

  async enviar() {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    const v = this.form.getRawValue();
    if (v.web) { this.enviado.set(true); return; }

    this.enviando.set(true);
    this.errorEnvio.set(null);
    const { error } = await this.resenas.enviar({
      nombre:        v.nombre.trim(),
      cargo_empresa: v.cargo_empresa.trim() || null,
      comentario:    v.comentario.trim(),
      correo:        v.correo.trim() || null,
    });
    this.enviando.set(false);
    if (error) { this.errorEnvio.set('No pudimos enviar tu reseña. Inténtalo de nuevo.'); return; }
    this.enviado.set(true);
    this.form.reset();
  }

  invalido(campo: 'nombre' | 'comentario' | 'correo'): boolean {
    const c = this.form.controls[campo];
    return c.invalid && c.touched;
  }
}
