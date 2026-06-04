import { Component, computed, signal, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators, AbstractControl } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { PersonajesService } from '../../../core/services/personajes.service';

@Component({
  selector: 'app-personaje-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './personaje-form.component.html',
  styleUrl: './personaje-form.component.scss',
})
export class PersonajeFormComponent implements OnInit {
  private router  = inject(Router);
  private route   = inject(ActivatedRoute);
  private fb      = inject(FormBuilder);
  readonly svc    = inject(PersonajesService);

  readonly editId    = signal<string | null>(null);
  readonly guardando = signal(false);
  readonly errorMsg  = signal<string | null>(null);
  readonly isEdit    = computed(() => this.editId() !== null);

  readonly coverPreview    = signal<string | null>(null);
  readonly galleryPreviews = signal<string[]>([]);
  private coverFile?: File;
  private galleryFileMap = new Map<string, File>();
  private removedUrls: string[] = [];

  form = this.fb.group({
    nombre:       ['', [Validators.required, Validators.minLength(2)]],
    key:          ['', [Validators.required, Validators.pattern(/^[a-z0-9-]+$/)]],
    region:       [''],
    color:        ['#2A6FDB'],
    wire_color:   ['#5C95EA'],
    slogan:       ['', Validators.maxLength(120)],
    bio:          [''],
    musica:       [''],
    personalidad: [''],
    fauna_flora:  [''],
    activo:       [true],
  });

  async ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.editId.set(id);
      await this.svc.load();
      const p = this.svc.getByKey(id) ?? this.svc.personajes().find(x => x.id === id);
      if (p) {
        this.form.patchValue({
          nombre:       p.nombre,
          key:          p.key,
          region:       p.region ?? '',
          color:        p.color ?? '#2A6FDB',
          wire_color:   p.wire_color ?? '#5C95EA',
          slogan:       p.slogan ?? '',
          bio:          p.bio ?? '',
          musica:       p.musica ?? '',
          personalidad: p.personalidad ?? '',
          fauna_flora:  p.fauna_flora ?? '',
          activo:       p.activo,
        });
        this.form.get('key')?.disable();
        this.coverPreview.set(p.cover_url);
        this.galleryPreviews.set([...(p.galeria_urls ?? [])]);
      }
    }

    if (!this.isEdit()) {
      this.form.get('nombre')?.valueChanges.subscribe(v => {
        if (v && !this.form.get('key')?.dirty) {
          const slug = v.toLowerCase().normalize('NFD')
            .replace(/[̀-ͯ]/g, '')
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '');
          this.form.get('key')?.setValue(slug, { emitEvent: false });
        }
      });
    }
  }

  onCoverChange(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    this.coverFile = file;
    const reader = new FileReader();
    reader.onload = e => this.coverPreview.set(e.target?.result as string);
    reader.readAsDataURL(file);
  }

  onGalleryChange(event: Event) {
    const files = Array.from((event.target as HTMLInputElement).files ?? []);
    const current = this.galleryPreviews().length;
    const remaining = 8 - current;
    const toAdd = files.slice(0, remaining);
    toAdd.forEach((file) => {
      const key = `new_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      this.galleryFileMap.set(key, file);
      const reader = new FileReader();
      reader.onload = e => {
        this.galleryPreviews.update(prev => [...prev, key + '::' + (e.target?.result as string)]);
      };
      reader.readAsDataURL(file);
    });
  }

  removeGalleryImage(index: number) {
    const entry = this.galleryPreviews()[index];
    if (!entry) return;
    if (entry.startsWith('new_')) {
      // It's a newly added file — extract key and remove from map
      const key = entry.split('::')[0];
      this.galleryFileMap.delete(key);
    } else {
      // It's an existing URL from Supabase — mark for removal
      this.removedUrls.push(entry);
    }
    this.galleryPreviews.update(prev => prev.filter((_, i) => i !== index));
  }

  async guardar() {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    this.guardando.set(true);
    this.errorMsg.set(null);

    const v = this.form.getRawValue();
    const existingGallery = this.galleryPreviews().filter(u => !u.startsWith('new_'));

    try {
      if (this.isEdit()) {
        const { error } = await this.svc.update(
          this.editId()!,
          {
            nombre:       v.nombre!,
            region:       v.region || null,
            color:        v.color || null,
            wire_color:   v.wire_color || null,
            slogan:       v.slogan || null,
            bio:          v.bio || null,
            musica:       v.musica || null,
            personalidad: v.personalidad || null,
            fauna_flora:  v.fauna_flora || null,
            activo:       v.activo ?? true,
            galeria_urls: existingGallery,
          },
          this.coverFile,
          Array.from(this.galleryFileMap.values()),
          this.removedUrls
        );
        if (error) { this.errorMsg.set(error); return; }
      } else {
        const nextOrder = this.svc.personajes().length + 1;
        const { error } = await this.svc.create(
          {
            key:          v.key!,
            nombre:       v.nombre!,
            sort_order:   nextOrder,
            region:       v.region || null,
            color:        v.color || null,
            wire_color:   v.wire_color || null,
            slogan:       v.slogan || null,
            bio:          v.bio || null,
            musica:       v.musica || null,
            personalidad: v.personalidad || null,
            fauna_flora:  v.fauna_flora || null,
            cover_url:    null,
            galeria_urls: [],
            activo:       v.activo ?? true,
          },
          this.coverFile,
          Array.from(this.galleryFileMap.values())
        );
        if (error) { this.errorMsg.set(error); return; }
      }
      this.router.navigate(['/admin/personajes']);
    } finally {
      this.guardando.set(false);
    }
  }

  cancelar() { this.router.navigate(['/admin/personajes']); }

  field(name: string): AbstractControl { return this.form.get(name)!; }
  isInvalid(name: string): boolean {
    const c = this.field(name); return c.invalid && c.touched;
  }
}
