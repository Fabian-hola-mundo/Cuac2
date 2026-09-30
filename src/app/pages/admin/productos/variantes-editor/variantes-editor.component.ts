// src/app/pages/admin/productos/variantes-editor/variantes-editor.component.ts
//
// Opciones (Talla, Color…) y la tabla de combinaciones que salen de ellas. El
// formulario de producto le pide `payload()` al guardar; aquí no se persiste
// nada.
import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Combinacion, OpcionDef, normalizarOpciones } from '../../../../../../supabase/functions/_shared/variantes';
import { ProductoOpcion, ProductoVariante } from '../../../../core/services/inventario.service';
import { FilaVariante, contarDesactivadas, reconciliarFilas } from './filas';

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
      campo === 'precio' ? { ...f, precio: valor }
        : f.existente ? f : { ...f, stock: Math.max(0, valor ?? 0) }));
  }

  editarFila(idx: number, cambios: Partial<FilaVariante>): void {
    this.filas.update(fs => fs.map((f, j) => (j === idx ? { ...f, ...cambios } : f)));
  }

  payload(): {
    opciones: OpcionDef[];
    variantes: { opciones: Combinacion; precio: number | null; stock_inicial: number; activo: boolean }[];
  } {
    if (!this.activo()) return { opciones: [], variantes: [] };
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
