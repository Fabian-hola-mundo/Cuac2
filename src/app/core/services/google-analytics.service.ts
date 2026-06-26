import { Injectable, inject } from '@angular/core';
import { SupabaseService } from './supabase.service';

export interface GaPageView {
  id: string; label: string; path: string;
  views7d: number; delta: number;
}

export interface GaPortfolioView {
  slug: string; title: string;
  views7d: number; delta: number;
  pinned: boolean;
}

export interface GaReport {
  configured: boolean;
  pages: GaPageView[];
  portfolios: GaPortfolioView[];
  fetchError?: string;
}

@Injectable({ providedIn: 'root' })
export class GoogleAnalyticsService {
  private sb = inject(SupabaseService);

  async getReport(): Promise<GaReport> {
    const { data, error } = await this.sb.db.functions.invoke('ga4-report');
    if (error) return { configured: false, pages: [], portfolios: [] };
    return {
      configured: data?.configured ?? false,
      pages: data?.pages ?? [],
      portfolios: data?.portfolios ?? [],
      fetchError: data?.ok === false ? (data?.error ?? 'Error al consultar Analytics') : undefined,
    };
  }
}
