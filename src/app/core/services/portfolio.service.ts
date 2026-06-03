// src/app/core/services/portfolio.service.ts
import { Injectable, inject } from '@angular/core';
import { SupabaseService } from './supabase.service';

export interface ProjectLink {
  label: string;
  url:   string;
  type:  'web' | 'video' | 'behance' | 'instagram' | 'other';
}

export type PortfolioOwner = 'cuac' | 'natalia' | 'nathali';

export interface Achievement {
  id:           string;
  owners:       PortfolioOwner[];
  title:        string;
  organization: string | null;
  year:         number | null;
  type:         'award' | 'mention' | 'selection' | 'other';
  url:          string | null;
  sort_order:   number;
  published:    boolean;
  created_at:   string;
}

export type AchievementPayload = Omit<Achievement, 'id' | 'created_at'>;

export interface PortfolioProfile {
  owner:      PortfolioOwner;
  bio:        string | null;
  photo_url:  string | null;
  cv_url:     string | null;
  updated_at: string;
}

export const ACHIEVEMENT_TYPES = [
  { id: 'award',     label: 'Premio'           },
  { id: 'mention',   label: 'Mención de honor' },
  { id: 'selection', label: 'Selección'        },
  { id: 'other',     label: 'Otros'            },
] as const;

export interface PortfolioProject {
  id:             string;
  title:          string;
  slug:           string;
  category:       string;
  authors:        string[];
  headline:       string | null;
  client_name:    string | null;
  description:    string | null;
  client_comment: string | null;
  cover_url:      string | null;
  images:         string[];
  tags:           string[];
  links:          ProjectLink[];
  featured:       boolean;
  published:      boolean;
  created_at:     string;
}

export type ProjectPayload = Omit<PortfolioProject, 'id' | 'created_at'>;

export const AUTHORS = [
  { id: 'cuac',    label: 'Cuac',    color: '#011E54', textColor: '#011E54' },
  { id: 'natalia', label: 'Natalia', color: '#E87A89', textColor: '#7A2A3F' },
  { id: 'nathali', label: 'Nathali', color: '#8B9ED9', textColor: '#2A3B8A' },
];

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

  async getFeatured(author: PortfolioOwner): Promise<PortfolioProject | null> {
    const { data, error } = await this.sb.db
      .from('portfolio_projects')
      .select('*')
      .eq('featured', true)
      .eq('published', true)
      .contains('authors', [author])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) console.error('[portfolio] getFeatured:', error.message);
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
    return this.uploadAsset(slug, file, name);
  }

  async uploadAsset(folder: string, file: File, name: string): Promise<{ url: string | null; error: string | null }> {
    const safeName = name.replace(/[^a-z0-9._-]/gi, '_');
    const path = `${folder}/${safeName}`;
    const { error } = await this.sb.db.storage
      .from('portfolio')
      .upload(path, file, { upsert: true, contentType: file.type || undefined });
    if (error) return { url: null, error: error.message };
    const { data } = this.sb.db.storage
      .from('portfolio')
      .getPublicUrl(path);
    return { url: data.publicUrl, error: null };
  }

  // ── Achievements ──────────────────────────────────────────────────────────────
  async getAchievements(owner?: PortfolioOwner, publishedOnly = false): Promise<Achievement[]> {
    let q = this.sb.db
      .from('portfolio_achievements')
      .select('*')
      .order('sort_order', { ascending: true })
      .order('year', { ascending: false });
    if (owner) q = (q as any).contains('owners', [owner]);
    if (publishedOnly) q = q.eq('published', true);
    const { data, error } = await q;
    if (error) console.error('[portfolio] getAchievements:', error.message);
    return (data ?? []) as Achievement[];
  }

  async createAchievement(payload: AchievementPayload): Promise<{ error: string | null }> {
    const { error } = await this.sb.db.from('portfolio_achievements').insert(payload);
    return { error: error?.message ?? null };
  }

  async updateAchievement(id: string, payload: Partial<AchievementPayload>): Promise<{ error: string | null }> {
    const { error } = await this.sb.db.from('portfolio_achievements').update(payload).eq('id', id);
    return { error: error?.message ?? null };
  }

  async removeAchievement(id: string): Promise<{ error: string | null }> {
    const { error } = await this.sb.db.from('portfolio_achievements').delete().eq('id', id);
    return { error: error?.message ?? null };
  }

  // ── Profiles ──────────────────────────────────────────────────────────────────
  async getProfile(owner: PortfolioOwner): Promise<PortfolioProfile | null> {
    const { data, error } = await this.sb.db
      .from('portfolio_profiles')
      .select('*')
      .eq('owner', owner)
      .maybeSingle();
    if (error) console.error('[portfolio] getProfile:', error.message);
    return (data as PortfolioProfile | null) ?? null;
  }

  async getProfiles(): Promise<PortfolioProfile[]> {
    const { data, error } = await this.sb.db.from('portfolio_profiles').select('*');
    if (error) console.error('[portfolio] getProfiles:', error.message);
    return (data ?? []) as PortfolioProfile[];
  }

  async upsertProfile(owner: PortfolioOwner, patch: Partial<Omit<PortfolioProfile, 'owner' | 'updated_at'>>): Promise<{ error: string | null }> {
    const { error } = await this.sb.db
      .from('portfolio_profiles')
      .upsert({ owner, ...patch, updated_at: new Date().toISOString() }, { onConflict: 'owner' });
    return { error: error?.message ?? null };
  }
}
