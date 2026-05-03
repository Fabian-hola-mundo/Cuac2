import { Component } from '@angular/core';

@Component({
  selector: 'app-testimonials',
  standalone: true,
  templateUrl: './testimonials.component.html',
  styleUrl: './testimonials.component.scss',
})
export class TestimonialsComponent {
  testimonials = [
    {
      quote: 'Cuac entendió en una sola reunión lo que otros estudios no pudieron en tres meses. La nueva identidad es exactamente lo que necesitábamos para una Serie B.',
      name: 'Mariana Restrepo',
      role: 'VP Marketing · Fintech LatAm',
      initials: 'M',
      avatarBg: 'var(--ember)',
      avatarColor: 'white',
    },
    {
      quote: 'El sistema de motion que armaron nos quitó tres semanas de producción por campaña. Hoy lo usa todo el equipo interno.',
      name: 'Camilo Ortega',
      role: 'Head of Brand · Retail',
      initials: 'C',
      avatarBg: 'var(--deep)',
      avatarColor: 'white',
    },
    {
      quote: 'Profesionales, ágiles y con una sensibilidad estética que nos sorprendió. Llevamos cuatro proyectos juntos.',
      name: 'Laura Beltrán',
      role: 'Directora Editorial',
      initials: 'L',
      avatarBg: 'var(--coral)',
      avatarColor: 'var(--carbon)',
    },
  ];
}
