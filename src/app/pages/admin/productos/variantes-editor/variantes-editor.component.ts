// src/app/pages/admin/productos/variantes-editor/variantes-editor.component.ts
//
// Opciones (Talla, Color…) y la tabla de combinaciones que salen de ellas. El
// formulario de producto le pide `payload()` y `ajustes()` al guardar; aquí sólo
// se persiste el restock de una combinación, que es un movimiento inmediato.
import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Combinacion, OpcionDef, normalizarOpciones } from '../../../../../../supabase/functions/_shared/variantes';
import { InventarioService, ProductoOpcion, ProductoVariante } from '../../../../core/services/inventario.service';
import { FilaVariante, agregarValoresPendientes, contarDesactivadas, reconciliarFilas } from './filas';

const MAX_OPCIONES = 3;

@Component({
  selector: 'app-variantes-editor',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './variantes-editor.component.html',
  styleUrl: './variantes-editor.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VariantesEditorComponent {
  /** Fotos ya guardadas del producto (portada + galería) para asignar a valores. */
  readonly fotos = input.required<string[]>();
  readonly esEdicion = input(false);
  /** Id del producto ya guardado; sin él no hay restock por combinación. */
  readonly productoId = input<string | null>(null);

  private inv = inject(InventarioService);

  readonly activo = signal(false);
  readonly opciones = signal<OpcionDef[]>([]);
  readonly filas = signal<FilaVariante[]>([]);
  private existentes: ProductoVariante[] = [];

  readonly maxOpciones = MAX_OPCIONES;
  readonly nuevoValor: Record<number, string> = {};
  readonly fotoAbierta = signal<{ op: number; val: number } | null>(null);

  /** Mismo orden que las filas: el de las opciones normalizadas. */
  readonly desactivadas = computed(() =>
    contarDesactivadas(this.existentes, this.activo() ? this.filas() : [],
      normalizarOpciones(this.opciones()).map(o => o.nombre)));

  readonly error = computed(() => {
    if (!this.activo()) return null;
    const ops = normalizarOpciones(this.opciones());
    if (ops.length === 0) return 'Agrega al menos una opción con un valor.';
    if (!this.filas().some(f => f.activo)) return 'Deja al menos una combinación activa.';
    return null;
  });

  cargar(opciones: ProductoOpcion[], variantes: ProductoVariante[]): void {
    this.existentes = variantes;
    this.opciones.set(opciones.map(o => ({ nombre: o.nombre, valores: o.valores })));
    this.activo.set(variantes.some(v => v.activo));
    this.regenerar();
  }

  alternar(on: boolean): void {
    this.activo.set(on);
    if (on && this.opciones().length === 0) this.agregarOpcion();
  }

  agregarOpcion(): void {
    if (this.opciones().length >= MAX_OPCIONES) return;
    this.opciones.update(o => [...o, { nombre: '', valores: [] }]);
  }

  quitarOpcion(i: number): void {
    this.opciones.update(o => o.filter((_, j) => j !== i));
    this.fotoAbierta.set(null);
    this.regenerar();
  }

  renombrarOpcion(i: number, nombre: string): void {
    this.opciones.update(o => o.map((x, j) => (j === i ? { ...x, nombre } : x)));
    this.regenerar();
  }

  agregarValor(i: number): void {
    const valor = (this.nuevoValor[i] ?? '').trim();
    if (!valor) return;
    this.opciones.update(o => o.map((x, j) =>
      j === i ? { ...x, valores: [...x.valores, { valor, foto_url: null }] } : x));
    this.nuevoValor[i] = '';
    this.regenerar();
  }

  quitarValor(i: number, k: number): void {
    this.opciones.update(o => o.map((x, j) =>
      j === i ? { ...x, valores: x.valores.filter((_, n) => n !== k) } : x));
    this.fotoAbierta.set(null);
    this.regenerar();
  }

  moverValor(i: number, k: number, delta: -1 | 1): void {
    this.opciones.update(o => o.map((x, j) => {
      if (j !== i) return x;
      const vals = [...x.valores];
      const destino = k + delta;
      if (destino < 0 || destino >= vals.length) return x;
      [vals[k], vals[destino]] = [vals[destino], vals[k]];
      return { ...x, valores: vals };
    }));
    this.fotoAbierta.set(null);
    this.regenerar();
  }

  asignarFoto(i: number, k: number, url: string | null): void {
    this.opciones.update(o => o.map((x, j) => j !== i ? x : {
      ...x, valores: x.valores.map((v, n) => (n === k ? { ...v, foto_url: url } : v)),
    }));
    this.fotoAbierta.set(null);
  }

  aplicarATodas(campo: 'precio' | 'stock', valor: number | null): void {
    this.filas.update(fs => fs.map(f =>
      campo === 'precio' ? { ...f, precio: valor } : { ...f, stock: Math.max(0, valor ?? 0) }));
  }

  // ── Restock por combinación ───────────────────────────────────────────────
  /** Etiqueta de la fila con el restock abierto (las filas se regeneran; la etiqueta no). */
  readonly restockFila = signal<string | null>(null);
  readonly restockGuardando = signal(false);
  readonly restockError = signal<string | null>(null);
  readonly restockOk = signal<string | null>(null);
  restockCantidad: number | null = null;

  abrirRestock(f: FilaVariante): void {
    this.restockCantidad = null;
    this.restockError.set(null);
    this.restockOk.set(null);
    this.restockFila.set(f.etiqueta);
  }

  /** Se registra en el momento, como el restock de la lista. */
  async registrarRestock(f: FilaVariante): Promise<void> {
    const productoId = this.productoId();
    const cantidad = this.restockCantidad;
    if (!productoId || !f.id || this.restockGuardando()) return;
    if (!cantidad || cantidad <= 0 || !Number.isInteger(cantidad)) {
      this.restockError.set('Ingresa una cantidad entera mayor a 0.');
      return;
    }
    this.restockGuardando.set(true);
    this.restockError.set(null);
    const { error } = await this.inv.restockProducto(productoId, cantidad, undefined, f.id);
    this.restockGuardando.set(false);
    if (error) { this.restockError.set(error); return; }
    // Lo escrito a mano en la fila conserva su diferencia con la base.
    this.existentes = this.existentes.map(e =>
      e.id === f.id ? { ...e, stock_actual: e.stock_actual + cantidad } : e);
    this.filas.update(fs => fs.map(x => x.id !== f.id ? x : {
      ...x, stock: x.stock + cantidad, stockBase: (x.stockBase ?? 0) + cantidad,
    }));
    this.restockFila.set(null);
    this.restockOk.set(`Restock de ${cantidad} en ${f.etiqueta} registrado.`);
  }

  /** Combinaciones existentes cuyo stock se cambió a mano: se guardan como ajuste. */
  ajustes(): { varianteId: string; stock: number }[] {
    if (!this.activo()) return [];
    return this.filas()
      .filter(f => f.id && f.stockBase !== null && f.stock !== f.stockBase)
      .map(f => ({ varianteId: f.id!, stock: Math.max(0, f.stock) }));
  }

  /** Tras guardar los ajustes, lo escrito pasa a ser la base. */
  confirmarAjustes(): void {
    const porId = new Map(this.filas().filter(f => f.id).map(f => [f.id!, f.stock]));
    this.existentes = this.existentes.map(e =>
      porId.has(e.id) ? { ...e, stock_actual: porId.get(e.id)! } : e);
    this.filas.update(fs => fs.map(f => f.id ? { ...f, stockBase: f.stock } : f));
  }

  editarFila(idx: number, cambios: Partial<FilaVariante>): void {
    this.filas.update(fs => fs.map((f, j) => (j === idx ? { ...f, ...cambios } : f)));
  }

  /**
   * Suma a sus opciones los valores escritos sin pulsar Enter y regenera la
   * tabla. El formulario lo llama antes de validar, y `payload()` otra vez por
   * si acaso (no hace nada si ya no queda nada pendiente).
   */
  confirmarValoresPendientes(): void {
    const antes = this.opciones();
    const despues = agregarValoresPendientes(antes, this.nuevoValor);
    for (const k of Object.keys(this.nuevoValor)) this.nuevoValor[+k] = '';
    if (despues === antes) return;
    this.opciones.set(despues);
    this.regenerar();
  }

  payload(): {
    opciones: OpcionDef[];
    variantes: { opciones: Combinacion; precio: number | null; stock_inicial: number; activo: boolean }[];
  } {
    if (!this.activo()) return { opciones: [], variantes: [] };
    this.confirmarValoresPendientes();
    return {
      opciones: normalizarOpciones(this.opciones()),
      variantes: this.filas().map(f => ({
        opciones: f.opciones,
        precio: f.precio && f.precio > 0 ? f.precio : null,
        stock_inicial: f.existente ? 0 : Math.max(0, f.stock),
        activo: f.activo,
      })),
    };
  }

  private regenerar(): void {
    this.filas.set(reconciliarFilas(normalizarOpciones(this.opciones()), this.filas(), this.existentes));
  }
}
