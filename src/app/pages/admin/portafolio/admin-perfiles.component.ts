import { Component, signal, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink, RouterLinkActive } from '@angular/router';
import {
  PortfolioService,
  PortfolioProfile,
  AUTHORS,
  PortfolioOwner,
} from '../../../core/services/portfolio.service';

interface ProfileModel {
  bio:       string;
  photo_url: string | null;
  cv_url:    string | null;
  cvName:    string | null;
}

@Component({
  selector: 'app-admin-perfiles',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, RouterLinkActive],
  templateUrl: './admin-perfiles.component.html',
  styleUrl: './admin-perfiles.component.scss',
})
export class AdminPerfilesComponent implements OnInit {
  private portfolio = inject(PortfolioService);

  // collective first, then the two personal portfolios
  readonly owners = AUTHORS.slice().sort((a, b) =>
    a.id === 'cuac' ? -1 : b.id === 'cuac' ? 1 : 0,
  );

  readonly cargando = signal(false);
  readonly savingId = signal<string | null>(null);
  readonly savedId  = signal<string | null>(null);
  readonly errorMsg = signal<string | null>(null);

  readonly models = signal<Record<string, ProfileModel>>({});

  private photoFiles: Record<string, File> = {};
  private cvFiles:    Record<string, File> = {};

  async ngOnInit() {
    this.cargando.set(true);
    try {
      const profiles = await this.portfolio.getProfiles();
      const byOwner = new Map(profiles.map(p => [p.owner, p]));
      const map: Record<string, ProfileModel> = {};
      for (const o of this.owners) {
        const p = byOwner.get(o.id as PortfolioOwner);
        map[o.id] = {
          bio:       p?.bio ?? '',
          photo_url: p?.photo_url ?? null,
          cv_url:    p?.cv_url ?? null,
          cvName:    p?.cv_url ? this.fileName(p.cv_url) : null,
        };
      }
      this.models.set(map);
    } finally {
      this.cargando.set(false);
    }
  }

  isCuac(owner: string) { return owner === 'cuac'; }
  ownerLabel(owner: string) {
    if (owner === 'cuac') return 'Cuac (colectivo)';
    return this.owners.find(o => o.id === owner)?.label ?? owner;
  }
  bioLabel(owner: string) {
    return owner === 'cuac' ? 'Descripción del colectivo' : 'Biografía';
  }

  setBio(owner: string, value: string) {
    this.models.update(m => ({ ...m, [owner]: { ...m[owner], bio: value } }));
  }

  onPhoto(owner: string, event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    this.photoFiles[owner] = file;
    this.models.update(m => ({ ...m, [owner]: { ...m[owner], photo_url: URL.createObjectURL(file) } }));
  }

  onCv(owner: string, event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    this.cvFiles[owner] = file;
    this.models.update(m => ({ ...m, [owner]: { ...m[owner], cvName: file.name } }));
  }

  async guardar(owner: PortfolioOwner) {
    this.savingId.set(owner);
    this.errorMsg.set(null);
    try {
      const model = this.models()[owner];
      const patch: { bio: string | null; photo_url?: string | null; cv_url?: string | null } = {
        bio: model.bio.trim() || null,
      };

      if (this.photoFiles[owner]) {
        const ext = this.photoFiles[owner].name.split('.').pop() ?? 'jpg';
        const { url, error } = await this.portfolio.uploadAsset(`profiles/${owner}`, this.photoFiles[owner], `photo.${ext}`);
        if (error) { this.errorMsg.set(error); this.savingId.set(null); return; }
        patch.photo_url = url;
      }

      if (this.cvFiles[owner]) {
        const { url, error } = await this.portfolio.uploadAsset(`profiles/${owner}`, this.cvFiles[owner], 'cv.pdf');
        if (error) { this.errorMsg.set(error); this.savingId.set(null); return; }
        patch.cv_url = url;
      }

      const { error } = await this.portfolio.upsertProfile(owner, patch);
      if (error) { this.errorMsg.set(error); return; }

      delete this.photoFiles[owner];
      delete this.cvFiles[owner];
      this.savedId.set(owner);
      setTimeout(() => this.savedId.set(null), 2200);
    } finally {
      this.savingId.set(null);
    }
  }

  private fileName(url: string): string {
    try { return decodeURIComponent(url.split('/').pop() ?? 'cv.pdf').split('?')[0]; }
    catch { return 'cv.pdf'; }
  }
}
