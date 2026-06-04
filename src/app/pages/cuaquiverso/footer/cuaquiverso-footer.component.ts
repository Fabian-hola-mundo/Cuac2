import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-cuaquiverso-footer',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './cuaquiverso-footer.component.html',
  styleUrl: './cuaquiverso-footer.component.scss',
})
export class CuaquiversoFooterComponent {
  readonly year = new Date().getFullYear();
}
