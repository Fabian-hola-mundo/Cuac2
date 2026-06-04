import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { HelpModalService } from '../help-modal/help-modal.service';

@Component({
  selector: 'app-cuaquiverso-footer',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './cuaquiverso-footer.component.html',
  styleUrl: './cuaquiverso-footer.component.scss',
})
export class CuaquiversoFooterComponent {
  readonly year      = new Date().getFullYear();
  readonly helpModal = inject(HelpModalService);
}
