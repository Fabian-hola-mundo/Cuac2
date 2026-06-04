import { Component, inject, HostListener } from '@angular/core';
import { HelpModalService } from './help-modal.service';

@Component({
  selector: 'app-help-modal',
  standalone: true,
  imports: [],
  templateUrl: './help-modal.component.html',
  styleUrl: './help-modal.component.scss',
})
export class HelpModalComponent {
  readonly service = inject(HelpModalService);

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.service.close();
  }
}
