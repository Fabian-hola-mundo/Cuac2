import { Component } from '@angular/core';
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
export class HomeComponent {}
