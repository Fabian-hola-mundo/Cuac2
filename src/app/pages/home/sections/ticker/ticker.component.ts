import { Component } from '@angular/core';

@Component({
  selector: 'app-ticker',
  standalone: true,
  templateUrl: './ticker.component.html',
  styleUrl: './ticker.component.scss',
})
export class TickerComponent {
  items = [
    'Startups Series A — D',
    'Editoriales',
    'Bancos & Fintech',
    'Salud & Bienestar',
    'Retail & Consumo',
    'Educación',
    'Tecnología',
    'Cultura & Eventos',
  ];
}
