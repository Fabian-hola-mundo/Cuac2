// src/app/core/services/portfolio.service.ts
import { Injectable, inject } from '@angular/core';
import { SupabaseService } from './supabase.service';

export interface PortfolioProject {
  id: string;
  title: string;
  slug: string;
  category: string;
  authors: string[];
  description: string | null;
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
    const { data } = await q;
    return (data ?? []) as PortfolioProject[];
  }

  async getAll(): Promise<PortfolioProject[]> {
    const { data } = await this.sb.db
      .from('portfolio_projects')
      .select('*')
      .order('created_at', { ascending: false });
    return (data ?? []) as PortfolioProject[];
  }

  async getById(id: string): Promise<PortfolioProject | null> {
    const { data } = await this.sb.db
      .from('portfolio_projects')
      .select('*')
      .eq('id', id)
      .single();
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

  async uploadImage(slug: string, file: File, name: string): Promise<string | null> {
    const path = `${slug}/${name}`;
    const { error } = await this.sb.db.storage
      .from('portfolio')
      .upload(path, file, { upsert: true });
    if (error) return null;
    const { data } = this.sb.db.storage
      .from('portfolio')
      .getPublicUrl(path);
    return data.publicUrl;
  }
}
