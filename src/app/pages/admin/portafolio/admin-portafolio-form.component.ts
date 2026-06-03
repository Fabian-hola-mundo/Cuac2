import { Component, computed, signal, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import {
  PortfolioService,
  ProjectLink,
  PORTFOLIO_CATEGORIES,
  AUTHORS,
} from '../../../core/services/portfolio.service';

@Component({
  selector: 'app-admin-portafolio-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule],
  templateUrl: './admin-portafolio-form.component.html',
  styleUrl: './admin-portafolio-form.component.scss',
})
export class AdminPortafolioFormComponent implements OnInit {
  private router    = inject(Router);
  private route     = inject(ActivatedRoute);
  private fb        = inject(FormBuilder);
  private portfolio = inject(PortfolioService);

  readonly categorias = PORTFOLIO_CATEGORIES;
  readonly authors    = AUTHORS;
  readonly editId     = signal<string | null>(null);
  readonly guardando  = signal(false);
  readonly errorMsg   = signal<string | null>(null);
  readonly isEdit     = computed(() => this.editId() !== null);

  readonly coverPreview    = signal<string | null>(null);
  readonly galleryPreviews = signal<string[]>([]);
  private coverFile?: File;
  private galleryFiles: File[] = [];
  private existingImages: string[] = [];

  readonly selectedAuthors = signal<string[]>(['cuac']);

  readonly tags = signal<string[]>([]);
  tagInput      = '';

  readonly links = signal<ProjectLink[]>([]);
  readonly linkTypes: { id: ProjectLink['type']; label: string }[] = [
    { id: 'web',       label: 'Sitio web' },
    { id: 'video',     label: 'Video' },
    { id: 'behance',   label: 'Behance' },
    { id: 'instagram', label: 'Instagram' },
    { id: 'other',     label: 'Otro' },
  ];
  readonly MAX_LINKS = 5;

  form = this.fb.group({
    title:            ['', [Validators.required, Validators.minLength(2)]],
    slug:             ['', [Validators.required]],
    category:         ['branding', Validators.required],
    headline:         [''],
    client_name:      [''],
    description:      [''],
    client_comment:   [''],
    client_person:    [''],
    client_role:      [''],
    show_testimonial: [false],
    featured:         [false],
    published:        [false],
  });

  async ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.editId.set(id);
      const p = await this.portfolio.getById(id);
      if (p) {
        this.form.patchValue({
          title:            p.title,
          slug:             p.slug,
          category:         p.category,
          headline:         p.headline ?? '',
          client_name:      p.client_name ?? '',
          description:      p.description ?? '',
          client_comment:   p.client_comment ?? '',
          client_person:    p.client_person ?? '',
          client_role:      p.client_role ?? '',
          show_testimonial: p.show_testimonial,
          featured:         p.featured,
          published:        p.published,
        });
        this.selectedAuthors.set(p.authors);
        this.tags.set(p.tags);
        this.links.set(Array.isArray(p.links) ? [...p.links] : []);
        this.coverPreview.set(p.cover_url);
        this.galleryPreviews.set(p.images);
        this.existingImages = p.images;
      }
    }
  }

  onTitleChange(val: string) {
    if (!this.isEdit()) {
      const slug = val.toLowerCase()
        .normalize('NFD').replace(/[̀-ͯ]/g, '')
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9-]/g, '')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');
      this.form.patchValue({ slug });
    }
  }

  toggleAuthor(a: string) {
    const current = this.selectedAuthors();
    if (current.includes(a)) {
      if (current.length > 1) this.selectedAuthors.set(current.filter(x => x !== a));
    } else {
      this.selectedAuthors.set([...current, a]);
    }
  }

  onCoverChange(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    this.coverFile = file;
    this.coverPreview.set(URL.createObjectURL(file));
  }

  onGalleryChange(event: Event) {
    const files = Array.from((event.target as HTMLInputElement).files ?? []);
    this.galleryFiles = files;
    this.galleryPreviews.set(files.map(f => URL.createObjectURL(f)));
  }

  addTag() {
    const t = this.tagInput.trim();
    if (t && !this.tags().includes(t)) this.tags.update(list => [...list, t]);
    this.tagInput = '';
  }

  removeTag(t: string) { this.tags.update(list => list.filter(x => x !== t)); }

  addLink() {
    if (this.links().length >= this.MAX_LINKS) return;
    this.links.update(list => [...list, { label: '', url: '', type: 'web' }]);
  }

  removeLink(i: number) {
    this.links.update(list => list.filter((_, idx) => idx !== i));
  }

  updateLink(i: number, field: keyof ProjectLink, value: string) {
    this.links.update(list =>
      list.map((l, idx) => (idx === i ? { ...l, [field]: value } : l)),
    );
  }

  private cleanLinks(): ProjectLink[] {
    return this.links()
      .map(l => ({ ...l, label: l.label.trim(), url: l.url.trim() }))
      .filter(l => l.label && l.url);
  }

  async guardar() {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    this.guardando.set(true);
    this.errorMsg.set(null);

    try {
      const v    = this.form.value;
      const slug = v.slug!;
      let coverUrl: string | null = this.coverPreview() ?? null;

      if (this.coverFile) {
        const ext = this.coverFile.name.split('.').pop() ?? 'jpg';
        const { url } = await this.portfolio.uploadImage(slug, this.coverFile, `cover.${ext}`);
        coverUrl = url;
      }

      let images: string[] = this.existingImages;
      if (this.galleryFiles.length > 0) {
        const uploaded: string[] = [];
        for (let i = 0; i < this.galleryFiles.length; i++) {
          const f   = this.galleryFiles[i];
          const ext = f.name.split('.').pop() ?? 'jpg';
          const { url } = await this.portfolio.uploadImage(slug, f, `img-${i + 1}.${ext}`);
          if (url) uploaded.push(url);
        }
        images = uploaded;
      }

      const payload = {
        title:          v.title!,
        slug,
        category:       v.category!,
        authors:        this.selectedAuthors(),
        headline:       v.headline || null,
        client_name:    v.client_name || null,
        description:    v.description || null,
        client_comment:   v.client_comment || null,
        client_person:    v.client_person || null,
        client_role:      v.client_role || null,
        show_testimonial: v.show_testimonial ?? false,
        cover_url:        coverUrl,
        images,
        tags:           this.tags(),
        links:          this.cleanLinks(),
        featured:       v.featured ?? false,
        published:      v.published ?? false,
      };

      const result = this.isEdit()
        ? await this.portfolio.update(this.editId()!, payload)
        : await this.portfolio.create(payload);

      if (result.error) { this.errorMsg.set(result.error); return; }
      this.router.navigate(['/admin/portafolio']);
    } catch {
      this.errorMsg.set('Error al guardar el proyecto.');
    } finally {
      this.guardando.set(false);
    }
  }

  cancelar() { this.router.navigate(['/admin/portafolio']); }

  hasError(field: string) {
    const c = this.form.get(field);
    return c?.invalid && c?.touched;
  }
}
