import { Component, inject, OnInit } from '@angular/core';
import { TopbarComponent } from '../../layout/topbar/topbar.component';
import { FooterComponent } from '../../layout/footer/footer.component';
import { HeroComponent } from './sections/hero/hero.component';
import { TickerComponent } from './sections/ticker/ticker.component';
import { ServicesComponent } from './sections/services/services.component';
import { TiersComponent } from './sections/tiers/tiers.component';
import { ProcessComponent } from './sections/process/process.component';
import { CaseStudyComponent } from './sections/case-study/case-study.component';
import { TestimonialsComponent } from './sections/testimonials/testimonials.component';
import { CtaComponent } from './sections/cta/cta.component';
import { CursorGradientComponent } from '../../shared/cursor-gradient/cursor-gradient.component';
import { SeoService } from '../../core/services/seo.service';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [
    TopbarComponent,
    FooterComponent,
    HeroComponent,
    TickerComponent,
    ServicesComponent,
    TiersComponent,
    ProcessComponent,
    CaseStudyComponent,
    TestimonialsComponent,
    CtaComponent,
    CursorGradientComponent,
  ],
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss',
})
export class HomeComponent implements OnInit {
  private seo = inject(SeoService);

  ngOnInit(): void {
    this.seo.set({
      title:       'Cuac Design — Estudio creativo',
      description: 'Branding, diseño editorial, ilustración y web desde Bogotá para marcas que quieren verse tan bien como son.',
      canonical:   'https://cuacdesign.com',
    });

    this.seo.setJsonLd({
      '@context':    'https://schema.org',
      '@type':       'DesignCompany',
      name:          'Cuac Design',
      description:   'Estudio creativo colombiano especializado en branding, diseño editorial, ilustración y diseño web.',
      url:           'https://cuacdesign.com',
      logo:          'https://cuacdesign.com/assets/og-cuac.jpg',
      foundingDate:  '2024',
      address: {
        '@type':          'PostalAddress',
        addressLocality:  'Bogotá',
        addressCountry:   'CO',
      },
      sameAs: [
        'https://www.instagram.com/cuac.design/',
        'https://www.linkedin.com/company/cuac-design/',
      ],
    });
  }
}
