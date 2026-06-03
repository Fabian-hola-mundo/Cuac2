import { Component } from '@angular/core';

@Component({
  selector: 'app-ticker',
  standalone: true,
  templateUrl: './ticker.component.html',
  styleUrl: './ticker.component.scss',
})
export class TickerComponent {
  items = [
    'Branding',
    'Diseño Editorial',
    'Ilustración',
    'Motion Graphics',
    'Diseño Web',
    'Identidad Visual',
    'Tipografía',
    'Packaging',
    'UI / UX',
    'Hecho en Colombia',
  ];
}
