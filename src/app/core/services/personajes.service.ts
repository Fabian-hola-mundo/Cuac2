import { Injectable, signal, computed } from '@angular/core';
import { SupabaseService } from './supabase.service';

export interface Personaje {
  id: string;
  key: string;
  nombre: string;
  sort_order: number;
  region: string | null;
  color: string | null;
  wire_color: string | null;
  slogan: string | null;
  bio: string | null;
  musica: string | null;
  personalidad: string | null;
  fauna_flora: string | null;
  cover_url: string | null;
  galeria_urls: string[];
  activo: boolean;
  creado_en: string;
}

@Injectable({ providedIn: 'root' })
export class PersonajesService {
  readonly personajes = signal<Personaje[]>([]);
  readonly cargando   = signal(false);
  readonly error      = signal<string | null>(null);

  readonly activos = computed(() =>
    this.personajes().filter(p => p.activo).sort((a, b) => a.sort_order - b.sort_order)
  );

  constructor(private sb: SupabaseService) {}

  async load(): Promise<void> {
    if (this.cargando()) return;
    this.cargando.set(true);
    this.error.set(null);
    const { data, error } = await this.sb.db
      .from('personajes')
      .select('*')
      .order('sort_order', { ascending: true });
    if (error) {
      this.error.set(error.message);
      this.cargando.set(false);
      return;
    }
    this.personajes.set(
      (data ?? []).map(p => ({ ...p, galeria_urls: p.galeria_urls ?? [] }))
    );
    this.cargando.set(false);
  }

  getByKey(key: string): Personaje | undefined {
    return this.personajes().find(p => p.key === key);
  }

  async create(
    payload: Omit<Personaje, 'id' | 'creado_en'>,
    coverFile?: File,
    galleryFiles: File[] = []
  ): Promise<{ id: string | null; error: string | null }> {
    const { data, error } = await this.sb.db
      .from('personajes')
      .insert(payload)
      .select('id')
      .single();
    if (error) return { id: null, error: error.message };
    const id = data.id as string;

    let cover_url = payload.cover_url;
    if (coverFile) {
      const { url } = await this.uploadImage(id, coverFile, 'cover');
      if (url) cover_url = url;
    }

    const galeria_urls: string[] = [];
    for (let i = 0; i < galleryFiles.length; i++) {
      const { url } = await this.uploadImage(id, galleryFiles[i], `gallery_${i}`);
      if (url) galeria_urls.push(url);
    }

    if (coverFile || galleryFiles.length > 0) {
      await this.sb.db.from('personajes').update({ cover_url, galeria_urls }).eq('id', id);
    }

    await this.load();
    return { id, error: null };
  }

  async update(
    id: string,
    payload: Partial<Omit<Personaje, 'id' | 'creado_en'>>,
    coverFile?: File,
    newGalleryFiles: File[] = [],
    removedUrls: string[] = []
  ): Promise<{ error: string | null }> {
    let cover_url = payload.cover_url;
    if (coverFile) {
      const ext = coverFile.name.split('.').pop() ?? 'jpg';
      const { url, error: uploadErr } = await this.uploadImage(id, coverFile, `cover.${ext}`);
      if (uploadErr) return { error: `Cover upload failed: ${uploadErr}` };
      if (url) cover_url = url;
    }

    const existing = (payload.galeria_urls ?? []).filter(u => !removedUrls.includes(u));
    const newUrls: string[] = [];
    for (let i = 0; i < newGalleryFiles.length; i++) {
      const ext = newGalleryFiles[i].name.split('.').pop() ?? 'jpg';
      const { url, error: uploadErr } = await this.uploadImage(id, newGalleryFiles[i], `gallery_${Date.now()}_${i}.${ext}`);
      if (uploadErr) return { error: `Gallery upload failed: ${uploadErr}` };
      if (url) newUrls.push(url);
    }

    const { error } = await this.sb.db
      .from('personajes')
      .update({ ...payload, cover_url, galeria_urls: [...existing, ...newUrls] })
      .eq('id', id);
    if (error) return { error: error.message };

    await this.load();
    return { error: null };
  }

  async updateOrder(items: { id: string; sort_order: number }[]): Promise<{ error: string | null }> {
    for (const item of items) {
      const { error } = await this.sb.db
        .from('personajes')
        .update({ sort_order: item.sort_order })
        .eq('id', item.id);
      if (error) return { error: error.message };
    }
    await this.load();
    return { error: null };
  }

  async toggleActivo(id: string, activo: boolean): Promise<{ error: string | null }> {
    const { error } = await this.sb.db
      .from('personajes')
      .update({ activo })
      .eq('id', id);
    if (error) return { error: error.message };
    await this.load();
    return { error: null };
  }

  async delete(id: string): Promise<{ error: string | null }> {
    const { error } = await this.sb.db
      .from('personajes')
      .delete()
      .eq('id', id);
    if (error) return { error: error.message };
    await this.load();
    return { error: null };
  }

  async uploadImage(
    personajeId: string,
    file: File,
    name: string
  ): Promise<{ url: string | null; error: string | null }> {
    const safeName = name.replace(/[^a-z0-9._-]/gi, '_');
    const path = `${personajeId}/${safeName}`;
    const { error } = await this.sb.db.storage
      .from('personajes-media')
      .upload(path, file, { upsert: true, contentType: file.type || undefined });
    if (error) return { url: null, error: error.message };
    const { data } = this.sb.db.storage
      .from('personajes-media')
      .getPublicUrl(path);
    return { url: data.publicUrl, error: null };
  }
}
