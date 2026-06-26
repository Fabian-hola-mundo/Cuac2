import { Injectable, inject } from '@angular/core';
import { SupabaseService } from './supabase.service';

@Injectable({ providedIn: 'root' })
export class SiteSettingsService {
  private sb = inject(SupabaseService);

  async get(key: string): Promise<string | null> {
    const { data, error } = await this.sb.db
      .from('site_settings')
      .select('value')
      .eq('key', key)
      .maybeSingle();
    if (error) return null;
    return data?.value ?? null;
  }

  async set(key: string, value: string): Promise<{ error: string | null }> {
    const { error } = await this.sb.db
      .from('site_settings')
      .upsert({ key, value, updated_at: new Date().toISOString() });
    return { error: error?.message ?? null };
  }
}
