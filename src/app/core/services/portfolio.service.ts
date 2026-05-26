// src/app/core/services/portfolio.service.ts
import { Injectable, inject } from '@angular/core';
import { SupabaseService } from './supabase.service';

export interface PortfolioProject {
  id: string;
  title: string;
  slug: string;
  category: string;
  authors: string[];
  headline: string | null;
  client_name: string | null;
  description: string | null;
  client_comment: string | null;
  cover_url: string | null;
  images: string[];
  tags: string[];
  featured: boolean;
  published: boolean;
  created_at: string;
}

export type ProjectPayload = Omit<PortfolioProject, 'id' | 'created_at'>;

export const PORTFOLIO_CATEGORIES = [
  { id: 'branding',    label: 'Branding'    },
  { id: 'identidad',   label: 'Identidad'   },
  { id: 'editorial',   label: 'Editorial'   },
  { id: 'packaging',   label: 'Packaging'   },
  { id: 'ilustración', label: 'Ilustración' },
  { id: 'web',         label: 'Web'         },
  { id: 'motion',      label: 'Motion'      },
  { id: 'ux-ui',       label: 'UX/UI'       },
];

@Injectable({ providedIn: 'root' })
export class PortfolioService {
  private sb = inject(SupabaseService);

  async getPublished(author?: string): Promise<PortfolioProject[]> {
    let q = this.sb.db
      .from('portfolio_projects')
      .select('*')
      .eq('published', true)
      .order('featured', { ascending: false })
      .order('created_at', { ascending: false });
    if (author) q = (q as any).contains('authors', [author]);
    const { data, error } = await q;
    if (error) console.error('[portfolio] getPublished:', error.message);
    return (data ?? []) as PortfolioProject[];
  }

  async getAll(): Promise<PortfolioProject[]> {
    const { data, error } = await this.sb.db
      .from('portfolio_projects')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) console.error('[portfolio] getAll:', error.message);
    return (data ?? []) as PortfolioProject[];
  }

  async getById(id: string): Promise<PortfolioProject | null> {
    const { data, error } = await this.sb.db
      .from('portfolio_projects')
      .select('*')
      .eq('id', id)
      .single();
    if (error && error.code !== 'PGRST116') console.error('[portfolio] getById:', error.message);
    return data as PortfolioProject | null;
  }

  async getBySlug(slug: string): Promise<PortfolioProject | null> {
    const { data, error } = await this.sb.db
      .from('portfolio_projects')
      .select('*')
      .eq('slug', slug)
      .eq('published', true)
      .single();
    if (error && error.code !== 'PGRST116') console.error('[portfolio] getBySlug:', error.message);
    return data as PortfolioProject | null;
  }

  async create(payload: ProjectPayload): Promise<{ id: string | null; error: string | null }> {
    const { data, error } = await this.sb.db
      .from('portfolio_projects')
      .insert(payload)
      .select('id')
      .single();
    return { id: (data as any)?.id ?? null, error: error?.message ?? null };
  }

  async update(id: string, payload: Partial<ProjectPayload>): Promise<{ error: string | null }> {
    const { error } = await this.sb.db
      .from('portfolio_projects')
      .update(payload)
      .eq('id', id);
    return { error: error?.message ?? null };
  }

  async remove(id: string): Promise<{ error: string | null }> {
    const { error } = await this.sb.db
      .from('portfolio_projects')
      .delete()
      .eq('id', id);
    return { error: error?.message ?? null };
  }

  async uploadImage(slug: string, file: File, name: string): Promise<{ url: string | null; error: string | null }> {
    const safeName = name.replace(/[^a-z0-9._-]/gi, '_');
    const path = `${slug}/${safeName}`;
    const { error } = await this.sb.db.storage
      .from('portfolio')
      .upload(path, file, { upsert: true });
    if (error) return { url: null, error: error.message };
    const { data } = this.sb.db.storage
      .from('portfolio')
      .getPublicUrl(path);
    return { url: data.publicUrl, error: null };
  }
}
