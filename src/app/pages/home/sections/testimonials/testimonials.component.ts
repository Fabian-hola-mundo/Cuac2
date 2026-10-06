import { Component, OnInit, ElementRef, signal, inject, viewChild } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { ResenasService, Resena } from '../../../../core/services/resenas.service';
import { ResenaTextoComponent } from '../../../../shared/resena-texto/resena-texto.component';

interface TestimonialDisplay {
  id:          string;
  quote:       string;
  name:        string;
  role:        string;
  initials:    string;
  avatar:      AvatarTone;
  slug:        string | null;
  project:     string | null;
}

// Tinte suave de fondo, iniciales en el tono oscuro y aro fino exterior.
interface AvatarTone { bg: string; color: string; ring: string; }

const AVATAR_PALETTE: AvatarTone[] = [
  { bg: 'rgba(192, 232, 253, 0.45)', color: 'var(--deep)',   ring: 'rgba(1, 30, 84, 0.18)'   },
  { bg: 'rgba(255, 141, 117, 0.16)', color: '#B8341A',       ring: 'rgba(236, 56, 19, 0.22)' },
  { bg: 'rgba(1, 30, 84, 0.06)',     color: 'var(--deep)',   ring: 'rgba(1, 30, 84, 0.16)'   },
  { bg: 'rgba(21, 31, 40, 0.05)',    color: 'var(--carbon)', ring: 'rgba(21, 31, 40, 0.16)'  },
];

// Mismo nombre → mismo color, aunque cambie el orden de las reseñas.
function toneFor(name: string | null): AvatarTone {
  let h = 0;
  for (const ch of name ?? '') h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return AVATAR_PALETTE[h % AVATAR_PALETTE.length];
}

// «Valentina Brand y Oscar Carvajal» → «VO»: si firman varias personas,
// una inicial por persona; si es una sola, nombre y apellido.
function toInitials(name: string | null): string {
  if (!name) return '?';
  const personas = name.split(/\s+(?:y|e|&)\s+|,\s*/i).filter(Boolean);
  const letras = personas.length > 1
    ? personas.map(p => p.trim()[0])
    : name.split(/\s+/).filter(Boolean).map(w => w[0]);
  return letras.join('').slice(0, 2).toUpperCase();
}

@Component({
  selector: 'app-testimonials',
  standalone: true,
  imports: [RouterLink, ReactiveFormsModule, ResenaTextoComponent],
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
    // Ley 1581 de 2012: sin autorización expresa no se envía. No viaja con la reseña.
    aceptaDatos:   [false, [Validators.requiredTrue]],
    // Campo trampa: invisible para personas, los bots suelen llenarlo.
    web:           [''],
  });

  async ngOnInit() {
    try {
      const resenas = await this.resenas.getVisibles();
      this.testimonials.set(resenas.map((r: Resena) => ({
        id:       r.id,
        quote:    r.comentario,
        name:     r.nombre,
        role:     r.cargo_empresa ?? '',
        initials: toInitials(r.nombre),
        avatar:   toneFor(r.nombre),
        slug:     r.proyecto?.slug ?? null,
        project:  r.proyecto?.title ?? null,
      })));
    } finally {
      this.loading.set(false);
    }
  }

  // Índice de la tarjeta visible, para los puntos de la fila en móvil.
  readonly actual = signal(0);

  alDeslizar() {
    const el = this.track()?.nativeElement;
    const card = el?.firstElementChild as HTMLElement | null;
    if (!el || !card) return;
    const paso = card.offsetWidth + parseFloat(getComputedStyle(el).columnGap || '0');
    const fin = el.scrollLeft + el.clientWidth >= el.scrollWidth - 2;
    this.actual.set(fin ? this.testimonials().length - 1 : Math.round(el.scrollLeft / paso));
  }

  irA(i: number) {
    const el = this.track()?.nativeElement;
    const card = el?.children[i] as HTMLElement | undefined;
    if (!el || !card) return;
    el.scrollTo({ left: card.offsetLeft - el.offsetLeft - parseFloat(getComputedStyle(el).paddingLeft), behavior: 'smooth' });
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

  invalido(campo: 'nombre' | 'comentario' | 'correo' | 'aceptaDatos'): boolean {
    const c = this.form.controls[campo];
    return c.invalid && c.touched;
  }
}
