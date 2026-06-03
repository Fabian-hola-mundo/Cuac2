import { Component, signal, HostListener, ViewChild, ElementRef } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-topbar',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './topbar.component.html',
  styleUrl: './topbar.component.scss',
})
export class TopbarComponent {
  @ViewChild('burgerBtn') burgerBtn!: ElementRef<HTMLButtonElement>;

  menuOpen = signal(false);

  toggleMenu() {
    this.menuOpen.update(v => !v);
  }

  closeMenu() {
    this.menuOpen.set(false);
    this.burgerBtn?.nativeElement?.focus();
  }

  @HostListener('document:keydown.escape')
  onEscape() {
    if (this.menuOpen()) this.closeMenu();
  }
}
