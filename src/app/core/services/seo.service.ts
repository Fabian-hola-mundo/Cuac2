import { Injectable, inject } from '@angular/core';
import { Title, Meta } from '@angular/platform-browser';
import { DOCUMENT } from '@angular/common';
import { PortfolioProject } from './portfolio.service';

const SITE_NAME = 'Cuac Design';
const BASE_URL  = 'https://cuacdesign.com';
const OG_IMAGE  = `${BASE_URL}/assets/og-cuac.jpg`;

export interface SeoConfig {
  title:       string;
  description: string;
  canonical:   string;
  ogImage?:    string;
  ogType?:     'website' | 'article';
  noindex?:    boolean;
}

@Injectable({ providedIn: 'root' })
export class SeoService {
  private titleSvc = inject(Title);
  private meta     = inject(Meta);
  private doc      = inject(DOCUMENT);

  set(config: SeoConfig): void {
    const fullTitle = config.title.includes(SITE_NAME)
      ? config.title
      : `${config.title} | ${SITE_NAME}`;
    const ogImg  = config.ogImage ?? OG_IMAGE;
    const ogType = config.ogType  ?? 'website';

    this.titleSvc.setTitle(fullTitle);

    this.meta.updateTag({ name: 'description',         content: config.description });
    this.meta.updateTag({ name: 'robots',              content: config.noindex ? 'noindex, nofollow' : 'index, follow' });
    this.meta.updateTag({ property: 'og:title',        content: fullTitle });
    this.meta.updateTag({ property: 'og:description',  content: config.description });
    this.meta.updateTag({ property: 'og:url',          content: config.canonical });
    this.meta.updateTag({ property: 'og:image',        content: ogImg });
    this.meta.updateTag({ property: 'og:type',         content: ogType });
    this.meta.updateTag({ name: 'twitter:card',        content: 'summary_large_image' });
    this.meta.updateTag({ name: 'twitter:title',       content: fullTitle });
    this.meta.updateTag({ name: 'twitter:description', content: config.description });
    this.meta.updateTag({ name: 'twitter:image',       content: ogImg });

    this.setCanonical(config.canonical);
  }

  setProject(project: PortfolioProject): void {
    const raw  = project.headline ?? project.description ?? '';
    const desc = raw.length > 155 ? raw.slice(0, 152) + '…' : raw;
    this.set({
      title:       project.title,
      description: desc,
      canonical:   `${BASE_URL}/portafolio/${project.slug}`,
      ogImage:     project.cover_url ?? OG_IMAGE,
      ogType:      'article',
    });
  }

  setJsonLd(schema: object): void {
    const id     = 'json-ld-schema';
    let   script = this.doc.getElementById(id) as HTMLScriptElement | null;
    if (!script) {
      script      = this.doc.createElement('script');
      script.id   = id;
      script.type = 'application/ld+json';
      this.doc.head.appendChild(script);
    }
    script.textContent = JSON.stringify(schema);
  }

  private setCanonical(url: string): void {
    let link = this.doc.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!link) {
      link = this.doc.createElement('link');
      link.setAttribute('rel', 'canonical');
      this.doc.head.appendChild(link);
    }
    link.setAttribute('href', url);
  }
}
