// El ojo de la tabla de pedidos vive dentro de un <td> que corta la propagación
// del click, así que necesita su propio handler: sin él no abría nada. Y el
// drawer que abre tiene que mostrar el pedido de esa fila, no uno fijo.
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AdminHomeComponent } from './admin-home.component';
import { AdminStateService } from '../../core/services/admin-state.service';
import { MockAdminDataService, Order } from '../../core/services/mock-admin-data.service';
import { GoogleAnalyticsService } from '../../core/services/google-analytics.service';

class GoogleAnalyticsStub {
  async getReport() {
    return { configured: false, pages: [], portfolios: [] };
  }
}

/** Pedidos de prueba: el servicio arranca vacío, así que el spec trae los suyos. */
const PEDIDOS_DE_PRUEBA: Order[] = [
  { id: '#T-3', customerId: 'T-1', customer: 'Cliente Tres', email: 'tres@example.com', items: 1, total: 10000, status: 'paid',    shipping: 'delivered', date: '2026-01-03 10:00', city: 'Ciudad A', method: 'Bold' },
  { id: '#T-2', customerId: 'T-2', customer: 'Cliente Dos',  email: 'dos@example.com',  items: 2, total: 20000, status: 'failed',  shipping: 'pending',   date: '2026-01-02 10:00', city: 'Ciudad B', method: 'Bold' },
  { id: '#T-1', customerId: 'T-3', customer: 'Cliente Uno',  email: 'uno@example.com',  items: 3, total: 30000, status: 'pending', shipping: 'pending',   date: '2026-01-01 10:00', city: 'Ciudad C', method: 'Nequi' },
];

async function montarEnPedidos() {
  await TestBed.configureTestingModule({
    imports: [AdminHomeComponent],
    providers: [
      provideRouter([]),
      { provide: GoogleAnalyticsService, useClass: GoogleAnalyticsStub },
    ],
  }).compileComponents();

  TestBed.inject(MockAdminDataService).ORDERS.push(...PEDIDOS_DE_PRUEBA.map(o => ({ ...o })));
  TestBed.inject(AdminStateService).view.set('pedidos');

  const fixture = TestBed.createComponent(AdminHomeComponent);
  await fixture.whenStable();
  return fixture;
}

/** Los ojos de la tabla de pedidos, en el orden en que se pintan las filas. */
function ojos(fixture: Awaited<ReturnType<typeof montarEnPedidos>>): HTMLButtonElement[] {
  const host = fixture.nativeElement as HTMLElement;
  return Array.from(host.querySelectorAll<HTMLButtonElement>('td.actions button.icon-act'));
}

function textoDelDrawer(fixture: Awaited<ReturnType<typeof montarEnPedidos>>): string {
  const host = fixture.nativeElement as HTMLElement;
  return host.querySelector('.drawer')?.textContent ?? '';
}

describe('Detalle de pedido en el admin', () => {
  it('el ojo de la fila abre el drawer', async () => {
    const fixture = await montarEnPedidos();
    const cmp = fixture.componentInstance;

    expect(cmp.orderOn()).toBe(false);

    ojos(fixture)[0].click();
    await fixture.whenStable();

    expect(cmp.orderOn()).toBe(true);
    expect(cmp.selectedOrder()?.id).toBe(TestBed.inject(MockAdminDataService).ORDERS[0].id);
  });

  it('el drawer muestra el pedido de la fila en la que se hizo click', async () => {
    const fixture = await montarEnPedidos();
    const orders = TestBed.inject(MockAdminDataService).ORDERS;

    ojos(fixture)[2].click();
    await fixture.whenStable();

    const texto = textoDelDrawer(fixture);
    expect(texto).toContain(orders[2].id);
    expect(texto).toContain(orders[2].customer);
    expect(texto).not.toContain(orders[0].id);
  });

  it('cerrar el drawer limpia el pedido seleccionado', async () => {
    const fixture = await montarEnPedidos();
    const cmp = fixture.componentInstance;

    ojos(fixture)[1].click();
    await fixture.whenStable();
    cmp.closeOrder();
    await fixture.whenStable();

    expect(cmp.orderOn()).toBe(false);
    expect(cmp.selectedOrder()).toBeNull();
    expect((fixture.nativeElement as HTMLElement).querySelector('.drawer')).toBeNull();
  });

  it('la línea de tiempo refleja el estado real del pedido', async () => {
    const fixture = await montarEnPedidos();
    const cmp = fixture.componentInstance;
    const data = TestBed.inject(MockAdminDataService);

    const entregado = data.ORDERS.find(o => o.status === 'paid' && o.shipping === 'delivered')!;
    cmp.openOrder(entregado);
    expect(cmp.orderTimeline().map(t => t.title)).toEqual(
      ['Orden creada', 'Pago aprobado', 'Despachado', 'Entregado'],
    );

    const fallido = data.ORDERS.find(o => o.status === 'failed')!;
    cmp.openOrder(fallido);
    const titulos = cmp.orderTimeline().map(t => t.title);
    expect(titulos).toContain('Pago rechazado');
    expect(titulos).not.toContain('Entregado');
  });
});
