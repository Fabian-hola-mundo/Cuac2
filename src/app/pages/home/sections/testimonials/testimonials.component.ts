import { Component, OnInit, signal, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { PortfolioService, PortfolioProject } from '../../../../core/services/portfolio.service';

interface TestimonialDisplay {
  quote:       string;
  name:        string;
  role:        string;
  initials:    string;
  avatarBg:    string;
  avatarColor: string;
  slug:        string;
}

const AVATAR_PALETTE: Array<{ bg: string; color: string }> = [
  { bg: 'var(--ember)', color: 'white'           },
  { bg: 'var(--deep)',  color: 'white'           },
  { bg: 'var(--coral)', color: 'var(--carbon)'   },
];

function toInitials(name: string | null): string {
  if (!name) return '?';
  return name.split(' ')
    .filter(Boolean)
    .map(w => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

@Component({
  selector: 'app-testimonials',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './testimonials.component.html',
  styleUrl: './testimonials.component.scss',
})
export class TestimonialsComponent implements OnInit {
  private portfolio = inject(PortfolioService);

  readonly loading      = signal(true);
  readonly testimonials = signal<TestimonialDisplay[]>([]);

  async ngOnInit() {
    try {
      const projects = await this.portfolio.getTestimonials();
      const mapped: TestimonialDisplay[] = projects.map((p: PortfolioProject, i: number) => {
        const palette = AVATAR_PALETTE[i % AVATAR_PALETTE.length];
        return {
          quote:       p.client_comment ?? '',
          name:        p.client_person ?? p.client_name ?? '',
          role:        p.client_role ?? '',
          initials:    toInitials(p.client_person ?? p.client_name),
          avatarBg:    palette.bg,
          avatarColor: palette.color,
          slug:        p.slug,
        };
      });
      this.testimonials.set(mapped);
    } finally {
      this.loading.set(false);
    }
  }
}
