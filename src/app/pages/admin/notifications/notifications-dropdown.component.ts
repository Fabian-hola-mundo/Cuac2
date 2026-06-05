// src/app/pages/admin/notifications/notifications-dropdown.component.ts
import { Component, Input, Output, EventEmitter, inject } from '@angular/core';
import { Router } from '@angular/router';
import { AdminNotif } from './notifications.service';

@Component({
  selector: 'app-notifications-dropdown',
  standalone: true,
  imports: [],
  templateUrl: './notifications-dropdown.component.html',
  styleUrl: './notifications-dropdown.component.scss',
})
export class NotificationsDropdownComponent {
  @Input() items: AdminNotif[] = [];
  @Output() closed = new EventEmitter<void>();

  private router = inject(Router);

  navigate(item: AdminNotif, e: MouseEvent): void {
    e.stopPropagation();
    this.router.navigate(item.route).catch(err => console.error('[notif] navigate error', err));
    this.closed.emit();
  }

  stopProp(e: MouseEvent): void {
    e.stopPropagation();
  }

  timeAgo(iso: string): string {
    const ts = iso ? new Date(iso).getTime() : NaN;
    if (isNaN(ts)) return '';
    const diff = Date.now() - ts;
    if (diff < 0) return 'ahora';
    const mins = Math.floor(diff / 60_000);
    if (mins < 2)  return 'ahora';
    if (mins < 60) return `hace ${mins} min`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24)  return `hace ${hrs} h`;
    const days = Math.floor(hrs / 24);
    return days === 1 ? 'ayer' : `hace ${days} d`;
  }

  readonly today = new Date().toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'short' });
}
