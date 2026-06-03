import { Component, afterNextRender, DestroyRef, inject } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { RouterLink } from '@angular/router';

const LOGO_FULL = `<svg viewBox="0 0 805.42 186.8" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet" style="width:100%;height:auto;">
  <path fill="currentColor" d="M88.93,3.01c-6.81.03-13.63.39-20.38,1.12C34.86,7.77,12.18,27.29,4.07,60.16c-5.6,22.7-5.43,45.59.58,68.19,7.18,27.07,24.36,44.85,51.72,51.69,9.17,2.3,18.82,3.54,28.28,3.67,32.51.44,100.55-.05,102.03-.19v-36.66c0-13.9-11.26-25.16-25.16-25.16-16.91,0-39.23,0-56.98-.02l-14.65-.02c-4.27-.02-8.59-.15-12.81-.8-9.43-1.45-16.83-5.9-20.48-15.21-7.69-19.58,2.48-37.11,23.24-39.9,3.45-.46,6.98-.61,10.48-.61,18.24-.03,49.37-.03,71.35-.03,13.9,0,25.16-11.26,25.16-25.16V2.96c-2.57,0-67.52-.07-97.89.05h0Z"/>
  <path fill="currentColor" d="M209.21,97.89c.03,6.81.39,13.63,1.12,20.38,3.64,33.69,23.15,56.35,56.01,64.46,22.7,5.6,45.59,5.43,68.19-.56,27.07-7.18,44.85-24.36,51.69-51.72,2.3-9.17,3.54-18.82,3.67-28.28.44-32.51-.05-100.55-.19-102.03h-36.66c-13.9,0-25.16,11.26-25.16,25.16,0,16.91,0,39.23-.02,56.98v14.65c-.02,4.27-.15,8.59-.8,12.81-1.45,9.43-5.9,16.83-15.21,20.5-19.58,7.69-37.11-2.48-39.9-23.24-.46-3.45-.61-6.98-.61-10.48-.03-18.24-.03-49.37-.03-71.35C271.3,11.28,260.04.02,246.14.02h-36.99c0,2.55-.07,67.51.05,97.87h0Z"/>
  <path fill="currentColor" d="M596.2,88.93c-.03-6.81-.39-13.63-1.12-20.38-3.64-33.69-23.15-56.35-56.01-64.46-22.71-5.61-45.61-5.44-68.2.54-27.07,7.18-44.85,24.36-51.69,51.72-2.3,9.17-3.54,18.82-3.67,28.28-.44,32.51.05,100.55.19,102.03h36.66c13.9,0,25.16-11.26,25.16-25.16,0-11.64,0-26.9,0-26.9h27.65c11.97,0,21.68-11.41,21.68-23.38,0-3.92,0-7.17,0-8.4h-67.52c-6.18,0-11.18-3.3-11.18-9.47h29.36v-3.47c.02-4.27.15-8.59.8-12.81,1.45-9.43,5.9-16.83,15.21-20.48,19.58-7.69,37.11,2.48,39.9,23.24.46,3.45.61,6.98.61,10.48.03,18.24.03,49.37.03,71.35,0,13.9,11.27,25.16,25.16,25.16h36.99c.02-2.55.09-67.51-.03-97.87h0Z"/>
  <path fill="currentColor" d="M707.51,3.01c-6.81.03-13.63.39-20.38,1.12-33.69,3.64-56.35,23.15-64.46,56.01-5.6,22.7-5.43,45.59.58,68.19,7.18,27.07,24.36,44.85,51.72,51.69,9.17,2.3,18.82,3.54,28.28,3.67,32.51.44,100.55-.05,102.03-.19v-36.65c0-13.9-11.26-25.16-25.16-25.16-16.91,0-39.23,0-56.98-.02,0,0-23.24-.17-27.46-.82-9.43-1.45-16.83-5.9-20.48-15.21-7.69-19.58,2.48-37.11,23.24-39.9,3.45-.46,6.98-.61,10.48-.61,18.24-.03,49.37-.03,71.35-.03,13.9,0,25.16-11.26,25.16-25.16V2.96c-2.59,0-67.54-.07-97.91.05h0Z"/>
</svg>`;

const LOGO_ISO = `<svg viewBox="0 0 200 186.8" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet" style="width:100%;height:100%;">
  <path fill="currentColor" d="M88.93,3.01c-6.81.03-13.63.39-20.38,1.12C34.86,7.77,12.18,27.29,4.07,60.16c-5.6,22.7-5.43,45.59.58,68.19,7.18,27.07,24.36,44.85,51.72,51.69,9.17,2.3,18.82,3.54,28.28,3.67,32.51.44,100.55-.05,102.03-.19v-36.66c0-13.9-11.26-25.16-25.16-25.16-16.91,0-39.23,0-56.98-.02l-14.65-.02c-4.27-.02-8.59-.15-12.81-.8-9.43-1.45-16.83-5.9-20.48-15.21-7.69-19.58,2.48-37.11,23.24-39.9,3.45-.46,6.98-.61,10.48-.61,18.24-.03,49.37-.03,71.35-.03,13.9,0,25.16-11.26,25.16-25.16V2.96c-2.57,0-67.52-.07-97.89.05h0Z"/>
</svg>`;

@Component({
  selector: 'app-identidad-corporativa',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './identidadcorporativa.component.html',
  styleUrl: './identidadcorporativa.component.scss',
})
export class IdentidadCorporativaComponent {
  private destroyRef = inject(DestroyRef);
  private sanitizer = inject(DomSanitizer);

  readonly logoFull: SafeHtml = this.sanitizer.bypassSecurityTrustHtml(LOGO_FULL);
  readonly logoIso: SafeHtml = this.sanitizer.bypassSecurityTrustHtml(LOGO_ISO);

  constructor() {
    afterNextRender(() => this.initActiveNav());
  }

  private initActiveNav(): void {
    const host = document.querySelector('app-identidad-corporativa');
    if (!host) return;
    const links = host.querySelectorAll<HTMLAnchorElement>('.rail-nav a[href^="#"]');
    const ids = ['cover', 'essence', 'logo', 'color', 'type', 'apps'];
    const sections = ids
      .map((id) => host.querySelector<HTMLElement>(`#${id}`))
      .filter((el): el is HTMLElement => !!el);

    if (!sections.length) return;

    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            const id = (e.target as HTMLElement).id;
            links.forEach((a) => {
              const isActive = a.getAttribute('href') === '#' + id;
              a.classList.toggle('active', isActive);
              a.setAttribute('aria-current', isActive ? 'page' : 'false');
            });
          }
        });
      },
      { rootMargin: '-40% 0px -55% 0px', threshold: 0 },
    );

    sections.forEach((s) => obs.observe(s));
    this.destroyRef.onDestroy(() => obs.disconnect());
  }
}
