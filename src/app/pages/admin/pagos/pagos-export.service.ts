import { Injectable } from '@angular/core';
import { Payment } from '../../../core/services/mock-admin-data.service';
import * as XLSX from 'xlsx';

@Injectable({ providedIn: 'root' })
export class PagosExportService {

  exportCsv(payments: Payment[], periodoSlug: string): void {
    const headers = ['ID Pago', 'Fecha', 'Orden', 'Método', 'Monto', 'Comisión', 'Neto', 'Estado'];
    const rows = payments.map(p => [p.id, p.date, p.order, p.method, p.amount, p.fee, p.net, p.status]);
    const csv = [headers, ...rows].map(r => r.join(';')).join('\n');
    const bom = '﻿';
    const blob = new Blob([bom + csv], { type: 'text/csv;charset=utf-8;' });
    this.triggerDownload(blob, `cuac-pagos-contador-${periodoSlug}.csv`);
  }

  exportXlsx(payments: Payment[], periodoSlug: string): void {
    const paid = payments.filter(p => p.status === 'paid');
    const neto       = paid.reduce((s, p) => s + p.net, 0);
    const comisiones = paid.reduce((s, p) => s + p.fee, 0);
    const pendiente  = payments.filter(p => p.status === 'pending').reduce((s, p) => s + p.amount, 0);
    const reembolsos = payments.filter(p => p.status === 'refunded').reduce((s, p) => s + p.amount, 0);

    const sheetResumen = XLSX.utils.aoa_to_sheet([
      ['KPI', 'Valor (COP)'],
      ['Neto del periodo', neto],
      ['Comisiones',       comisiones],
      ['Pendiente',        pendiente],
      ['Reembolsos',       reembolsos],
    ]);

    const movRows = payments.map(p => [p.id, p.date, p.order, p.method, p.amount, p.fee, p.net, p.status]);
    const sheetMov = XLSX.utils.aoa_to_sheet([
      ['ID Pago', 'Fecha', 'Orden', 'Método', 'Monto', 'Comisión', 'Neto', 'Estado'],
      ...movRows,
    ]);

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, sheetResumen, 'Resumen');
    XLSX.utils.book_append_sheet(wb, sheetMov, 'Movimientos');

    const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
    const blob = new Blob([buf], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    this.triggerDownload(blob, `cuac-reporte-pagos-${periodoSlug}.xlsx`);
  }

  private triggerDownload(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }
}
