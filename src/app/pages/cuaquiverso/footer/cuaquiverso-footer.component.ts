import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { HelpModalComponent } from '../help-modal/help-modal.component';
import { HelpModalService } from '../help-modal/help-modal.service';
import { MensajesFormComponent } from '../mensajes-form/mensajes-form.component';

@Component({
  selector: 'app-cuaquiverso-footer',
  standalone: true,
  imports: [RouterLink, HelpModalComponent, MensajesFormComponent],
  templateUrl: './cuaquiverso-footer.component.html',
  styleUrl: './cuaquiverso-footer.component.scss',
})
export class CuaquiversoFooterComponent {
  readonly year      = new Date().getFullYear();
  readonly helpModal = inject(HelpModalService);
}
