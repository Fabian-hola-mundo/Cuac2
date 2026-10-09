# Variantes de producto + reserva de stock — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Productos con opciones libres (Talla, Color, Tamaño…) cuyo stock y precio viven por combinación, vendibles en web y POS, con 15 min de stock apartado mientras el cliente paga con Bold.

**Architecture:** Dos migraciones SQL (026 variantes, 027 reservas) concentran la integridad: tablas nuevas, trigger que mantiene `productos_evento.stock_actual` = suma de variantes activas, funciones de stock con `p_variante_id` opcional, reservas con bloqueo por fila de producto. La lógica pura de variantes vive en `supabase/functions/_shared/variantes.ts` y la comparten las edge functions (Deno) y Angular (vitest). El frontend (tienda, carrito v2, checkout, confirmación, admin) y el POS consumen esas piezas.

**Tech Stack:** Angular 21 (signals, standalone, `@angular/build:unit-test` con vitest), Supabase (Postgres, PostgREST, Edge Functions en Deno), Bold checkout embebido, POS en HTML plano (`pos/index.html`).

**Spec:** `docs/superpowers/specs/2026-09-29-variantes-productos-design.md`

## Global Constraints

- Proyecto Supabase: `ytqcwrjxlnlsjgnjxiiw`. El MCP de Supabase NO tiene permiso: todo SQL va por Management API con el token personal que el usuario da en el chat, exportado como `SUPABASE_ACCESS_TOKEN`. **Nunca guardar el token en archivos.**
- Edge functions: desplegar SIEMPRE con `--no-verify-jwt` (`npx supabase functions deploy <fn> --project-ref ytqcwrjxlnlsjgnjxiiw --no-verify-jwt --use-api`).
- Hosting: NO publicar sin orden explícita del usuario.
- Verificación en vivo: Chrome headless en este equipo; no usar la extensión de Chrome ni otro dispositivo.
- Si se cambia un template con `sed -i`, reiniciar `ng serve` (el watcher no lo detecta).
- Copy en español de Colombia, sin nombrar marcas o equipos ajenos.
- Convención de migraciones: `NNN_snake_case.sql`, `begin; … commit;`, funciones con `set search_path = public`, `revoke all … from public`, grants explícitos, políticas admin con `is_admin()`.
- Reserva: **15 minutos**. Recargar la página NO libera la reserva.
- Máximo **3** opciones por producto.
- Pruebas unitarias: `npx ng test --watch=false --include='<ruta del spec>'`. Los specs de código de `supabase/functions/_shared` viven en `src/` (el builder sólo descubre specs dentro de `src/`), como `bold-shared.spec.ts`.
- Commits: sólo los archivos de la tarea (`git add <rutas>`); la rama tiene cambios ajenos sin commitear que NO se tocan. Terminar cada mensaje con `Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>`.

## Review Focus

1. **Producto que pasa de simple a con variantes (o al revés) con ventas previas** — el stock del producto debe quedar igual a la suma de variantes activas (o a 0 si se apagan todas), sin perder historial. Test en Task 2 (`guardar_variantes` apaga todo → stock 0, variantes inactivas, opciones borradas).
2. **Carrito viejo (`cuaquiverso.cart.v1`) de un producto que ahora tiene variantes** — la línea sin variante debe ser rechazada por `crear-pedido` con un mensaje que diga qué hacer, no un 500. Test en Task 6 (mensaje 400 legible) y en Task 10 (migración v1→v2 conserva líneas).
3. **Cliente que cancela la reserva y luego paga igual en el modal de Bold todavía abierto** — el pago debe registrarse (pedido pasa a aprobado, stock se descuenta, `sobreventa` si ya no había). Test SQL en Task 4 y lógica en Task 7.
4. **Dos compradores por la última unidad de una variante** — sólo uno obtiene la reserva. Test SQL de concurrencia simulada en Task 4 (segunda reserva falla con `P0409`).
5. **Valores de opción con tildes, espacios o mayúsculas distintas ("Rosa " vs "rosa")** — el admin normaliza (trim, sin duplicados case-insensitive) antes de generar combinaciones. Test en Task 5 (`normalizarOpciones`).

---

## Mapa de archivos

**Crear**
- `scripts/supabase-sql.mjs` — ejecuta SQL contra la Management API (con modo prueba: envuelve en `begin … rollback`).
- `supabase/migrations/026_variantes.sql` — tablas de variantes, trigger de suma, columnas, RLS, funciones de stock con variante, `guardar_variantes`.
- `supabase/migrations/027_reservas_stock.sql` — reservas, `reservar_stock_pedido`, `liberar_reservas_pedido`, `stock_disponible`, `cancelar_pedido_pendiente`, `registrar_venta_web` y `obtener_pedido` finales.
- `supabase/tests/026_variantes.test.sql`, `supabase/tests/027_reservas.test.sql` — pruebas SQL con `assert`.
- `supabase/functions/_shared/variantes.ts` — lógica pura de variantes.
- `src/app/core/utils/variantes-shared.spec.ts` — pruebas de la lógica pura.
- `src/app/pages/cuaquiverso/services/pedido-pendiente.ts` + `.spec.ts` — persistencia del pedido pendiente (reserva) en `localStorage`.
- `src/app/pages/admin/productos/variantes-editor/variantes-editor.component.{ts,html,scss}` — editor de opciones y combinaciones.
- `src/app/pages/admin/productos/variantes-editor/filas.ts` + `filas.spec.ts` — reconciliación de filas del editor.

**Modificar**
- `supabase/functions/crear-pedido/index.ts`, `verificar-pago/index.ts`, `bold-webhook/index.ts`, `notify-pedido/index.ts`
- `src/app/core/services/inventario.service.ts`
- `src/app/pages/cuaquiverso/services/cart.service.ts` (+ nuevo `cart.service.spec.ts`), `cart-modal/cart-modal.component.html`
- `src/app/pages/cuaquiverso/services/checkout.service.ts`, `checkout/checkout.component.{ts,html}`, `checkout/confirmacion/confirmacion.component.{ts,html}`
- `src/app/pages/cuaquiverso/tienda/producto/producto-detail.component.{ts,html,scss}`
- `src/app/pages/cuaquiverso/tienda/tienda.component.{ts,html}`, `cuaquiverso.component.ts`, `personaje/personaje-page.component.ts`
- `src/app/pages/admin/productos/producto-form.component.{ts,html}`, `productos-list.component.{ts,html}`, `ventas-general.component.{ts,html}`
- `pos/index.html`

---

### Task 1: Leer el esquema real y crear el ejecutor SQL

Varias columnas (`productos_evento.personaje/cover_url/fotos/material/color/flag/descripcion`, `ventas_evento.canal/evento_id`, tablas `eventos`, `admin_users`) se crearon desde el dashboard. Las migraciones siguientes deben escribirse contra lo que existe.

**Files:**
- Create: `scripts/supabase-sql.mjs`

**Interfaces:**
- Produces: `node scripts/supabase-sql.mjs <archivo.sql> [--test <migración.sql>] [--read]` — imprime el JSON de resultado. `--test` concatena `begin;` + migración (sin sus propias líneas `begin;`/`commit;`) + archivo de prueba + `rollback;`. `--read` usa el endpoint `/database/query/read-only`.

- [ ] **Step 1: Pedir el token al usuario**

Si `SUPABASE_ACCESS_TOKEN` no está en el entorno, pedir al usuario un personal access token de Supabase (https://supabase.com/dashboard/account/tokens) y usarlo sólo como variable de entorno en cada comando. No escribirlo en ningún archivo.

- [ ] **Step 2: Crear el ejecutor**

```js
// scripts/supabase-sql.mjs
//
// Ejecuta SQL contra la Management API de Supabase. El MCP no tiene permiso
// sobre este proyecto, así que migraciones y pruebas SQL pasan por aquí.
//
//   node scripts/supabase-sql.mjs archivo.sql                 → ejecuta
//   node scripts/supabase-sql.mjs archivo.sql --read          → sólo lectura
//   node scripts/supabase-sql.mjs prueba.sql --test mig.sql   → begin; mig; prueba; rollback;
//
// El token va en SUPABASE_ACCESS_TOKEN y nunca en un archivo.
import { readFileSync } from 'node:fs';

const REF = 'ytqcwrjxlnlsjgnjxiiw';
const token = process.env.SUPABASE_ACCESS_TOKEN;
if (!token) { console.error('Falta SUPABASE_ACCESS_TOKEN'); process.exit(2); }

const args = process.argv.slice(2);
const archivo = args[0];
const soloLectura = args.includes('--read');
const iTest = args.indexOf('--test');

const sinTransaccion = sql => sql.replace(/^\s*(begin|commit)\s*;\s*$/gim, '');

let query = readFileSync(archivo, 'utf8');
if (iTest >= 0) {
  const migraciones = args.slice(iTest + 1).filter(a => !a.startsWith('--'));
  query = 'begin;\n'
    + migraciones.map(m => sinTransaccion(readFileSync(m, 'utf8'))).join('\n')
    + '\n' + sinTransaccion(query)
    + '\nrollback;\n';
}

const url = `https://api.supabase.com/v1/projects/${REF}/database/query${soloLectura ? '/read-only' : ''}`;
const res = await fetch(url, {
  method: 'POST',
  headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ query }),
});
const texto = await res.text();
console.log(texto);
if (!res.ok) process.exit(1);
```

- [ ] **Step 3: Leer el esquema de las tablas que se tocan**

Crear `C:\Users\Usuario\.claude\jobs\28c0e431\tmp\esquema.sql` (fuera del repo):

```sql
select table_name, column_name, data_type, is_nullable, column_default
from information_schema.columns
where table_schema = 'public'
  and table_name in ('productos_evento','ventas_evento','pedidos','pedido_items',
                     'producto_movimientos','admin_users','eventos')
order by table_name, ordinal_position;
```

Run: `node scripts/supabase-sql.mjs "$CLAUDE_JOB_DIR/tmp/esquema.sql" --read`
Expected: JSON con columnas. Anotar: (a) columnas NOT NULL sin default de `productos_evento` y `pedidos` (las pruebas SQL deben rellenarlas); (b) nombre de la columna de usuario en `admin_users` (las pruebas asumen `user_id`; si es otro, reemplazarlo en los `.test.sql` de Tasks 2 y 4).

- [ ] **Step 4: Leer funciones y políticas vigentes**

```sql
select p.proname, pg_get_function_identity_arguments(p.oid) as args
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in ('decrementar_stock_seguro','registrar_restock','registrar_ajuste',
                    'registrar_venta_web','obtener_pedido','is_admin','is_pos_operator');
select tablename, policyname, cmd, roles, qual, with_check
from pg_policies where schemaname = 'public'
  and tablename in ('productos_evento','ventas_evento','producto_movimientos','pedidos','pedido_items');
select pg_get_functiondef('public.is_admin'::regproc);
```

Run igual que el Step 3. Confirmar que existen `decrementar_stock_seguro(uuid, integer)`, `registrar_restock(uuid, integer, text)`, `registrar_ajuste(uuid, integer, text)` con esas firmas exactas (Task 2 las elimina por firma). Si alguna firma difiere, ajustar los `drop function` de Task 2.

- [ ] **Step 5: Commit**

```bash
git add scripts/supabase-sql.mjs
git commit -m "chore: ejecutor SQL por Management API para migraciones y pruebas"
```

---

### Task 2: Migración 026 — variantes

**Files:**
- Create: `supabase/migrations/026_variantes.sql`
- Test: `supabase/tests/026_variantes.test.sql`

**Interfaces:**
- Produces (SQL):
  - Tablas `producto_opciones(id, producto_id, nombre, posicion, valores jsonb)` y `producto_variantes(id, producto_id, opciones jsonb, precio int null, stock_actual int, activo bool, posicion int, creado_en)`.
  - Columnas `pedido_items.variante_id uuid`, `pedido_items.variante_label text`, `ventas_evento.variante_id uuid`, `producto_movimientos.variante_id uuid`.
  - `decrementar_stock_seguro(p_producto_id uuid, p_cantidad integer, p_variante_id uuid default null) returns void`
  - `registrar_restock(p_producto_id uuid, p_cantidad integer, p_nota text default null, p_variante_id uuid default null) returns void`
  - `registrar_ajuste(p_producto_id uuid, p_nuevo_stock integer, p_nota text default null, p_variante_id uuid default null) returns void`
  - `guardar_variantes(p_producto_id uuid, p_opciones jsonb, p_variantes jsonb) returns jsonb` → `{"creadas":n,"actualizadas":n,"desactivadas":n}`. `p_opciones` = `[{"nombre":"Talla","valores":[{"valor":"M","foto_url":null}]}]`; `p_variantes` = `[{"opciones":{"Talla":"M"},"precio":null,"stock_inicial":5,"activo":true}]`.

- [ ] **Step 1: Escribir la prueba SQL (falla porque nada existe)**

```sql
-- supabase/tests/026_variantes.test.sql
-- Se ejecuta con: node scripts/supabase-sql.mjs supabase/tests/026_variantes.test.sql --test supabase/migrations/026_variantes.sql
-- Todo corre dentro de begin … rollback: no deja datos.

-- Actuar como admin: auth.uid() lee request.jwt.claims.
select set_config('request.jwt.claims',
  json_build_object('sub', (select user_id from public.admin_users limit 1), 'role', 'authenticated')::text, true);

do $$
declare
  v_p uuid;
  v_m uuid;
  v_r jsonb;
  v_stock int;
begin
  insert into public.productos_evento (nombre, categoria, precio, stock_inicial, stock_actual, activo, evento_id)
  values ('TEST camiseta', 'tee', 50000, 0, 0, true, 'Venta-regular')
  returning id into v_p;

  -- Crear 2 tallas × 2 colores
  v_r := public.guardar_variantes(v_p,
    '[{"nombre":"Talla","valores":[{"valor":"S","foto_url":null},{"valor":"M","foto_url":null}]},
      {"nombre":"Color","valores":[{"valor":"Negro","foto_url":null},{"valor":"Rosa","foto_url":"https://x/rosa.jpg"}]}]',
    '[{"opciones":{"Talla":"S","Color":"Negro"},"precio":null,"stock_inicial":3,"activo":true},
      {"opciones":{"Talla":"S","Color":"Rosa"},"precio":null,"stock_inicial":0,"activo":true},
      {"opciones":{"Talla":"M","Color":"Negro"},"precio":55000,"stock_inicial":4,"activo":true},
      {"opciones":{"Talla":"M","Color":"Rosa"},"precio":null,"stock_inicial":2,"activo":false}]');
  assert (v_r->>'creadas')::int = 4, 'debe crear 4 variantes: ' || v_r;
  assert (select count(*) from public.producto_opciones where producto_id = v_p) = 2, '2 opciones';

  -- Trigger de suma: sólo activas (3 + 0 + 4) = 7
  select stock_actual into v_stock from public.productos_evento where id = v_p;
  assert v_stock = 7, 'stock total debe ser 7, es ' || v_stock;

  -- Movimientos de creación por variante con stock > 0 (3, 4, 2)
  assert (select count(*) from public.producto_movimientos
          where producto_id = v_p and tipo = 'creacion' and variante_id is not null) = 3,
    'movimientos de creación por variante';

  select id into v_m from public.producto_variantes
  where producto_id = v_p and opciones = '{"Talla":"M","Color":"Negro"}';

  -- Restock y ajuste por variante
  perform public.registrar_restock(v_p, 2, 'test', v_m);
  assert (select stock_actual from public.producto_variantes where id = v_m) = 6, 'restock variante';
  perform public.registrar_ajuste(v_p, 1, 'conteo', v_m);
  assert (select stock_actual from public.producto_variantes where id = v_m) = 1, 'ajuste variante';
  assert (select stock_actual from public.productos_evento where id = v_p) = 4, 'suma tras ajuste (3+0+1)';
  assert (select count(*) from public.producto_movimientos where variante_id = v_m and tipo = 'ajuste' and cantidad = -5) = 1,
    'ajuste registra delta -5';

  -- Ajuste a nivel producto con variantes activas se rechaza
  begin
    perform public.registrar_ajuste(v_p, 10, null, null);
    assert false, 'ajuste sin variante debió fallar';
  exception when others then
    assert sqlerrm like '%variantes%', 'mensaje de ajuste sin variante: ' || sqlerrm;
  end;

  -- Decremento por variante
  perform public.decrementar_stock_seguro(v_p, 1, v_m);
  assert (select stock_actual from public.producto_variantes where id = v_m) = 0, 'decremento variante';

  -- Variante de otro producto se rechaza
  begin
    perform public.decrementar_stock_seguro(gen_random_uuid(), 1, v_m);
    assert false, 'variante ajena debió fallar';
  exception when others then
    assert sqlerrm like '%no pertenece%', sqlerrm;
  end;

  -- Re-guardar quitando el color Rosa: conserva ids/stock de Negro, desactiva Rosa
  v_r := public.guardar_variantes(v_p,
    '[{"nombre":"Talla","valores":[{"valor":"S","foto_url":null},{"valor":"M","foto_url":null}]},
      {"nombre":"Color","valores":[{"valor":"Negro","foto_url":null}]}]',
    '[{"opciones":{"Talla":"S","Color":"Negro"},"precio":null,"stock_inicial":99,"activo":true},
      {"opciones":{"Talla":"M","Color":"Negro"},"precio":60000,"stock_inicial":99,"activo":true}]');
  assert (v_r->>'actualizadas')::int = 2 and (v_r->>'desactivadas')::int = 1, 'reguardado: ' || v_r;
  assert (select stock_actual from public.producto_variantes where producto_id = v_p and opciones = '{"Talla":"S","Color":"Negro"}') = 3,
    'stock_inicial se ignora al actualizar';
  assert (select precio from public.producto_variantes where id = v_m) = 60000, 'precio actualizado';

  -- Apagar variantes: todas inactivas, opciones borradas, stock 0
  v_r := public.guardar_variantes(v_p, '[]', '[]');
  assert (select count(*) from public.producto_variantes where producto_id = v_p and activo) = 0, 'todas inactivas';
  assert (select count(*) from public.producto_opciones where producto_id = v_p) = 0, 'opciones borradas';
  assert (select stock_actual from public.productos_evento where id = v_p) = 0, 'stock 0 sin variantes activas';

  -- Máximo 3 opciones
  begin
    perform public.guardar_variantes(v_p,
      '[{"nombre":"A","valores":[]},{"nombre":"B","valores":[]},{"nombre":"C","valores":[]},{"nombre":"D","valores":[]}]', '[]');
    assert false, 'cuarta opción debió fallar';
  exception when others then
    assert sqlerrm like '%3 opciones%', sqlerrm;
  end;

  -- Producto simple: funciones sin variante se comportan como antes
  insert into public.productos_evento (nombre, categoria, precio, stock_inicial, stock_actual, activo, evento_id)
  values ('TEST pin', 'pin', 8000, 5, 5, true, 'Venta-regular') returning id into v_p;
  perform public.decrementar_stock_seguro(v_p, 2);
  perform public.registrar_restock(v_p, 1);
  perform public.registrar_ajuste(v_p, 10);
  assert (select stock_actual from public.productos_evento where id = v_p) = 10, 'producto simple';

  raise notice 'OK 026';
end $$;
```

> Si Task 1 mostró columnas NOT NULL sin default adicionales en `productos_evento`, añadirlas a los dos `insert` con valores de prueba.

- [ ] **Step 2: Correr la prueba para verificar que falla**

Run: `node scripts/supabase-sql.mjs supabase/tests/026_variantes.test.sql --test supabase/migrations/026_variantes.sql`
Expected: FAIL (el archivo de migración aún no existe → error de lectura `ENOENT`).

- [ ] **Step 3: Escribir la migración**

```sql
-- supabase/migrations/026_variantes.sql
-- Variantes de producto: opciones libres (Talla, Color, Tamaño…) definidas por
-- el admin y una fila por combinación con su propio stock y precio opcional.
--
-- Los productos sin variantes no cambian. En los que sí tienen, el stock vive
-- en producto_variantes y un trigger mantiene productos_evento.stock_actual
-- como la suma de las activas, para que la grilla, los badges y los reportes
-- que ya leen esa columna sigan funcionando.
--
-- "Tiene variantes" = existe al menos una variante ACTIVA.

begin;

-- ── Tablas ───────────────────────────────────────────────────────────────────
create table if not exists public.producto_opciones (
  id          uuid primary key default gen_random_uuid(),
  producto_id uuid not null references public.productos_evento(id) on delete cascade,
  nombre      text not null check (length(trim(nombre)) > 0),
  posicion    integer not null default 0,
  valores     jsonb not null default '[]'::jsonb check (jsonb_typeof(valores) = 'array'),
  unique (producto_id, nombre)
);

create table if not exists public.producto_variantes (
  id           uuid primary key default gen_random_uuid(),
  producto_id  uuid not null references public.productos_evento(id) on delete cascade,
  opciones     jsonb not null check (jsonb_typeof(opciones) = 'object'),
  precio       integer null check (precio is null or precio > 0),
  stock_actual integer not null default 0 check (stock_actual >= 0),
  activo       boolean not null default true,
  posicion     integer not null default 0,
  creado_en    timestamptz not null default now(),
  unique (producto_id, opciones)
);

create index if not exists idx_producto_variantes_producto on public.producto_variantes(producto_id);

-- ── Columnas en tablas existentes ────────────────────────────────────────────
alter table public.pedido_items
  add column if not exists variante_id uuid references public.producto_variantes(id) on delete set null,
  add column if not exists variante_label text;

alter table public.ventas_evento
  add column if not exists variante_id uuid references public.producto_variantes(id) on delete set null;

alter table public.producto_movimientos
  add column if not exists variante_id uuid references public.producto_variantes(id) on delete set null;

-- ── Máximo 3 opciones por producto ───────────────────────────────────────────
create or replace function public.limitar_opciones_producto()
returns trigger language plpgsql set search_path = public as $$
begin
  if (select count(*) from public.producto_opciones where producto_id = new.producto_id) >= 3 then
    raise exception 'Un producto admite máximo 3 opciones';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_limitar_opciones on public.producto_opciones;
create trigger trg_limitar_opciones
  before insert on public.producto_opciones
  for each row execute function public.limitar_opciones_producto();

-- ── Stock del producto = suma de variantes activas ───────────────────────────
-- SECURITY DEFINER: lo dispara también el operador de POS vía
-- decrementar_stock_seguro, que no tiene UPDATE directo sobre productos_evento.
create or replace function public.sincronizar_stock_producto()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_pid uuid := coalesce(new.producto_id, old.producto_id);
begin
  update public.productos_evento
     set stock_actual = coalesce((
           select sum(stock_actual) from public.producto_variantes
           where producto_id = v_pid and activo), 0)
   where id = v_pid;
  return null;
end;
$$;

drop trigger if exists trg_variantes_stock on public.producto_variantes;
create trigger trg_variantes_stock
  after insert or delete or update of stock_actual, activo on public.producto_variantes
  for each row execute function public.sincronizar_stock_producto();

-- Movimiento de creación por variante (el de productos_evento registra
-- stock_inicial del producto, que en productos con variantes es 0).
create or replace function public.registrar_creacion_variante()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.stock_actual > 0 then
    insert into public.producto_movimientos (producto_id, variante_id, tipo, cantidad)
    values (new.producto_id, new.id, 'creacion', new.stock_actual);
  end if;
  return new;
end;
$$;

drop trigger if exists trg_variante_creada on public.producto_variantes;
create trigger trg_variante_creada
  after insert on public.producto_variantes
  for each row execute function public.registrar_creacion_variante();

-- ── RLS ──────────────────────────────────────────────────────────────────────
alter table public.producto_opciones  enable row level security;
alter table public.producto_variantes enable row level security;

drop policy if exists producto_opciones_public_read on public.producto_opciones;
create policy producto_opciones_public_read on public.producto_opciones
  for select using (exists (
    select 1 from public.productos_evento p where p.id = producto_id and p.activo));

drop policy if exists producto_opciones_admin_all on public.producto_opciones;
create policy producto_opciones_admin_all on public.producto_opciones
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists producto_variantes_public_read on public.producto_variantes;
create policy producto_variantes_public_read on public.producto_variantes
  for select using (activo and exists (
    select 1 from public.productos_evento p where p.id = producto_id and p.activo));

drop policy if exists producto_variantes_pos_read on public.producto_variantes;
create policy producto_variantes_pos_read on public.producto_variantes
  for select to authenticated using (public.is_pos_operator());

drop policy if exists producto_variantes_admin_all on public.producto_variantes;
create policy producto_variantes_admin_all on public.producto_variantes
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- El POS escucha cambios de stock en vivo.
alter publication supabase_realtime add table public.producto_variantes;

-- ── Funciones de stock con variante opcional ─────────────────────────────────
-- Se eliminan por firma: con el parámetro nuevo con default, dejar la versión
-- vieja haría ambigua cualquier llamada con los argumentos de siempre.
drop function if exists public.decrementar_stock_seguro(uuid, integer);
drop function if exists public.registrar_restock(uuid, integer, text);
drop function if exists public.registrar_ajuste(uuid, integer, text);

create or replace function public.tiene_variantes(p_producto_id uuid)
returns boolean language sql stable set search_path = public as $$
  select exists (select 1 from public.producto_variantes where producto_id = p_producto_id and activo);
$$;

-- Valida que la variante sea de ese producto; devuelve su id o lanza.
create or replace function public.variante_de_producto(p_producto_id uuid, p_variante_id uuid)
returns uuid language plpgsql stable set search_path = public as $$
begin
  if not exists (select 1 from public.producto_variantes
                 where id = p_variante_id and producto_id = p_producto_id) then
    raise exception 'La variante no pertenece al producto';
  end if;
  return p_variante_id;
end;
$$;

create or replace function public.decrementar_stock_seguro(
  p_producto_id uuid,
  p_cantidad    integer,
  p_variante_id uuid default null
) returns void language plpgsql security definer set search_path = public as $$
begin
  if not (public.is_admin() or public.is_pos_operator()) then
    raise exception 'No autorizado';
  end if;
  if p_cantidad is null or p_cantidad <= 0 then
    raise exception 'La cantidad debe ser mayor a 0';
  end if;

  if p_variante_id is not null then
    perform public.variante_de_producto(p_producto_id, p_variante_id);
    update public.producto_variantes
       set stock_actual = greatest(0, stock_actual - p_cantidad)
     where id = p_variante_id;
  else
    -- Sin variante se comporta como siempre (ventas de la cola offline de un
    -- POS anterior incluidas).
    update public.productos_evento
       set stock_actual = greatest(0, stock_actual - p_cantidad)
     where id = p_producto_id;
  end if;
end;
$$;

create or replace function public.registrar_restock(
  p_producto_id uuid,
  p_cantidad    integer,
  p_nota        text default null,
  p_variante_id uuid default null
) returns void language plpgsql security invoker set search_path = public as $$
begin
  if p_cantidad is null or p_cantidad <= 0 then
    raise exception 'La cantidad debe ser mayor a 0';
  end if;

  if p_variante_id is not null then
    perform public.variante_de_producto(p_producto_id, p_variante_id);
    update public.producto_variantes set stock_actual = stock_actual + p_cantidad where id = p_variante_id;
  else
    if public.tiene_variantes(p_producto_id) then
      raise exception 'Este producto tiene variantes: reabastece cada combinación';
    end if;
    update public.productos_evento set stock_actual = stock_actual + p_cantidad where id = p_producto_id;
  end if;

  insert into public.producto_movimientos (producto_id, variante_id, tipo, cantidad, nota)
  values (p_producto_id, p_variante_id, 'restock', p_cantidad, p_nota);
end;
$$;

create or replace function public.registrar_ajuste(
  p_producto_id uuid,
  p_nuevo_stock integer,
  p_nota        text default null,
  p_variante_id uuid default null
) returns void language plpgsql security invoker set search_path = public as $$
declare
  v_actual integer;
  v_delta  integer;
begin
  if p_nuevo_stock is null or p_nuevo_stock < 0 then
    raise exception 'El stock no puede ser negativo';
  end if;

  if p_variante_id is not null then
    perform public.variante_de_producto(p_producto_id, p_variante_id);
    select stock_actual into v_actual from public.producto_variantes where id = p_variante_id for update;
  else
    if public.tiene_variantes(p_producto_id) then
      raise exception 'Este producto tiene variantes: ajusta cada combinación';
    end if;
    select stock_actual into v_actual from public.productos_evento where id = p_producto_id for update;
    if not found then raise exception 'Producto no encontrado'; end if;
  end if;

  v_delta := p_nuevo_stock - v_actual;
  if v_delta = 0 then return; end if;

  if p_variante_id is not null then
    update public.producto_variantes set stock_actual = p_nuevo_stock where id = p_variante_id;
  else
    update public.productos_evento set stock_actual = p_nuevo_stock where id = p_producto_id;
  end if;

  insert into public.producto_movimientos (producto_id, variante_id, tipo, cantidad, nota)
  values (p_producto_id, p_variante_id, 'ajuste', v_delta, p_nota);
end;
$$;

-- ── Guardar opciones y combinaciones desde el admin ──────────────────────────
-- Una combinación se identifica por su JSON de opciones (jsonb compara sin
-- importar el orden de las claves). Las que siguen existiendo conservan id,
-- stock e historial; las que desaparecen se desactivan (nunca se borran: puede
-- haber pedidos que las referencian); las nuevas nacen con stock_inicial.
create or replace function public.guardar_variantes(
  p_producto_id uuid,
  p_opciones    jsonb,
  p_variantes   jsonb
) returns jsonb language plpgsql security invoker set search_path = public as $$
declare
  v_x        jsonb;
  v_ord      bigint;
  v_creadas  integer := 0;
  v_act      integer := 0;
  v_desact   integer := 0;
begin
  if not public.is_admin() then raise exception 'No autorizado'; end if;
  if jsonb_typeof(p_opciones) <> 'array' or jsonb_typeof(p_variantes) <> 'array' then
    raise exception 'Formato inválido';
  end if;

  delete from public.producto_opciones where producto_id = p_producto_id;
  insert into public.producto_opciones (producto_id, nombre, posicion, valores)
  select p_producto_id, trim(o->>'nombre'), (ord - 1)::int, coalesce(o->'valores', '[]'::jsonb)
  from jsonb_array_elements(p_opciones) with ordinality as t(o, ord);

  update public.producto_variantes v
     set activo = false
   where v.producto_id = p_producto_id
     and v.activo
     and not exists (select 1 from jsonb_array_elements(p_variantes) x where x->'opciones' = v.opciones);
  get diagnostics v_desact = row_count;

  for v_x, v_ord in select x, ord from jsonb_array_elements(p_variantes) with ordinality as t(x, ord) loop
    update public.producto_variantes
       set precio   = nullif(v_x->>'precio', '')::integer,
           activo   = coalesce((v_x->>'activo')::boolean, true),
           posicion = (v_ord - 1)::int
     where producto_id = p_producto_id and opciones = v_x->'opciones';
    if found then
      v_act := v_act + 1;
    else
      insert into public.producto_variantes (producto_id, opciones, precio, stock_actual, activo, posicion)
      values (p_producto_id, v_x->'opciones', nullif(v_x->>'precio', '')::integer,
              greatest(0, coalesce((v_x->>'stock_inicial')::integer, 0)),
              coalesce((v_x->>'activo')::boolean, true), (v_ord - 1)::int);
      v_creadas := v_creadas + 1;
    end if;
  end loop;

  return jsonb_build_object('creadas', v_creadas, 'actualizadas', v_act, 'desactivadas', v_desact);
end;
$$;

-- ── Permisos ─────────────────────────────────────────────────────────────────
revoke all on function public.decrementar_stock_seguro(uuid, integer, uuid) from public;
grant execute on function public.decrementar_stock_seguro(uuid, integer, uuid) to authenticated, service_role;

revoke all on function public.registrar_restock(uuid, integer, text, uuid) from public;
revoke execute on function public.registrar_restock(uuid, integer, text, uuid) from anon;
grant execute on function public.registrar_restock(uuid, integer, text, uuid) to authenticated, service_role;

revoke all on function public.registrar_ajuste(uuid, integer, text, uuid) from public;
revoke execute on function public.registrar_ajuste(uuid, integer, text, uuid) from anon;
grant execute on function public.registrar_ajuste(uuid, integer, text, uuid) to authenticated, service_role;

revoke all on function public.guardar_variantes(uuid, jsonb, jsonb) from public;
revoke execute on function public.guardar_variantes(uuid, jsonb, jsonb) from anon;
grant execute on function public.guardar_variantes(uuid, jsonb, jsonb) to authenticated;

revoke all on function public.tiene_variantes(uuid) from public;
revoke all on function public.variante_de_producto(uuid, uuid) from public;
grant execute on function public.tiene_variantes(uuid) to authenticated, service_role;
grant execute on function public.variante_de_producto(uuid, uuid) to authenticated, service_role;

revoke all on function public.sincronizar_stock_producto() from public;
revoke all on function public.registrar_creacion_variante() from public;
revoke all on function public.limitar_opciones_producto() from public;

commit;
```

- [ ] **Step 4: Correr la prueba**

Run: `node scripts/supabase-sql.mjs supabase/tests/026_variantes.test.sql --test supabase/migrations/026_variantes.sql`
Expected: respuesta 200 (`[]`) sin error. Cualquier `assert` fallido devuelve 400 con el mensaje: corregir y repetir.

> `alter publication … add table` dentro de la transacción de prueba se revierte con el rollback; es normal.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/026_variantes.sql supabase/tests/026_variantes.test.sql
git commit -m "feat(db): variantes de producto con stock por combinación"
```

---

### Task 3: Migración 027 — reservas de stock (escritura)

**Files:**
- Create: `supabase/migrations/027_reservas_stock.sql`

**Interfaces:**
- Consumes: todo lo de Task 2.
- Produces (SQL):
  - Tabla `stock_reservas(id, pedido_id, producto_id, variante_id, cantidad, expira_en, creado_en)`.
  - Columnas `pedidos.reserva_expira_en timestamptz`, `pedidos.sobreventa boolean`, `pedidos.cancelado_por_cliente boolean`.
  - `reservar_stock_pedido(p_pedido_id uuid, p_minutos integer default 15) returns timestamptz` — lanza `errcode 'P0409'`, `message 'sin_stock'`, `detail` = JSON `{"producto_id","variante_id","disponible"}` si no alcanza.
  - `liberar_reservas_pedido(p_referencia text) returns integer`
  - `stock_disponible(p_producto_ids uuid[] default null) returns table(producto_id uuid, variante_id uuid, disponible integer)` — anon. Una fila por producto con `variante_id null` (total disponible) + una por variante activa.
  - `cancelar_pedido_pendiente(p_token text) returns boolean` — anon.
  - `registrar_venta_web(p_referencia text) returns integer` — descuenta por variante, libera reservas, marca `sobreventa`.
  - `obtener_pedido(p_token text) returns jsonb` — añade `reserva_expira_en`, `cancelado_por_cliente` y por ítem `variante_label`, `producto_id`, `variante_id`.

- [ ] **Step 1: Escribir la migración**

```sql
-- supabase/migrations/027_reservas_stock.sql
-- Reserva de stock mientras el cliente paga (15 minutos).
--
-- stock_actual sigue siendo el stock FÍSICO. Lo que la tienda puede vender es
-- físico − reservas vigentes. Una reserva está vigente si no ha vencido y su
-- pedido sigue 'pendiente': las vencidas simplemente dejan de contar, así que
-- no hace falta un cron para liberarlas a tiempo (se borran de paso).
--
-- Toda reserva bloquea con FOR UPDATE las filas de productos_evento del pedido
-- (en orden de id). Como el trigger de variantes también actualiza esa fila,
-- la fila del producto hace de mutex para reservas y ventas web del producto.

begin;

create table if not exists public.stock_reservas (
  id          uuid primary key default gen_random_uuid(),
  pedido_id   uuid not null references public.pedidos(id) on delete cascade,
  producto_id uuid not null references public.productos_evento(id) on delete cascade,
  variante_id uuid null references public.producto_variantes(id) on delete cascade,
  cantidad    integer not null check (cantidad > 0),
  expira_en   timestamptz not null,
  creado_en   timestamptz not null default now()
);

create index if not exists idx_stock_reservas_item on public.stock_reservas(producto_id, variante_id);
create index if not exists idx_stock_reservas_expira on public.stock_reservas(expira_en);
create index if not exists idx_stock_reservas_pedido on public.stock_reservas(pedido_id);

alter table public.stock_reservas enable row level security;
drop policy if exists stock_reservas_admin_read on public.stock_reservas;
create policy stock_reservas_admin_read on public.stock_reservas
  for select to authenticated using (public.is_admin());

alter table public.pedidos
  add column if not exists reserva_expira_en     timestamptz,
  add column if not exists sobreventa            boolean not null default false,
  add column if not exists cancelado_por_cliente boolean not null default false;

-- ── Reservas vigentes agregadas ──────────────────────────────────────────────
create or replace function public.reservas_vigentes()
returns table (producto_id uuid, variante_id uuid, cantidad integer)
language sql stable security definer set search_path = public as $$
  select r.producto_id, r.variante_id, sum(r.cantidad)::integer
  from public.stock_reservas r
  join public.pedidos pe on pe.id = r.pedido_id
  where r.expira_en > now() and pe.estado = 'pendiente'
  group by r.producto_id, r.variante_id;
$$;

-- ── Reservar el stock de un pedido recién creado ─────────────────────────────
create or replace function public.reservar_stock_pedido(
  p_pedido_id uuid,
  p_minutos   integer default 15
) returns timestamptz language plpgsql security definer set search_path = public as $$
declare
  v_expira timestamptz := now() + make_interval(mins => p_minutos);
  v_item   record;
  v_fisico integer;
  v_resv   integer;
begin
  -- Limpieza oportunista: nadie depende de estas filas.
  delete from public.stock_reservas r
   using public.pedidos pe
   where pe.id = r.pedido_id and (r.expira_en <= now() or pe.estado <> 'pendiente');

  -- Mutex por producto, en orden estable para no provocar deadlocks.
  perform 1 from public.productos_evento
   where id in (select producto_id from public.pedido_items where pedido_id = p_pedido_id)
   order by id for update;

  for v_item in
    select pi.producto_id, pi.variante_id, sum(pi.cantidad)::integer as cantidad
    from public.pedido_items pi
    where pi.pedido_id = p_pedido_id and pi.producto_id is not null
    group by pi.producto_id, pi.variante_id
    order by pi.producto_id, pi.variante_id
  loop
    if v_item.variante_id is not null then
      select stock_actual into v_fisico from public.producto_variantes where id = v_item.variante_id;
      select coalesce(sum(cantidad), 0) into v_resv from public.reservas_vigentes() rv
       where rv.variante_id = v_item.variante_id;
    else
      select stock_actual into v_fisico from public.productos_evento where id = v_item.producto_id;
      select coalesce(sum(cantidad), 0) into v_resv from public.reservas_vigentes() rv
       where rv.producto_id = v_item.producto_id and rv.variante_id is null;
    end if;

    if coalesce(v_fisico, 0) - v_resv < v_item.cantidad then
      raise exception using
        errcode = 'P0409',
        message = 'sin_stock',
        detail  = json_build_object(
          'producto_id', v_item.producto_id,
          'variante_id', v_item.variante_id,
          'disponible',  greatest(0, coalesce(v_fisico, 0) - v_resv))::text;
    end if;

    insert into public.stock_reservas (pedido_id, producto_id, variante_id, cantidad, expira_en)
    values (p_pedido_id, v_item.producto_id, v_item.variante_id, v_item.cantidad, v_expira);
  end loop;

  update public.pedidos set reserva_expira_en = v_expira where id = p_pedido_id;
  return v_expira;
end;
$$;

create or replace function public.liberar_reservas_pedido(p_referencia text)
returns integer language plpgsql security definer set search_path = public as $$
declare v_n integer;
begin
  delete from public.stock_reservas r
   using public.pedidos pe
   where pe.id = r.pedido_id and pe.referencia = p_referencia;
  get diagnostics v_n = row_count;
  return v_n;
end;
$$;

-- ── Lo que la tienda puede vender ────────────────────────────────────────────
create or replace function public.stock_disponible(p_producto_ids uuid[] default null)
returns table (producto_id uuid, variante_id uuid, disponible integer)
language sql stable security definer set search_path = public as $$
  with res as (select * from public.reservas_vigentes()),
  prods as (
    select p.id, p.stock_actual from public.productos_evento p
    where p.activo and (p_producto_ids is null or p.id = any(p_producto_ids))
  ),
  vars as (
    select v.producto_id, v.id as variante_id,
           greatest(0, v.stock_actual - coalesce(r.cantidad, 0))::integer as disponible
    from public.producto_variantes v
    join prods on prods.id = v.producto_id
    left join res r on r.variante_id = v.id
    where v.activo
  )
  select p.id, null::uuid,
         case when exists (select 1 from vars where vars.producto_id = p.id)
              then (select sum(disponible) from vars where vars.producto_id = p.id)::integer
              else greatest(0, p.stock_actual - coalesce((
                     select r.cantidad from res r where r.producto_id = p.id and r.variante_id is null), 0))::integer
         end
  from prods p
  union all
  select producto_id, variante_id, disponible from vars;
$$;

-- ── "Cancelar y liberar" desde la página ─────────────────────────────────────
create or replace function public.cancelar_pedido_pendiente(p_token text)
returns boolean language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  update public.pedidos
     set estado = 'cancelado', cancelado_por_cliente = true
   where confirmacion_token::text = p_token and estado = 'pendiente'
  returning id into v_id;
  if v_id is null then return false; end if;
  delete from public.stock_reservas where pedido_id = v_id;
  return true;
end;
$$;

-- ── Descuento al aprobarse el pago (reemplaza la versión de 020) ─────────────
create or replace function public.registrar_venta_web(p_referencia text)
returns integer language plpgsql security definer set search_path = public as $$
declare
  v_pedido     public.pedidos%rowtype;
  v_item       record;
  v_fisico     integer;
  v_lineas     integer := 0;
  v_sobreventa boolean := false;
begin
  select * into v_pedido from public.pedidos where referencia = p_referencia for update;
  if not found then return 0; end if;
  if v_pedido.estado <> 'aprobado' or v_pedido.stock_descontado then return 0; end if;

  perform 1 from public.productos_evento
   where id in (select producto_id from public.pedido_items where pedido_id = v_pedido.id)
   order by id for update;

  for v_item in
    select pi.producto_id, pi.variante_id, sum(pi.cantidad)::integer as cantidad
    from public.pedido_items pi
    where pi.pedido_id = v_pedido.id and pi.producto_id is not null
    group by pi.producto_id, pi.variante_id
    order by pi.producto_id, pi.variante_id
  loop
    -- El stock físico incluye la unidad reservada por este pedido; si no
    -- alcanza es porque otro canal la vendió (POS o reserva vencida).
    if v_item.variante_id is not null then
      select stock_actual into v_fisico from public.producto_variantes where id = v_item.variante_id;
      update public.producto_variantes
         set stock_actual = greatest(0, stock_actual - v_item.cantidad)
       where id = v_item.variante_id;
    else
      select stock_actual into v_fisico from public.productos_evento where id = v_item.producto_id;
      update public.productos_evento
         set stock_actual = greatest(0, stock_actual - v_item.cantidad)
       where id = v_item.producto_id;
    end if;
    if coalesce(v_fisico, 0) < v_item.cantidad then v_sobreventa := true; end if;

    insert into public.ventas_evento (producto_id, variante_id, cantidad, canal, evento_id, dispositivo)
    select v_item.producto_id, v_item.variante_id, v_item.cantidad, 'web',
           coalesce(pe.evento_id, 'Venta-regular'), 'web:' || v_pedido.referencia
    from public.productos_evento pe where pe.id = v_item.producto_id;

    v_lineas := v_lineas + 1;
  end loop;

  delete from public.stock_reservas where pedido_id = v_pedido.id;

  update public.pedidos
     set stock_descontado = true, sobreventa = v_sobreventa
   where id = v_pedido.id;

  return v_lineas;
end;
$$;

-- ── Confirmación: etiqueta de variante y contador de la reserva ──────────────
create or replace function public.obtener_pedido(p_token text)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'id', p.id, 'referencia', p.referencia, 'estado', p.estado,
    'nombre', p.nombre, 'apellido', p.apellido, 'email', p.email,
    'ciudad', p.ciudad, 'direccion', p.direccion, 'barrio', p.barrio,
    'subtotal', p.subtotal, 'total', p.total, 'creado_en', p.creado_en,
    'envio_gratis', p.envio_gratis,
    'reserva_expira_en', p.reserva_expira_en,
    'cancelado_por_cliente', p.cancelado_por_cliente,
    'pedido_items', coalesce((
      select jsonb_agg(jsonb_build_object(
               'producto_id', i.producto_id, 'variante_id', i.variante_id,
               'nombre', i.nombre, 'sub', i.sub, 'precio', i.precio,
               'cantidad', i.cantidad, 'color', i.color,
               'variante_label', i.variante_label) order by i.creado_en)
      from public.pedido_items i where i.pedido_id = p.id
    ), '[]'::jsonb)
  )
  from public.pedidos p
  where p.confirmacion_token::text = p_token;
$$;

-- ── Permisos ─────────────────────────────────────────────────────────────────
revoke all on function public.reservas_vigentes() from public;
revoke all on function public.reservar_stock_pedido(uuid, integer) from public;
revoke all on function public.liberar_reservas_pedido(text) from public;
revoke all on function public.stock_disponible(uuid[]) from public;
revoke all on function public.cancelar_pedido_pendiente(text) from public;
revoke all on function public.registrar_venta_web(text) from public;
revoke all on function public.obtener_pedido(text) from public;

grant execute on function public.reservas_vigentes() to service_role;
grant execute on function public.reservar_stock_pedido(uuid, integer) to service_role;
grant execute on function public.liberar_reservas_pedido(text) to service_role;
grant execute on function public.registrar_venta_web(text) to service_role;
grant execute on function public.stock_disponible(uuid[]) to anon, authenticated, service_role;
grant execute on function public.cancelar_pedido_pendiente(text) to anon, authenticated;
grant execute on function public.obtener_pedido(text) to anon, authenticated;

commit;
```

- [ ] **Step 2: Commit (la prueba va en Task 4)**

```bash
git add supabase/migrations/027_reservas_stock.sql
git commit -m "feat(db): reserva de stock de 15 min durante el pago"
```

---

### Task 4: Pruebas SQL de reservas y aplicar 026 + 027

**Files:**
- Create: `supabase/tests/027_reservas.test.sql`

**Interfaces:**
- Consumes: Task 2 y 3.

- [ ] **Step 1: Escribir la prueba**

```sql
-- supabase/tests/027_reservas.test.sql
-- node scripts/supabase-sql.mjs supabase/tests/027_reservas.test.sql --test supabase/migrations/026_variantes.sql supabase/migrations/027_reservas_stock.sql

select set_config('request.jwt.claims',
  json_build_object('sub', (select user_id from public.admin_users limit 1), 'role', 'authenticated')::text, true);

create or replace function pg_temp.pedido_test(p_ref text) returns uuid language sql as $$
  insert into public.pedidos (referencia, estado, nombre, apellido, email, celular, tipo_doc, num_doc,
                              departamento, ciudad, direccion, subtotal, total)
  values (p_ref, 'pendiente', 'T', 'T', 't@t.co', '3000000000', 'CC', '1', 'X', 'X', 'X', 1, 1)
  returning id;
$$;

do $$
declare
  v_p uuid; v_simple uuid; v_var uuid;
  v_ped1 uuid; v_ped2 uuid; v_ped3 uuid;
  v_disp int; v_tok text; v_ok boolean;
begin
  insert into public.productos_evento (nombre, categoria, precio, stock_inicial, stock_actual, activo, evento_id)
  values ('TEST gorra', 'gorra', 40000, 0, 0, true, 'Venta-regular') returning id into v_p;
  perform public.guardar_variantes(v_p,
    '[{"nombre":"Color","valores":[{"valor":"Negro","foto_url":null}]}]',
    '[{"opciones":{"Color":"Negro"},"precio":null,"stock_inicial":1,"activo":true}]');
  select id into v_var from public.producto_variantes where producto_id = v_p;

  insert into public.productos_evento (nombre, categoria, precio, stock_inicial, stock_actual, activo, evento_id)
  values ('TEST sticker', 'sticker', 5000, 2, 2, true, 'Venta-regular') returning id into v_simple;

  -- Pedido 1 reserva la última gorra negra y 2 stickers
  v_ped1 := pg_temp.pedido_test('TEST-1');
  insert into public.pedido_items (pedido_id, producto_id, variante_id, variante_label, nombre, sub, precio, cantidad)
  values (v_ped1, v_p, v_var, 'Negro', 'TEST gorra', '', 40000, 1),
         (v_ped1, v_simple, null, null, 'TEST sticker', '', 5000, 2);
  perform public.reservar_stock_pedido(v_ped1);
  assert (select reserva_expira_en from public.pedidos where id = v_ped1) > now() + interval '14 minutes', 'expira ~15 min';

  select disponible into v_disp from public.stock_disponible(array[v_p]) where variante_id = v_var;
  assert v_disp = 0, 'variante reservada → 0 disponible';
  select disponible into v_disp from public.stock_disponible(array[v_p]) where variante_id is null;
  assert v_disp = 0, 'total del producto con variantes → 0';
  select disponible into v_disp from public.stock_disponible(array[v_simple]) where variante_id is null;
  assert v_disp = 0, 'simple reservado → 0';
  assert (select stock_actual from public.producto_variantes where id = v_var) = 1, 'físico intacto';

  -- Pedido 2 intenta la misma gorra: falla con P0409
  v_ped2 := pg_temp.pedido_test('TEST-2');
  insert into public.pedido_items (pedido_id, producto_id, variante_id, nombre, sub, precio, cantidad)
  values (v_ped2, v_p, v_var, 'TEST gorra', '', 40000, 1);
  begin
    perform public.reservar_stock_pedido(v_ped2);
    assert false, 'segunda reserva debió fallar';
  exception when sqlstate 'P0409' then
    assert (sqlerrm = 'sin_stock'), sqlerrm;
  end;

  -- Reserva vencida deja de contar
  update public.stock_reservas set expira_en = now() - interval '1 second' where pedido_id = v_ped1;
  select disponible into v_disp from public.stock_disponible(array[v_p]) where variante_id = v_var;
  assert v_disp = 1, 'vencida no cuenta';
  perform public.reservar_stock_pedido(v_ped2);   -- ahora sí
  assert (select count(*) from public.stock_reservas where pedido_id = v_ped1) = 0, 'limpieza oportunista';

  -- Cancelar y liberar (sólo pendientes)
  select confirmacion_token::text into v_tok from public.pedidos where id = v_ped2;
  v_ok := public.cancelar_pedido_pendiente(v_tok);
  assert v_ok, 'cancela pendiente';
  assert (select estado from public.pedidos where id = v_ped2) = 'cancelado', 'estado cancelado';
  assert (select cancelado_por_cliente from public.pedidos where id = v_ped2), 'marcado por cliente';
  assert (select count(*) from public.stock_reservas where pedido_id = v_ped2) = 0, 'liberado';
  assert not public.cancelar_pedido_pendiente(v_tok), 'segunda cancelación no hace nada';

  -- Pagó igual tras cancelar: la venta se registra y descuenta
  update public.pedidos set estado = 'aprobado' where id = v_ped2;
  assert public.registrar_venta_web('TEST-2') = 1, 'una línea';
  assert (select stock_actual from public.producto_variantes where id = v_var) = 0, 'descontado';
  assert (select stock_actual from public.productos_evento where id = v_p) = 0, 'suma 0';
  assert (select variante_id from public.ventas_evento where dispositivo = 'web:TEST-2') = v_var, 'venta con variante';
  assert not (select sobreventa from public.pedidos where id = v_ped2), 'sin sobreventa';
  assert public.registrar_venta_web('TEST-2') = 0, 'idempotente';

  -- Pedido 1 (reserva vencida) se aprueba tarde: sobreventa
  update public.pedidos set estado = 'aprobado' where id = v_ped1;
  perform public.registrar_venta_web('TEST-1');
  assert (select sobreventa from public.pedidos where id = v_ped1), 'sobreventa marcada';
  assert (select stock_actual from public.producto_variantes where id = v_var) = 0, 'nunca negativo';
  assert (select stock_actual from public.productos_evento where id = v_simple) = 0, 'stickers descontados';

  -- liberar_reservas_pedido por referencia
  v_ped3 := pg_temp.pedido_test('TEST-3');
  perform public.registrar_restock(v_simple, 3);
  insert into public.pedido_items (pedido_id, producto_id, nombre, sub, precio, cantidad)
  values (v_ped3, v_simple, 'TEST sticker', '', 5000, 1);
  perform public.reservar_stock_pedido(v_ped3);
  assert public.liberar_reservas_pedido('TEST-3') = 1, 'libera por referencia';

  -- obtener_pedido trae la etiqueta y el vencimiento
  select confirmacion_token::text into v_tok from public.pedidos where id = v_ped1;
  assert (public.obtener_pedido(v_tok)->'pedido_items'->0->>'variante_label') = 'Negro', 'label en obtener_pedido';
  assert (public.obtener_pedido(v_tok) ? 'reserva_expira_en'), 'reserva_expira_en';

  raise notice 'OK 027';
end $$;
```

- [ ] **Step 2: Correr la prueba**

Run: `node scripts/supabase-sql.mjs supabase/tests/027_reservas.test.sql --test supabase/migrations/026_variantes.sql supabase/migrations/027_reservas_stock.sql`
Expected: 200 sin error. Si falla, corregir la migración 027 (no la prueba, salvo columnas NOT NULL de `pedidos` detectadas en Task 1) y repetir. Repetir también la prueba 026 para confirmar que sigue pasando.

- [ ] **Step 3: Aplicar las migraciones en producción**

Las funciones nuevas son compatibles con el código desplegado hoy (parámetros nuevos con default; `crear-pedido` actual no reserva y sigue funcionando).

Run:
```bash
node scripts/supabase-sql.mjs supabase/migrations/026_variantes.sql
node scripts/supabase-sql.mjs supabase/migrations/027_reservas_stock.sql
```
Expected: 200 en ambas.

- [ ] **Step 4: Verificar que quedaron aplicadas**

Crear `$CLAUDE_JOB_DIR/tmp/check.sql`:
```sql
select proname, pg_get_function_identity_arguments(p.oid)
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and proname in
 ('guardar_variantes','reservar_stock_pedido','stock_disponible','cancelar_pedido_pendiente',
  'decrementar_stock_seguro','registrar_restock','registrar_ajuste','registrar_venta_web');
select count(*) from public.stock_disponible();
```
Run: `node scripts/supabase-sql.mjs "$CLAUDE_JOB_DIR/tmp/check.sql" --read`
Expected: 8 funciones, una sola firma cada una; `stock_disponible()` devuelve filas.

- [ ] **Step 5: Commit**

```bash
git add supabase/tests/027_reservas.test.sql
git commit -m "test(db): pruebas de reservas de stock y ventas por variante"
```

---

### Task 5: Lógica pura compartida de variantes

**Files:**
- Create: `supabase/functions/_shared/variantes.ts`
- Test: `src/app/core/utils/variantes-shared.spec.ts`

**Interfaces:**
- Produces:
  ```ts
  export interface ValorOpcion { valor: string; foto_url: string | null }
  export interface OpcionDef { nombre: string; valores: ValorOpcion[] }
  export type Combinacion = Record<string, string>;
  export interface VarianteBase { id: string; opciones: Combinacion; precio: number | null; activo: boolean }
  export interface VarianteConStock extends VarianteBase { disponible: number }
  export function normalizarOpciones(opciones: OpcionDef[]): OpcionDef[]
  export function generarCombinaciones(opciones: OpcionDef[]): Combinacion[]
  export function claveCombinacion(c: Combinacion, orden: string[]): string
  export function etiquetaVariante(c: Combinacion, orden: string[]): string
  export function varianteDeSeleccion<T extends VarianteBase>(variantes: T[], sel: Combinacion, orden: string[]): T | null
  export function valorDisponible(variantes: VarianteConStock[], sel: Combinacion, opcion: string, valor: string): boolean
  export function rangoPrecios(variantes: VarianteBase[], precioBase: number): { min: number; max: number } | null
  ```

- [ ] **Step 1: Escribir las pruebas**

```ts
// src/app/core/utils/variantes-shared.spec.ts
//
// Prueba `supabase/functions/_shared/variantes.ts`, que usan a la vez la
// tienda, el admin y la edge function crear-pedido (la etiqueta que queda en
// el pedido la arma el servidor con estas mismas funciones).
import {
  OpcionDef,
  VarianteConStock,
  claveCombinacion,
  etiquetaVariante,
  generarCombinaciones,
  normalizarOpciones,
  rangoPrecios,
  valorDisponible,
  varianteDeSeleccion,
} from '../../../../supabase/functions/_shared/variantes';

const v = (valor: string) => ({ valor, foto_url: null });
const TALLA: OpcionDef = { nombre: 'Talla', valores: [v('S'), v('M')] };
const COLOR: OpcionDef = { nombre: 'Color', valores: [v('Negro'), v('Rosa')] };
const ORDEN = ['Talla', 'Color'];

describe('normalizarOpciones', () => {
  it('recorta espacios y quita valores repetidos sin importar mayúsculas', () => {
    const r = normalizarOpciones([{ nombre: ' Color ', valores: [v('Rosa '), v('rosa'), v(''), v('Negro')] }]);
    expect(r).toEqual([{ nombre: 'Color', valores: [v('Rosa'), v('Negro')] }]);
  });

  it('descarta opciones sin nombre o sin valores y nombres repetidos', () => {
    const r = normalizarOpciones([
      { nombre: '', valores: [v('X')] },
      { nombre: 'Talla', valores: [] },
      { nombre: 'Color', valores: [v('Rojo')] },
      { nombre: 'color', valores: [v('Azul')] },
    ]);
    expect(r).toEqual([{ nombre: 'Color', valores: [v('Rojo')] }]);
  });

  it('conserva la foto del primer valor', () => {
    const r = normalizarOpciones([{ nombre: 'Color', valores: [{ valor: 'Rosa', foto_url: 'a.jpg' }, v('rosa')] }]);
    expect(r[0].valores[0].foto_url).toBe('a.jpg');
  });
});

describe('generarCombinaciones', () => {
  it('produce el producto cartesiano en orden', () => {
    expect(generarCombinaciones([TALLA, COLOR])).toEqual([
      { Talla: 'S', Color: 'Negro' }, { Talla: 'S', Color: 'Rosa' },
      { Talla: 'M', Color: 'Negro' }, { Talla: 'M', Color: 'Rosa' },
    ]);
  });

  it('sin opciones no hay combinaciones', () => {
    expect(generarCombinaciones([])).toEqual([]);
  });
});

describe('claveCombinacion y etiquetaVariante', () => {
  it('la clave no depende del orden de las propiedades', () => {
    expect(claveCombinacion({ Color: 'Rosa', Talla: 'M' }, ORDEN))
      .toBe(claveCombinacion({ Talla: 'M', Color: 'Rosa' }, ORDEN));
  });

  it('la etiqueta sigue el orden de las opciones', () => {
    expect(etiquetaVariante({ Color: 'Rosa', Talla: 'M' }, ORDEN)).toBe('M · Rosa');
  });
});

const VARS: VarianteConStock[] = [
  { id: 'sn', opciones: { Talla: 'S', Color: 'Negro' }, precio: null,  activo: true, disponible: 0 },
  { id: 'sr', opciones: { Talla: 'S', Color: 'Rosa'  }, precio: null,  activo: true, disponible: 2 },
  { id: 'mn', opciones: { Talla: 'M', Color: 'Negro' }, precio: 55000, activo: true, disponible: 1 },
  { id: 'mr', opciones: { Talla: 'M', Color: 'Rosa'  }, precio: null,  activo: false, disponible: 5 },
];

describe('varianteDeSeleccion', () => {
  it('encuentra la variante cuando todas las opciones están elegidas', () => {
    expect(varianteDeSeleccion(VARS, { Talla: 'M', Color: 'Negro' }, ORDEN)?.id).toBe('mn');
  });

  it('devuelve null con selección incompleta o inactiva', () => {
    expect(varianteDeSeleccion(VARS, { Talla: 'M' }, ORDEN)).toBeNull();
    expect(varianteDeSeleccion(VARS, { Talla: 'M', Color: 'Rosa' }, ORDEN)).toBeNull();
  });
});

describe('valorDisponible', () => {
  it('sin selección previa: el valor está si alguna combinación activa tiene stock', () => {
    expect(valorDisponible(VARS, {}, 'Color', 'Negro')).toBe(true);   // M·Negro
    expect(valorDisponible(VARS, {}, 'Color', 'Rosa')).toBe(true);    // S·Rosa
  });

  it('respeta lo ya elegido en otras opciones', () => {
    expect(valorDisponible(VARS, { Talla: 'S' }, 'Color', 'Negro')).toBe(false);
    expect(valorDisponible(VARS, { Talla: 'M' }, 'Color', 'Rosa')).toBe(false); // inactiva
  });

  it('ignora la selección actual de la misma opción', () => {
    expect(valorDisponible(VARS, { Talla: 'S', Color: 'Rosa' }, 'Talla', 'M')).toBe(false);
    expect(valorDisponible(VARS, { Talla: 'M', Color: 'Rosa' }, 'Talla', 'S')).toBe(true);
  });
});

describe('rangoPrecios', () => {
  it('usa el precio base cuando la variante no tiene precio', () => {
    expect(rangoPrecios(VARS, 50000)).toEqual({ min: 50000, max: 55000 });
  });

  it('null si no hay variantes activas', () => {
    expect(rangoPrecios([], 50000)).toBeNull();
  });
});
```

- [ ] **Step 2: Correr para verificar que falla**

Run: `npx ng test --watch=false --include='src/app/core/utils/variantes-shared.spec.ts'`
Expected: FAIL — no se puede resolver `_shared/variantes`.

- [ ] **Step 3: Implementar**

```ts
// supabase/functions/_shared/variantes.ts
//
// Lógica pura de variantes, compartida por la tienda, el admin y la edge
// function crear-pedido. Sin dependencias: corre igual en Deno y en vitest.

export interface ValorOpcion { valor: string; foto_url: string | null }
export interface OpcionDef { nombre: string; valores: ValorOpcion[] }
/** Una combinación: { "Talla": "M", "Color": "Negro" }. */
export type Combinacion = Record<string, string>;

export interface VarianteBase {
  id: string;
  opciones: Combinacion;
  precio: number | null;
  activo: boolean;
}
export interface VarianteConStock extends VarianteBase { disponible: number }

const clave = (s: string) => s.trim().toLocaleLowerCase('es');

/**
 * Lo que el admin escribe llega con espacios y repetidos ("Rosa " y "rosa").
 * Sin esto se generan combinaciones duplicadas que la base rechaza por la
 * restricción única de opciones.
 */
export function normalizarOpciones(opciones: OpcionDef[]): OpcionDef[] {
  const nombresVistos = new Set<string>();
  const out: OpcionDef[] = [];
  for (const o of opciones) {
    const nombre = o.nombre.trim();
    if (!nombre || nombresVistos.has(clave(nombre))) continue;
    const vistos = new Set<string>();
    const valores: ValorOpcion[] = [];
    for (const v of o.valores) {
      const valor = v.valor.trim();
      if (!valor || vistos.has(clave(valor))) continue;
      vistos.add(clave(valor));
      valores.push({ valor, foto_url: v.foto_url ?? null });
    }
    if (valores.length === 0) continue;
    nombresVistos.add(clave(nombre));
    out.push({ nombre, valores });
  }
  return out;
}

export function generarCombinaciones(opciones: OpcionDef[]): Combinacion[] {
  if (opciones.length === 0) return [];
  return opciones.reduce<Combinacion[]>(
    (acc, o) => acc.flatMap(c => o.valores.map(v => ({ ...c, [o.nombre]: v.valor }))),
    [{}],
  );
}

export function claveCombinacion(c: Combinacion, orden: string[]): string {
  return orden.map(n => `${n}=${c[n] ?? ''}`).join('|');
}

export function etiquetaVariante(c: Combinacion, orden: string[]): string {
  return orden.map(n => c[n]).filter(Boolean).join(' · ');
}

export function varianteDeSeleccion<T extends VarianteBase>(
  variantes: T[],
  sel: Combinacion,
  orden: string[],
): T | null {
  if (orden.some(n => !sel[n])) return null;
  const buscada = claveCombinacion(sel, orden);
  return variantes.find(v => v.activo && claveCombinacion(v.opciones, orden) === buscada) ?? null;
}

/**
 * ¿Se puede elegir `valor` en `opcion` dado lo ya elegido en las DEMÁS
 * opciones? La selección actual de la propia opción no cuenta: el comprador
 * está a punto de cambiarla.
 */
export function valorDisponible(
  variantes: VarianteConStock[],
  sel: Combinacion,
  opcion: string,
  valor: string,
): boolean {
  return variantes.some(v =>
    v.activo &&
    v.disponible > 0 &&
    v.opciones[opcion] === valor &&
    Object.entries(sel).every(([n, val]) => n === opcion || !val || v.opciones[n] === val),
  );
}

export function rangoPrecios(
  variantes: VarianteBase[],
  precioBase: number,
): { min: number; max: number } | null {
  const precios = variantes.filter(v => v.activo).map(v => v.precio ?? precioBase);
  if (precios.length === 0) return null;
  return { min: Math.min(...precios), max: Math.max(...precios) };
}
```

- [ ] **Step 4: Correr las pruebas**

Run: `npx ng test --watch=false --include='src/app/core/utils/variantes-shared.spec.ts'`
Expected: PASS (todas).

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/_shared/variantes.ts src/app/core/utils/variantes-shared.spec.ts
git commit -m "feat: lógica pura de variantes compartida entre tienda, admin y servidor"
```

---

### Task 6: `crear-pedido` con variantes y reserva

**Files:**
- Modify: `supabase/functions/crear-pedido/index.ts`
- Modify: `supabase/functions/_shared/variantes.ts` (se añade `resolverLineas` al final: un solo archivo sin imports, porque Deno exige la extensión `.ts` en imports relativos y el compilador de Angular la rechaza)
- Test: `src/app/core/utils/lineas-pedido.spec.ts`

**Interfaces:**
- Consumes: `etiquetaVariante` (Task 5); RPC `reservar_stock_pedido` (Task 3).
- Produces:
  - Request item: `{ id: string; variante_id?: string | null; cantidad: number; sub?: string; color?: string }`.
  - Pura: `resolverLineas(items, productos, variantes, opciones): { ok: true; lineas: LineaPedido[] } | { ok: false; status: 400 | 422; error: string }` con
    ```ts
    export interface LineaPedido { id: string; varianteId: string | null; varianteLabel: string | null;
      nombre: string; categoria: string | null; precio: number; cantidad: number; sub: string; color: string | null }
    ```
  - Response éxito añade `reserva_expira_en: string` y `token: string`.
  - Response 409 (sin stock): `{ ok: false, error: 'Solo quedan N de "Nombre · M · Negro". Ajusta la cantidad para continuar.' }`.

- [ ] **Step 1: Escribir la prueba de la resolución de líneas**

```ts
// src/app/core/utils/lineas-pedido.spec.ts
import { resolverLineas } from '../../../../supabase/functions/_shared/variantes';

const PRODUCTOS = [
  { id: 'gorra', nombre: 'Gorra', categoria: 'gorra', precio: 40000, activo: true },
  { id: 'pin',   nombre: 'Pin',   categoria: 'pin',   precio: 8000,  activo: true },
];
const VARIANTES = [
  { id: 'g-n', producto_id: 'gorra', opciones: { Color: 'Negro' }, precio: null,  activo: true },
  { id: 'g-r', producto_id: 'gorra', opciones: { Color: 'Rosa' },  precio: 45000, activo: true },
  { id: 'g-v', producto_id: 'gorra', opciones: { Color: 'Verde' }, precio: null,  activo: false },
];
const OPCIONES = [{ producto_id: 'gorra', nombre: 'Color', posicion: 0 }];

describe('resolverLineas', () => {
  it('toma el precio de la variante o del producto y arma la etiqueta', () => {
    const r = resolverLineas(
      [{ id: 'gorra', variante_id: 'g-r', cantidad: 2 }, { id: 'gorra', variante_id: 'g-n', cantidad: 1 },
       { id: 'pin', cantidad: 3 }],
      PRODUCTOS, VARIANTES, OPCIONES);
    if (!r.ok) throw new Error(r.error);
    expect(r.lineas.map(l => [l.precio, l.varianteLabel])).toEqual([[45000, 'Rosa'], [40000, 'Negro'], [8000, null]]);
  });

  it('rechaza con 400 un producto con variantes pedido sin variante (carrito viejo)', () => {
    const r = resolverLineas([{ id: 'gorra', cantidad: 1 }], PRODUCTOS, VARIANTES, OPCIONES);
    expect(r).toEqual({ ok: false, status: 400,
      error: '"Gorra" ahora tiene opciones. Quítalo del carrito y vuelve a agregarlo eligiendo la tuya.' });
  });

  it('rechaza variantes inactivas o de otro producto', () => {
    expect(resolverLineas([{ id: 'gorra', variante_id: 'g-v', cantidad: 1 }], PRODUCTOS, VARIANTES, OPCIONES).ok).toBe(false);
    expect(resolverLineas([{ id: 'pin', variante_id: 'g-n', cantidad: 1 }], PRODUCTOS, VARIANTES, OPCIONES).ok).toBe(false);
  });

  it('rechaza con 422 productos inexistentes o inactivos', () => {
    const r = resolverLineas([{ id: 'nada', cantidad: 1 }], PRODUCTOS, VARIANTES, OPCIONES);
    expect(r).toEqual({ ok: false, status: 422, error: 'Alguno de los productos ya no está disponible' });
  });
});
```

- [ ] **Step 2: Correr para verificar que falla**

Run: `npx ng test --watch=false --include='src/app/core/utils/lineas-pedido.spec.ts'`
Expected: FAIL — módulo no existe.

- [ ] **Step 3: Añadir `resolverLineas` al final de `_shared/variantes.ts`**

```ts
// ── Líneas de pedido (crear-pedido) ──────────────────────────────────────────
// Convierte los ítems que manda el navegador en líneas de pedido con precio,
// nombre y etiqueta de variante tomados del catálogo. Del cliente sólo se
// confía en qué producto/variante y cuántas unidades.

export interface ItemEntrada { id: string; variante_id?: string | null; cantidad: number; sub?: unknown; color?: unknown }
interface ProductoCat { id: string; nombre: string; categoria: string | null; precio: number; activo: boolean }
interface VarianteCat { id: string; producto_id: string; opciones: Combinacion; precio: number | null; activo: boolean }
interface OpcionCat { producto_id: string; nombre: string; posicion: number }

export interface LineaPedido {
  id: string;
  varianteId: string | null;
  varianteLabel: string | null;
  nombre: string;
  categoria: string | null;
  precio: number;
  cantidad: number;
  sub: string;
  color: string | null;
}

export type ResultadoLineas =
  | { ok: true; lineas: LineaPedido[] }
  | { ok: false; status: 400 | 422; error: string };

export function resolverLineas(
  items: ItemEntrada[],
  productos: ProductoCat[],
  variantes: VarianteCat[],
  opciones: OpcionCat[],
): ResultadoLineas {
  const catalogo = new Map(
    productos.filter(p => p.activo && Number.isInteger(p.precio) && p.precio > 0).map(p => [p.id, p]),
  );
  const lineas: LineaPedido[] = [];

  for (const i of items) {
    const p = catalogo.get(i.id);
    if (!p) return { ok: false, status: 422, error: 'Alguno de los productos ya no está disponible' };

    const activas = variantes.filter(v => v.producto_id === p.id && v.activo);
    let varianteId: string | null = null;
    let varianteLabel: string | null = null;
    let precio = p.precio;

    if (activas.length > 0) {
      if (!i.variante_id) {
        return { ok: false, status: 400,
          error: `"${p.nombre}" ahora tiene opciones. Quítalo del carrito y vuelve a agregarlo eligiendo la tuya.` };
      }
      const v = activas.find(x => x.id === i.variante_id);
      if (!v) return { ok: false, status: 400, error: `La opción elegida de "${p.nombre}" ya no está disponible.` };
      const orden = opciones
        .filter(o => o.producto_id === p.id)
        .sort((a, b) => a.posicion - b.posicion)
        .map(o => o.nombre);
      varianteId = v.id;
      varianteLabel = etiquetaVariante(v.opciones, orden.length ? orden : Object.keys(v.opciones));
      precio = v.precio ?? p.precio;
    } else if (i.variante_id) {
      return { ok: false, status: 400, error: `La opción elegida de "${p.nombre}" ya no está disponible.` };
    }

    lineas.push({
      id: p.id,
      varianteId,
      varianteLabel,
      nombre: p.nombre,
      categoria: p.categoria,
      precio,
      cantidad: i.cantidad,
      // `sub` es NOT NULL en la tabla.
      sub: typeof i.sub === 'string' ? i.sub : '',
      color: typeof i.color === 'string' ? i.color : null,
    });
  }
  return { ok: true, lineas };
}
```

- [ ] **Step 4: Correr las pruebas**

Run: `npx ng test --watch=false --include='src/app/core/utils/lineas-pedido.spec.ts'`
Expected: PASS.

- [ ] **Step 5: Integrar en `crear-pedido/index.ts`**

1. Import: `import { resolverLineas } from '../_shared/variantes.ts'`.
2. En la validación de ítems (bucle actual), añadir: `if (it.variante_id != null && !isStr(it.variante_id)) return json({ ok:false, error:'Ítems del pedido inválidos' }, 400)`.
3. Reemplazar el bloque desde `// ── Precios y stock autoritativos` hasta el final de `const lineas = items.map(...)` por:

```ts
    // ── Precios desde el catálogo (productos, variantes y orden de opciones) ──
    const ids = [...new Set(items.map((i: any) => i.id as string))]
    const [prodRes, varRes, opRes] = await Promise.all([
      supabase.from('productos_evento').select('id, nombre, categoria, precio, activo').in('id', ids),
      supabase.from('producto_variantes').select('id, producto_id, opciones, precio, activo').in('producto_id', ids),
      supabase.from('producto_opciones').select('producto_id, nombre, posicion').in('producto_id', ids),
    ])
    if (prodRes.error || varRes.error || opRes.error) {
      console.error(prodRes.error ?? varRes.error ?? opRes.error)
      return json({ ok: false, error: 'No se pudo verificar el catálogo' }, 500)
    }

    const resuelto = resolverLineas(items, prodRes.data ?? [], varRes.data ?? [], opRes.data ?? [])
    if (!resuelto.ok) return json({ ok: false, error: resuelto.error }, resuelto.status)
    const lineas = resuelto.lineas
```

   (El chequeo de stock previo se elimina: ahora lo hace la reserva, atómicamente.)
4. En el insert de `pedido_items`, añadir `variante_id: l.varianteId, variante_label: l.varianteLabel`.
5. Justo después del insert de ítems exitoso (antes del incremento del código de descuento):

```ts
    // ── Reserva de 15 minutos ─────────────────────────────────────────────────
    // Bloquea y aparta el stock en una transacción: si dos personas van por la
    // última unidad, sólo una pasa. Si no alcanza, el pedido no debe existir.
    const { data: expira, error: resError } = await supabase.rpc('reservar_stock_pedido', {
      p_pedido_id: pedido.id,
    })
    if (resError) {
      await supabase.from('pedido_items').delete().eq('pedido_id', pedido.id)
      await supabase.from('pedidos').delete().eq('id', pedido.id)
      if (resError.code === 'P0409') {
        let info: any = {}
        try { info = JSON.parse(resError.details ?? '{}') } catch { /* sin detalle */ }
        const l = lineas.find(x => x.id === info.producto_id && (x.varianteId ?? null) === (info.variante_id ?? null))
        const nombre = l ? (l.varianteLabel ? `${l.nombre} · ${l.varianteLabel}` : l.nombre) : 'un producto'
        const n = Number(info.disponible) || 0
        return json({
          ok: false,
          error: n <= 0
            ? `"${nombre}" se agotó mientras comprabas. Quítalo del carrito para continuar.`
            : `Solo quedan ${n} de "${nombre}". Ajusta la cantidad para continuar.`,
        }, 409)
      }
      console.error(resError)
      return json({ ok: false, error: 'No pudimos apartar tus productos. Intenta de nuevo.' }, 500)
    }
```
6. En el rollback por código de descuento agotado (bloque `if (!dcRows || dcRows === 0)`), las reservas se borran en cascada con el pedido; no hace falta nada más.
7. En la respuesta de éxito añadir: `reserva_expira_en: expira, token: pedido.confirmacion_token,`.
8. Actualizar el comentario `// Líneas con el id, precio…` que ya no aplica.

- [ ] **Step 6: Verificar tipos de Deno**

Run: `npx deno check supabase/functions/crear-pedido/index.ts` (si `deno` no está disponible, `npx -y deno@2 check …`).
Expected: sin errores.

- [ ] **Step 7: Commit**

```bash
git add supabase/functions/_shared/variantes.ts src/app/core/utils/lineas-pedido.spec.ts supabase/functions/crear-pedido/index.ts
git commit -m "feat(crear-pedido): variantes y reserva de stock al crear el pedido"
```

---

### Task 7: `verificar-pago`, `bold-webhook` y `notify-pedido`

**Files:**
- Modify: `supabase/functions/verificar-pago/index.ts`, `supabase/functions/bold-webhook/index.ts`, `supabase/functions/notify-pedido/index.ts`

**Interfaces:**
- Consumes: RPCs `registrar_venta_web(p_referencia)`, `liberar_reservas_pedido(p_referencia)`; columnas `pedidos.cancelado_por_cliente`, `pedidos.sobreventa`, `pedido_items.variante_label`.

- [ ] **Step 1: `verificar-pago` — consultar también pedidos cancelados por el cliente**

Cambiar el select a `'id, estado, total, referencia, cancelado_por_cliente'` y reemplazar la salida temprana:

```ts
    // Un pedido que el cliente canceló desde la página puede haberse pagado
    // igual en el modal de Bold que seguía abierto: ése también se consulta,
    // pero sólo para pasarlo a aprobado.
    const reconsultable = pedido.estado === 'pendiente'
      || (pedido.estado === 'cancelado' && pedido.cancelado_por_cliente)
    if (!reconsultable) {
      return json({ ok: true, estado: pedido.estado, cambiado: false })
    }
```

Tras calcular `nuevoEstado`, añadir:

```ts
    if (pedido.estado === 'cancelado' && nuevoEstado !== 'aprobado') {
      return json({ ok: true, estado: pedido.estado, cambiado: false })
    }
```

Cambiar el `update` a `.in('estado', ['pendiente', 'cancelado'])` en vez de `.eq('estado', 'pendiente')`. Después del update exitoso:

```ts
    // Este respaldo es el que cierra los pedidos en producción: sin esto las
    // ventas aprobadas por aquí nunca descontaban stock.
    if (nuevoEstado === 'aprobado') {
      const { error: sErr } = await supabase.rpc('registrar_venta_web', { p_referencia: pedido.referencia })
      if (sErr) console.error('Error descontando stock del pedido', pedido.referencia, sErr)
    } else {
      const { error: lErr } = await supabase.rpc('liberar_reservas_pedido', { p_referencia: pedido.referencia })
      if (lErr) console.error('Error liberando reservas', pedido.referencia, lErr)
    }
```

Actualizar el comentario de cabecera: mencionar que descuenta stock y libera reservas.

- [ ] **Step 2: `bold-webhook` — liberar en rechazo/anulación**

Después del bloque `if (estado === 'aprobado') { … }` añadir:

```ts
  // Un pago rechazado o anulado devuelve de inmediato lo que el pedido tenía
  // apartado, en vez de esperar a que la reserva venza.
  if (estado === 'rechazado' || estado === 'cancelado') {
    const { error: libError } = await supabase.rpc('liberar_reservas_pedido', { p_referencia: referencia })
    if (libError) console.error('Error liberando reservas', referencia, libError)
  }
```

- [ ] **Step 3: `notify-pedido` — etiqueta y aviso de sobreventa**

Select de ítems: `'nombre, sub, precio, cantidad, color, variante_label'`. En la fila, reemplazar `${i.color ? … : ''}` por:

```ts
${i.variante_label ? ` · <strong>${esc(i.variante_label)}</strong>` : ''}
```

(el `color` es un tinte de tarjeta, no información para empacar). Antes de la tabla de ítems en `buildHtml`, insertar:

```ts
  const avisoSobreventa = p.sobreventa
    ? `<div style="background:#FDECEA;color:#9B1C1C;padding:12px 16px;border-radius:8px;margin:0 0 16px;font-size:14px">⚠ Sobreventa: al aprobarse este pago ya no había stock suficiente de algún producto. Revisa el inventario antes de despachar.</div>`
    : ''
```

y colocar `${avisoSobreventa}` al inicio del cuerpo blanco del correo. Nota: el trigger `trigger_notify_pedido` manda la fila de `pedidos` en el momento del cambio a `aprobado`, ANTES de que `registrar_venta_web` marque `sobreventa`. Por eso, dentro de la función, releer el flag:

```ts
      const { data: fresco } = await supabase.from('pedidos').select('sobreventa').eq('id', p.id).maybeSingle()
      if (fresco) p.sobreventa = fresco.sobreventa
```

(justo después de cargar los ítems, dentro del mismo `if (supaUrl && svc)`).

- [ ] **Step 4: Verificar tipos**

Run: `npx -y deno@2 check supabase/functions/verificar-pago/index.ts supabase/functions/bold-webhook/index.ts supabase/functions/notify-pedido/index.ts`
Expected: sin errores.

- [ ] **Step 5: Desplegar las cuatro funciones**

Las migraciones ya están en producción (Task 4). El frontend actual no manda `variante_id` y sus productos no tienen variantes, así que es compatible.

```bash
for fn in crear-pedido verificar-pago bold-webhook notify-pedido; do
  npx supabase functions deploy $fn --project-ref ytqcwrjxlnlsjgnjxiiw --no-verify-jwt --use-api
done
```
Expected: `Deployed Function <fn>` ×4. Verificar con `curl -s -o /dev/null -w "%{http_code}" -X OPTIONS https://ytqcwrjxlnlsjgnjxiiw.supabase.co/functions/v1/crear-pedido` → `200`.

- [ ] **Step 6: Commit**

```bash
git add supabase/functions/verificar-pago/index.ts supabase/functions/bold-webhook/index.ts supabase/functions/notify-pedido/index.ts
git commit -m "fix(pagos): verificar-pago descuenta stock y liberan reservas al rechazar"
```

---

### Task 8: `InventarioService` — tipos, lectura pública y admin de variantes

**Files:**
- Modify: `src/app/core/services/inventario.service.ts`

**Interfaces:**
- Consumes: tipos de `supabase/functions/_shared/variantes.ts`; RPCs `stock_disponible`, `guardar_variantes`, `registrar_restock`, `registrar_ajuste`.
- Produces:
  ```ts
  export type { ValorOpcion, OpcionDef, Combinacion } from '../../../../supabase/functions/_shared/variantes';
  export interface ProductoOpcion { nombre: string; posicion: number; valores: ValorOpcion[] }
  export interface ProductoVariante { id: string; producto_id: string; opciones: Combinacion; precio: number | null;
    stock_actual: number; activo: boolean; posicion: number }
  export interface VariantePublica extends ProductoVariante { disponible: number }
  // ProductoPublico gana: tieneVariantes?: boolean; precioMin?: number; precioMax?: number
  getProductoPublico(id): Promise<{ producto: ProductoEvento | null; opciones: ProductoOpcion[];
    variantes: VariantePublica[]; error: string | null }>
  getVariantesAdmin(productoId: string): Promise<{ opciones: ProductoOpcion[]; variantes: ProductoVariante[] }>
  guardarVariantes(productoId: string, opciones: OpcionDef[],
    variantes: { opciones: Combinacion; precio: number | null; stock_inicial: number; activo: boolean }[]
  ): Promise<{ resultado: { creadas: number; actualizadas: number; desactivadas: number } | null; error: string | null }>
  restockProducto(productoId, cantidad, nota?, varianteId?: string | null)
  ajustarStock(productoId, nuevoStock, nota?, varianteId?: string | null)
  getHistorialProducto(productoId: string, varianteId?: string | null)
  getVentas(...) → VentaEvento gana variante_id: string | null y producto_variantes?: { opciones: Combinacion } | null
  ```
  En el catálogo público y en la ficha, `stock_actual` pasa a ser el **disponible** (físico − reservas).

- [ ] **Step 1: Tipos**

Añadir junto a `ProductoEvento`:

```ts
import type { Combinacion, OpcionDef, ValorOpcion } from '../../../../supabase/functions/_shared/variantes';
export type { Combinacion, OpcionDef, ValorOpcion };

export interface ProductoOpcion { nombre: string; posicion: number; valores: ValorOpcion[] }

export interface ProductoVariante {
  id: string;
  producto_id: string;
  opciones: Combinacion;
  precio: number | null;
  stock_actual: number;
  activo: boolean;
  posicion: number;
}

/** Variante como la ve la tienda: `disponible` ya descuenta reservas vigentes. */
export interface VariantePublica extends ProductoVariante { disponible: number }
```

Extender `ProductoPublico`:

```ts
export type ProductoPublico = Pick<ProductoEvento, /* …igual… */> & {
  /** true si tiene al menos una variante activa: el «+» de la tarjeta lleva a la ficha. */
  tieneVariantes?: boolean;
  precioMin?: number;
  precioMax?: number;
};
```

Añadir a `VentaEvento`: `variante_id?: string | null; producto_variantes?: { opciones: Combinacion } | null;`.

- [ ] **Step 2: Catálogo con variantes y disponible**

Reemplazar el cuerpo de `cargarCatalogo()` desde la consulta:

```ts
    const [prodRes, dispRes] = await Promise.all([
      this.sb.db
        .from('productos_evento')
        .select(`${COLUMNAS_PUBLICAS}, producto_variantes(precio, activo)`)
        .eq('activo', true)
        .order('creado_en', { ascending: false }),
      this.sb.db.rpc('stock_disponible'),
    ]);
    if (prodRes.error) {
      this.errorCatalogo.set(prodRes.error.message);
      this.cargandoCatalogo.set(false);
      return;
    }
    // Si falla la lectura de reservas se muestra el stock físico: el servidor
    // vuelve a validar al crear el pedido.
    const disponible = new Map<string, number>(
      ((dispRes.data ?? []) as { producto_id: string; variante_id: string | null; disponible: number }[])
        .filter(r => r.variante_id === null)
        .map(r => [r.producto_id, r.disponible]),
    );
    this.catalogo.set(
      ((prodRes.data ?? []) as any[]).map(({ producto_variantes, ...p }) => {
        const activas = ((producto_variantes ?? []) as { precio: number | null; activo: boolean }[]).filter(v => v.activo);
        const precios = activas.map(v => v.precio ?? p.precio);
        return {
          ...p,
          material: p.material ?? [],
          stock_actual: disponible.get(p.id) ?? p.stock_actual,
          tieneVariantes: activas.length > 0,
          precioMin: precios.length ? Math.min(...precios) : p.precio,
          precioMax: precios.length ? Math.max(...precios) : p.precio,
        } as ProductoPublico;
      }),
    );
    this.cargandoCatalogo.set(false);
```

- [ ] **Step 3: Ficha pública con opciones y variantes**

Reemplazar `getProductoPublico`:

```ts
  async getProductoPublico(id: string): Promise<{
    producto: ProductoEvento | null;
    opciones: ProductoOpcion[];
    variantes: VariantePublica[];
    error: string | null;
  }> {
    const vacio = { producto: null, opciones: [], variantes: [] };
    const [prodRes, opRes, varRes, dispRes] = await Promise.all([
      this.sb.db.from('productos_evento').select('*').eq('id', id).maybeSingle(),
      this.sb.db.from('producto_opciones').select('nombre, posicion, valores').eq('producto_id', id).order('posicion'),
      this.sb.db.from('producto_variantes').select('*').eq('producto_id', id).eq('activo', true).order('posicion'),
      this.sb.db.rpc('stock_disponible', { p_producto_ids: [id] }),
    ]);
    const error = prodRes.error ?? opRes.error ?? varRes.error;
    if (error) return { ...vacio, error: error.message };
    if (!prodRes.data) return { ...vacio, error: null };

    const disp = new Map<string | null, number>(
      ((dispRes.data ?? []) as { variante_id: string | null; disponible: number }[])
        .map(r => [r.variante_id, r.disponible]),
    );
    const producto = { ...prodRes.data, stock_actual: disp.get(null) ?? prodRes.data.stock_actual } as ProductoEvento;
    const variantes = ((varRes.data ?? []) as ProductoVariante[])
      .map(v => ({ ...v, disponible: disp.get(v.id) ?? v.stock_actual }));
    return { producto, opciones: (opRes.data ?? []) as ProductoOpcion[], variantes, error: null };
  }
```

- [ ] **Step 4: Métodos de admin**

```ts
  /** Opciones y TODAS las variantes (también inactivas) para el admin. */
  async getVariantesAdmin(productoId: string): Promise<{ opciones: ProductoOpcion[]; variantes: ProductoVariante[] }> {
    const [opRes, varRes] = await Promise.all([
      this.sb.db.from('producto_opciones').select('nombre, posicion, valores').eq('producto_id', productoId).order('posicion'),
      this.sb.db.from('producto_variantes').select('*').eq('producto_id', productoId).order('posicion'),
    ]);
    if (opRes.error) throw opRes.error;
    if (varRes.error) throw varRes.error;
    return { opciones: (opRes.data ?? []) as ProductoOpcion[], variantes: (varRes.data ?? []) as ProductoVariante[] };
  }

  async guardarVariantes(
    productoId: string,
    opciones: OpcionDef[],
    variantes: { opciones: Combinacion; precio: number | null; stock_inicial: number; activo: boolean }[],
  ): Promise<{ resultado: { creadas: number; actualizadas: number; desactivadas: number } | null; error: string | null }> {
    const { data, error } = await this.sb.db.rpc('guardar_variantes', {
      p_producto_id: productoId,
      p_opciones: opciones,
      p_variantes: variantes,
    });
    if (error) return { resultado: null, error: error.message };
    return { resultado: data, error: null };
  }
```

`restockProducto` y `ajustarStock` ganan un último parámetro `varianteId: string | null = null` que se envía como `p_variante_id: varianteId`. En ambos, el `parchear` local sólo se hace cuando `varianteId` es null; con variante, llamar `await this.cargarTodos()` (el trigger cambió el total).

`getHistorialProducto(productoId, varianteId: string | null = null)`: añadir a las dos consultas `if (varianteId) q = q.eq('variante_id', varianteId)` (construir cada consulta en variable `let` antes del `Promise.all`).

`getVentas`: select `'*, productos_evento(nombre, categoria, precio, evento_id), producto_variantes(opciones)'`.

`duplicarProducto`: después de crear el duplicado y copiar imágenes, copiar variantes:

```ts
    const { opciones, variantes } = await this.getVariantesAdmin(id);
    if (opciones.length > 0) {
      await this.guardarVariantes(
        data.id as string,
        opciones.map(o => ({ nombre: o.nombre, valores: o.valores })),
        variantes.filter(v => v.activo).map(v => ({ opciones: v.opciones, precio: v.precio, stock_inicial: 0, activo: true })),
      );
    }
```

(Las fotos por valor apuntan a URLs del original; se conservan — son archivos públicos del original, igual que antes de la copia de imágenes. Aceptable: el admin puede reasignarlas.)

- [ ] **Step 5: Compilar**

Run: `npx ng build --configuration development`
Expected: build OK. Si `producto-detail.component.ts` falla por el nuevo tipo de retorno de `getProductoPublico`, se arregla en Task 11; para no romper el build en este commit, en `producto-detail.component.ts` cambiar sólo la desestructuración a `const { producto, error } = await this.inv.getProductoPublico(id);` (ya es así; debe compilar sin cambios).

- [ ] **Step 6: Correr la suite existente**

Run: `npx ng test --watch=false`
Expected: todo PASS.

- [ ] **Step 7: Commit**

```bash
git add src/app/core/services/inventario.service.ts
git commit -m "feat(inventario): lectura de variantes, stock disponible y admin de variantes"
```

---

### Task 9: Pedido pendiente persistente (pura)

**Files:**
- Create: `src/app/pages/cuaquiverso/services/pedido-pendiente.ts`
- Test: `src/app/pages/cuaquiverso/services/pedido-pendiente.spec.ts`

**Interfaces:**
- Produces:
  ```ts
  export const CLAVE_PEDIDO_PENDIENTE = 'cuaquiverso.pedido-pendiente';
  export interface PedidoPendiente { token: string; referencia: string; expiraEn: string; huella: string; bold: BoldCheckoutConfig }
  export function leerPedidoPendiente(storage: Storage | null, ahora?: number): PedidoPendiente | null
  export function guardarPedidoPendiente(storage: Storage | null, p: PedidoPendiente): void
  export function limpiarPedidoPendiente(storage: Storage | null): void
  export function segundosRestantes(expiraEn: string, ahora?: number): number
  export function formatoCuenta(segundos: number): string   // 754 → "12:34"
  ```

- [ ] **Step 1: Pruebas**

```ts
// src/app/pages/cuaquiverso/services/pedido-pendiente.spec.ts
import {
  CLAVE_PEDIDO_PENDIENTE, PedidoPendiente, formatoCuenta, guardarPedidoPendiente,
  leerPedidoPendiente, limpiarPedidoPendiente, segundosRestantes,
} from './pedido-pendiente';

function storageFalso(): Storage {
  const m = new Map<string, string>();
  return {
    getItem: k => m.get(k) ?? null, setItem: (k, v) => void m.set(k, v), removeItem: k => void m.delete(k),
    clear: () => m.clear(), key: i => [...m.keys()][i] ?? null, get length() { return m.size; },
  } as Storage;
}

const AHORA = Date.parse('2026-09-29T12:00:00Z');
const P: PedidoPendiente = {
  token: 't', referencia: 'CQV-1', expiraEn: '2026-09-29T12:15:00Z', huella: 'h',
  bold: { apiKey: 'k', orderId: 'CQV-1', amount: '1', currency: 'COP', integritySignature: 's',
          redirectionUrl: 'https://x/?ref=t', description: 'd', customerData: '{}', billingAddress: '{}' },
};

describe('pedido pendiente', () => {
  it('sobrevive a una recarga mientras la reserva está vigente', () => {
    const s = storageFalso();
    guardarPedidoPendiente(s, P);
    expect(leerPedidoPendiente(s, AHORA)).toEqual(P);
  });

  it('se descarta y se borra al vencer', () => {
    const s = storageFalso();
    guardarPedidoPendiente(s, P);
    expect(leerPedidoPendiente(s, Date.parse('2026-09-29T12:15:01Z'))).toBeNull();
    expect(s.getItem(CLAVE_PEDIDO_PENDIENTE)).toBeNull();
  });

  it('tolera JSON corrupto y storage ausente', () => {
    const s = storageFalso();
    s.setItem(CLAVE_PEDIDO_PENDIENTE, '{no');
    expect(leerPedidoPendiente(s, AHORA)).toBeNull();
    expect(leerPedidoPendiente(null, AHORA)).toBeNull();
    expect(() => guardarPedidoPendiente(null, P)).not.toThrow();
  });

  it('limpia', () => {
    const s = storageFalso();
    guardarPedidoPendiente(s, P);
    limpiarPedidoPendiente(s);
    expect(leerPedidoPendiente(s, AHORA)).toBeNull();
  });

  it('cuenta regresiva', () => {
    expect(segundosRestantes(P.expiraEn, AHORA)).toBe(900);
    expect(segundosRestantes(P.expiraEn, Date.parse('2026-09-29T12:20:00Z'))).toBe(0);
    expect(formatoCuenta(754)).toBe('12:34');
    expect(formatoCuenta(5)).toBe('0:05');
  });
});
```

- [ ] **Step 2: Correr para verificar que falla**

Run: `npx ng test --watch=false --include='src/app/pages/cuaquiverso/services/pedido-pendiente.spec.ts'`
Expected: FAIL — módulo no existe.

- [ ] **Step 3: Implementar**

```ts
// src/app/pages/cuaquiverso/services/pedido-pendiente.ts
//
// El pedido con stock apartado sobrevive a recargas: queda en localStorage
// hasta que vence la reserva (15 min), se paga o el cliente lo cancela.
import { BoldCheckoutConfig } from './bold.service';

export const CLAVE_PEDIDO_PENDIENTE = 'cuaquiverso.pedido-pendiente';

export interface PedidoPendiente {
  token: string;
  referencia: string;
  /** ISO: cuándo vence la reserva según el servidor. */
  expiraEn: string;
  /** Huella del formulario + carrito con que se creó: si cambian, es otro pedido. */
  huella: string;
  bold: BoldCheckoutConfig;
}

export function segundosRestantes(expiraEn: string, ahora = Date.now()): number {
  return Math.max(0, Math.floor((Date.parse(expiraEn) - ahora) / 1000));
}

export function formatoCuenta(segundos: number): string {
  const m = Math.floor(segundos / 60);
  const s = segundos % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function leerPedidoPendiente(storage: Storage | null, ahora = Date.now()): PedidoPendiente | null {
  if (!storage) return null;
  try {
    const crudo = storage.getItem(CLAVE_PEDIDO_PENDIENTE);
    if (!crudo) return null;
    const p = JSON.parse(crudo) as PedidoPendiente;
    if (!p?.token || !p?.expiraEn || !p?.bold?.integritySignature) return null;
    if (segundosRestantes(p.expiraEn, ahora) <= 0) {
      storage.removeItem(CLAVE_PEDIDO_PENDIENTE);
      return null;
    }
    return p;
  } catch {
    return null;
  }
}

export function guardarPedidoPendiente(storage: Storage | null, p: PedidoPendiente): void {
  try { storage?.setItem(CLAVE_PEDIDO_PENDIENTE, JSON.stringify(p)); } catch { /* sin persistencia */ }
}

export function limpiarPedidoPendiente(storage: Storage | null): void {
  try { storage?.removeItem(CLAVE_PEDIDO_PENDIENTE); } catch { /* nada */ }
}
```

- [ ] **Step 4: Correr las pruebas**

Run: `npx ng test --watch=false --include='src/app/pages/cuaquiverso/services/pedido-pendiente.spec.ts'`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/pages/cuaquiverso/services/pedido-pendiente.ts src/app/pages/cuaquiverso/services/pedido-pendiente.spec.ts
git commit -m "feat(checkout): persistencia del pedido con stock apartado"
```

---

### Task 10: Carrito v2 por producto + variante

**Files:**
- Modify: `src/app/pages/cuaquiverso/services/cart.service.ts`, `src/app/pages/cuaquiverso/cart-modal/cart-modal.component.html`
- Test: `src/app/pages/cuaquiverso/services/cart.service.spec.ts`

**Interfaces:**
- Produces:
  ```ts
  export interface CartItem { id; name; sub; price; color; qty; categoria; stock?;
    varianteId?: string | null; varianteLabel?: string | null }
  export function claveLinea(i: { id: string; varianteId?: string | null }): string  // `${id}|${varianteId ?? ''}`
  export function migrarCarritoV1(crudo: string | null): CartItem[]
  CartService.updateQty(clave: string, qty: number)
  CartService.remove(clave: string)
  ```
  Los llamadores existentes de `updateQty(i.id, …)` / `remove(i.id)` deben pasar `claveLinea(i)`.

- [ ] **Step 1: Pruebas**

```ts
// src/app/pages/cuaquiverso/services/cart.service.spec.ts
import { TestBed } from '@angular/core/testing';
import { CartService, claveLinea, migrarCarritoV1 } from './cart.service';

const base = { name: 'Gorra', sub: 'Gorra', price: 40000, color: 'rio', categoria: 'gorra' };

describe('CartService con variantes', () => {
  beforeEach(() => { localStorage.clear(); TestBed.configureTestingModule({}); });

  it('dos variantes del mismo producto son dos líneas', () => {
    const cart = TestBed.inject(CartService);
    cart.add({ ...base, id: 'g', varianteId: 'n', varianteLabel: 'Negro', stock: 3 });
    cart.add({ ...base, id: 'g', varianteId: 'r', varianteLabel: 'Rosa', stock: 3 });
    cart.add({ ...base, id: 'g', varianteId: 'n', varianteLabel: 'Negro', stock: 3 });
    expect(cart.items().map(i => [i.varianteId, i.qty])).toEqual([['n', 2], ['r', 1]]);
  });

  it('updateQty y remove actúan sobre la línea', () => {
    const cart = TestBed.inject(CartService);
    cart.add({ ...base, id: 'g', varianteId: 'n', stock: 5 });
    cart.add({ ...base, id: 'g', varianteId: 'r', stock: 5 });
    cart.updateQty(claveLinea({ id: 'g', varianteId: 'r' }), 4);
    cart.remove(claveLinea({ id: 'g', varianteId: 'n' }));
    expect(cart.items().map(i => [i.varianteId, i.qty])).toEqual([['r', 4]]);
  });

  it('el tope usa el stock de la variante', () => {
    const cart = TestBed.inject(CartService);
    expect(cart.add({ ...base, id: 'g', varianteId: 'n', stock: 1 })).toBe(true);
    expect(cart.add({ ...base, id: 'g', varianteId: 'n', stock: 1 })).toBe(false);
  });
});

describe('migrarCarritoV1', () => {
  it('conserva las líneas válidas como líneas sin variante', () => {
    const v1 = JSON.stringify({ guardadoEn: Date.now(), items: [{ ...base, id: 'p', qty: 2 }, { id: 3 }] });
    expect(migrarCarritoV1(v1)).toEqual([{ ...base, id: 'p', qty: 2 }]);
  });

  it('descarta un v1 vencido o corrupto', () => {
    expect(migrarCarritoV1(JSON.stringify({ guardadoEn: 0, items: [{ ...base, id: 'p', qty: 1 }] }))).toEqual([]);
    expect(migrarCarritoV1('{no')).toEqual([]);
    expect(migrarCarritoV1(null)).toEqual([]);
  });
});
```

- [ ] **Step 2: Correr para verificar que falla**

Run: `npx ng test --watch=false --include='src/app/pages/cuaquiverso/services/cart.service.spec.ts'`
Expected: FAIL — `claveLinea` / `migrarCarritoV1` no exportados.

- [ ] **Step 3: Implementar**

En `cart.service.ts`:

```ts
export interface CartItem {
  id: string;
  name: string;
  sub: string;
  price: number;
  color: string;
  qty: number;
  categoria: string;
  /** Stock conocido al agregar (el de la variante si la hay). Tope local; el servidor revalida al pagar. */
  stock?: number;
  /** Combinación elegida, p. ej. Talla M · Negro. Sin variante = producto simple. */
  varianteId?: string | null;
  varianteLabel?: string | null;
}

const STORAGE_KEY = 'cuaquiverso.cart.v2';
const STORAGE_KEY_V1 = 'cuaquiverso.cart.v1';

/** Una línea es producto + variante: la misma camiseta en M y en L son dos. */
export function claveLinea(i: { id: string; varianteId?: string | null }): string {
  return `${i.id}|${i.varianteId ?? ''}`;
}

function lineasValidas(items: unknown): CartItem[] {
  if (!Array.isArray(items)) return [];
  return items.filter(
    (i: any) =>
      typeof i?.id === 'string' &&
      typeof i?.name === 'string' &&
      Number.isFinite(i?.price) &&
      Number.isInteger(i?.qty) && i.qty > 0,
  );
}

/** El carrito v1 sólo tenía productos simples: sus líneas valen tal cual. */
export function migrarCarritoV1(crudo: string | null): CartItem[] {
  if (!crudo) return [];
  try {
    const g = JSON.parse(crudo);
    if (Date.now() - (g?.guardadoEn ?? 0) > TTL_MS) return [];
    return lineasValidas(g?.items);
  } catch {
    return [];
  }
}
```

Mover `TTL_MS` arriba de estas funciones. En `add`: `const k = claveLinea(item); const idx = curr.findIndex(i => claveLinea(i) === k);`. En `updateQty(clave: string, qty)` y `remove(clave: string)`: comparar `claveLinea(i) === clave`. En `restaurar()`:

```ts
  private restaurar(): CartItem[] {
    if (!this.esNavegador) return [];
    try {
      const v1 = localStorage.getItem(STORAGE_KEY_V1);
      if (v1 !== null) {
        localStorage.removeItem(STORAGE_KEY_V1);
        return migrarCarritoV1(v1);
      }
      const crudo = localStorage.getItem(STORAGE_KEY);
      if (!crudo) return [];
      const guardado = JSON.parse(crudo);
      if (Date.now() - (guardado?.guardadoEn ?? 0) > TTL_MS) {
        localStorage.removeItem(STORAGE_KEY);
        return [];
      }
      return lineasValidas(guardado?.items);
    } catch {
      return [];
    }
  }
```

- [ ] **Step 4: Actualizar los llamadores**

Run: `grep -rn "updateQty(\|\.remove(" src/app/pages/cuaquiverso --include=*.html --include=*.ts`
En cada uso sobre un `CartItem` (p. ej. `cart-modal.component.html:44-51`), cambiar `item.id` por `claveLinea(item)`. En `cart-modal.component.ts`: `import { claveLinea } from '../services/cart.service'` y exponer `readonly claveLinea = claveLinea;`. En el `@for` del carrito, `track claveLinea(item)`. Mostrar la variante bajo el nombre:

```html
<div class="ci-sub">{{ item.sub }}@if (item.varianteLabel) { · {{ item.varianteLabel }} }</div>
```

(usar la clase/estructura existente del subtítulo de línea en `cart-modal.component.html`).

- [ ] **Step 5: Correr las pruebas y el build**

Run: `npx ng test --watch=false --include='src/app/pages/cuaquiverso/services/cart.service.spec.ts'` → PASS.
Run: `npx ng build --configuration development` → OK.

- [ ] **Step 6: Commit**

```bash
git add src/app/pages/cuaquiverso/services/cart.service.ts src/app/pages/cuaquiverso/services/cart.service.spec.ts src/app/pages/cuaquiverso/cart-modal/
git commit -m "feat(carrito): líneas por producto y variante, migración del carrito v1"
```

---

### Task 11: Ficha de producto con selector de variantes

**Files:**
- Modify: `src/app/pages/cuaquiverso/tienda/producto/producto-detail.component.{ts,html,scss}`

**Interfaces:**
- Consumes: `getProductoPublico` (Task 8), `varianteDeSeleccion`, `valorDisponible`, `rangoPrecios`, `etiquetaVariante` (Task 5), `CartItem.varianteId/varianteLabel` (Task 10).

- [ ] **Step 1: Estado y derivados en el componente**

Añadir imports de `ProductoOpcion, VariantePublica` y de `../../../../../../supabase/functions/_shared/variantes` (`Combinacion, etiquetaVariante, rangoPrecios, valorDisponible, varianteDeSeleccion`). Añadir:

```ts
  readonly opciones   = signal<ProductoOpcion[]>([]);
  readonly variantes  = signal<VariantePublica[]>([]);
  readonly seleccion  = signal<Combinacion>({});

  readonly tieneVariantes = computed(() => this.variantes().length > 0);
  readonly orden = computed(() => this.opciones().map(o => o.nombre));

  readonly variante = computed(() =>
    varianteDeSeleccion(this.variantes(), this.seleccion(), this.orden()));

  /** Stock que manda: el de la combinación elegida o el total del producto. */
  readonly stockVisible = computed(() =>
    this.variante()?.disponible ?? this.producto()?.stock_actual ?? 0);

  readonly precioVisible = computed(() => {
    const p = this.producto();
    if (!p) return 0;
    return this.variante()?.precio ?? p.precio;
  });

  readonly rango = computed(() => {
    const p = this.producto();
    return p && this.tieneVariantes() ? rangoPrecios(this.variantes(), p.precio) : null;
  });

  /** Nombre (en minúscula) de la primera opción sin elegir, para el botón. */
  readonly faltaElegir = computed(() => {
    const n = this.orden().find(o => !this.seleccion()[o]);
    return n ? n.toLocaleLowerCase('es') : null;
  });

  disponible(opcion: string, valor: string): boolean {
    return valorDisponible(this.variantes(), this.seleccion(), opcion, valor);
  }

  elegir(opcion: string, valor: string, foto: string | null): void {
    this.avisoTope.set(false);
    this.seleccion.update(s => ({ ...s, [opcion]: s[opcion] === valor ? '' : valor }));
    if (foto && this.seleccion()[opcion]) this.selectedImg.set(foto);
  }
```

Reemplazar `agotado` y `pocasUnidades` para que usen `stockVisible()`:

```ts
  readonly agotado = computed(() => this.stockVisible() <= 0);
  readonly pocasUnidades = computed(() => {
    const s = this.stockVisible();
    return s > 0 && s <= UMBRAL_POCAS_UNIDADES;
  });
```

En `cargar()`: `const { producto, opciones, variantes, error } = await this.inv.getProductoPublico(id);` y en la rama de éxito `this.opciones.set(opciones); this.variantes.set(variantes); this.seleccion.set({});` antes de `aplicarSeo`.

Incluir las fotos por valor en `allImgs`, para que la galería pueda mostrarlas aunque no estén en `fotos`:

```ts
    this.opciones().forEach(o => o.valores.forEach(v => {
      if (v.foto_url && !imgs.includes(v.foto_url)) imgs.push(v.foto_url);
    }));
```

(añadir dentro de `allImgs`, antes del `return`).

`addToCart()`:

```ts
  addToCart(): void {
    const p = this.producto();
    if (!p || this.agotado()) return;
    const v = this.variante();
    if (this.tieneVariantes() && !v) return;
    const agregado = this.cart.add({
      id:            p.id,
      name:          p.nombre,
      sub:           this.catLabel(p.categoria),
      price:         v?.precio ?? p.precio,
      color:         p.color ?? '#3D4856',
      categoria:     p.categoria,
      stock:         this.stockVisible(),
      varianteId:    v?.id ?? null,
      varianteLabel: v ? etiquetaVariante(v.opciones, this.orden()) : null,
    });
    if (agregado) this.cart.open();
    else this.avisoTope.set(true);
  }
```

JSON-LD en `aplicarSeo`: si `this.rango()` y `min !== max`, usar

```ts
      offers: this.rango() && this.rango()!.min !== this.rango()!.max
        ? { '@type': 'AggregateOffer', priceCurrency: 'COP', lowPrice: this.rango()!.min,
            highPrice: this.rango()!.max, offerCount: this.variantes().length,
            availability: p.stock_actual > 0 ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock' }
        : { /* Offer actual, con price: this.rango()?.min ?? p.precio */ },
```

(`aplicarSeo` se llama después de `this.variantes.set(...)`.)

- [ ] **Step 2: Template**

Precio (línea ~108):

```html
      <div class="product-price">
        @if (tieneVariantes() && !variante() && rango() && rango()!.min !== rango()!.max) {
          Desde {{ fmtPrice(rango()!.min) }} COP
        } @else {
          {{ fmtPrice(precioVisible()) }} COP
        }
      </div>
```

Después del bloque de precio y antes de los badges de stock:

```html
      @for (op of opciones(); track op.nombre) {
        <fieldset class="variant-group">
          <legend class="variant-label">
            {{ op.nombre }}@if (seleccion()[op.nombre]) {: <b>{{ seleccion()[op.nombre] }}</b>}
          </legend>
          <div class="variant-pills">
            @for (val of op.valores; track val.valor) {
              <button type="button" class="variant-pill"
                      [class.is-selected]="seleccion()[op.nombre] === val.valor"
                      [class.is-out]="!disponible(op.nombre, val.valor)"
                      [disabled]="!disponible(op.nombre, val.valor)"
                      [attr.aria-pressed]="seleccion()[op.nombre] === val.valor"
                      (click)="elegir(op.nombre, val.valor, val.foto_url)">
                @if (val.foto_url) { <img [src]="val.foto_url" alt="" class="variant-thumb" /> }
                {{ val.valor }}
              </button>
            }
          </div>
        </fieldset>
      }
```

Botón (línea ~149):

```html
      <button class="btn-add" type="button"
              [disabled]="agotado() || (tieneVariantes() && !variante())"
              (click)="addToCart()">
        @if (tieneVariantes() && faltaElegir()) { Elige {{ faltaElegir() }} }
        @else if (agotado()) { Agotado }
        @else { Agregar al carrito }
      </button>
```

Los bloques `@if (agotado())` de mensajes de stock existentes siguen valiendo (ahora dependen de `stockVisible`), pero el de «Este producto está agotado por ahora» debe mostrarse sólo si `!tieneVariantes() || variante()`: envolver su condición como `@if (agotado() && (!tieneVariantes() || variante()))`.

- [ ] **Step 3: Estilos** (en `producto-detail.component.scss`, usando los tokens/variables que ya usa el archivo para bordes, radios y colores)

```scss
.variant-group { border: 0; padding: 0; margin: 0 0 16px; }
.variant-label { font-size: 14px; margin-bottom: 8px; }
.variant-pills { display: flex; flex-wrap: wrap; gap: 8px; }
.variant-pill {
  display: inline-flex; align-items: center; gap: 6px;
  min-height: 40px; padding: 6px 14px; border-radius: 999px;
  border: 1.5px solid currentColor; background: transparent; cursor: pointer; font: inherit;
  &.is-selected { background: #151F28; color: #fff; border-color: #151F28; }
  &.is-out { opacity: .4; text-decoration: line-through; cursor: not-allowed; }
  &:focus-visible { outline: 2px solid #2A6FDB; outline-offset: 2px; }
}
.variant-thumb { width: 24px; height: 24px; border-radius: 50%; object-fit: cover; }
```

- [ ] **Step 4: Build**

Run: `npx ng build --configuration development`
Expected: OK. (La verificación en vivo es Task 18.)

- [ ] **Step 5: Commit**

```bash
git add src/app/pages/cuaquiverso/tienda/producto/
git commit -m "feat(tienda): selector de variantes en la ficha de producto"
```

---

### Task 12: Tarjetas — «Desde $X» y el «+» lleva a la ficha

**Files:**
- Modify: `src/app/pages/cuaquiverso/tienda/tienda.component.{ts,html}`, `src/app/pages/cuaquiverso/cuaquiverso.component.ts`, `src/app/pages/cuaquiverso/personaje/personaje-page.component.ts` (y sus `.html` si muestran precio)

**Interfaces:**
- Consumes: `ProductoPublico.tieneVariantes/precioMin/precioMax` (Task 8).

- [ ] **Step 1: `tienda.component.ts` `addToCart` (línea ~241)**

Al principio del método, después de `ev.stopPropagation()`/`preventDefault()` existentes:

```ts
    // Con variantes hay que elegir talla/color: el «+» lleva a la ficha.
    if (p.tieneVariantes) {
      this.router.navigate(['/cuaquiverso/tienda', p.id]);
      return;
    }
```

(Inyectar `Router` si el componente no lo tiene: `private router = inject(Router);`.)

En el template, donde se imprime el precio de la tarjeta:

```html
@if (p.tieneVariantes && p.precioMin !== p.precioMax) { Desde {{ fmtPrice(p.precioMin!) }} } @else { {{ fmtPrice(p.precio) }} }
```

(usar el método/pipe de formato que ya use la tarjeta). El `aria-label` del botón «+» para productos con variantes: `'Elegir opciones de ' + p.nombre`.

- [ ] **Step 2: `cuaquiverso.component.ts` y `personaje-page.component.ts`**

Esos componentes tipan `p` como `ProductoEvento` y leen productos con su propia consulta. Leer primero de dónde sale su lista (`grep -n "catalogo\|from('productos_evento')" <archivo>`):
- Si usan `inv.catalogo()`, aplicar exactamente el mismo cambio que en Step 1 (el campo `tieneVariantes` ya viene).
- Si hacen su propia consulta, añadir `producto_variantes(activo)` al select y en `addToCart` usar `if ((p as any).producto_variantes?.some((v: any) => v.activo)) { this.router.navigate(['/cuaquiverso/tienda', p.id]); return; }`.

Además, pasar `stock: p.stock_actual` en su `cart.add` (hoy no lo pasan).

- [ ] **Step 3: Build**

Run: `npx ng build --configuration development` → OK.

- [ ] **Step 4: Commit**

```bash
git add src/app/pages/cuaquiverso/tienda/tienda.component.ts src/app/pages/cuaquiverso/tienda/tienda.component.html src/app/pages/cuaquiverso/cuaquiverso.component.* src/app/pages/cuaquiverso/personaje/
git commit -m "feat(tienda): tarjetas de productos con variantes llevan a la ficha"
```

---

### Task 13: Checkout — variante, aviso de reserva, contador, continuar y cancelar

**Files:**
- Modify: `src/app/pages/cuaquiverso/services/checkout.service.ts`, `src/app/pages/cuaquiverso/checkout/checkout.component.{ts,html,scss}`

**Interfaces:**
- Consumes: Task 9 (`leerPedidoPendiente`, `guardarPedidoPendiente`, `limpiarPedidoPendiente`, `segundosRestantes`, `formatoCuenta`), Task 6 (respuesta con `token`, `reserva_expira_en`), RPC `cancelar_pedido_pendiente`.
- Produces:
  - `CheckoutService.crearPedido(...)` devuelve `{ referencia: string; token: string; reservaExpiraEn: string; bold: BoldCheckoutConfig }`.
  - `CheckoutService.cancelarPedidoPendiente(token: string): Promise<boolean>`.
  - `PedidoItem` gana `variante_label: string | null`; `PedidoDetalle` gana `reserva_expira_en: string | null; cancelado_por_cliente: boolean`.

- [ ] **Step 1: `checkout.service.ts`**

En `items.map`: añadir `variante_id: i.varianteId ?? null`. Validación de respuesta y retorno:

```ts
    if (!data?.bold?.integritySignature || !data?.token || !data?.reserva_expira_en) {
      throw new Error('Respuesta inválida del servidor');
    }
    return {
      referencia: data.referencia,
      token: data.token,
      reservaExpiraEn: data.reserva_expira_en,
      bold: data.bold as BoldCheckoutConfig,
    };
```

Nuevo método:

```ts
  /** "Cancelar y liberar": devuelve el stock apartado de un pedido aún pendiente. */
  async cancelarPedidoPendiente(token: string): Promise<boolean> {
    const { data, error } = await this.supabase.db.rpc('cancelar_pedido_pendiente', { p_token: token });
    if (error) throw new Error('No pudimos cancelar el pedido. Intenta de nuevo.');
    return data === true;
  }
```

Tipos: `PedidoItem` añade `variante_label: string | null;`, `PedidoDetalle` añade `reserva_expira_en: string | null; cancelado_por_cliente: boolean;`.

- [ ] **Step 2: `checkout.component.ts` — estado de la reserva**

Imports de Task 9. Reemplazar `private pedidoCreado: { huella: string; bold: BoldCheckoutConfig } | null = null;` por:

```ts
  /** Pedido con stock apartado; sobrevive a recargas vía localStorage. */
  private pedidoCreado: PedidoPendiente | null = null;

  readonly segundosReserva = signal(0);
  readonly cuentaReserva   = computed(() => formatoCuenta(this.segundosReserva()));
  readonly reservaVencida  = signal(false);
  private  reloj: ReturnType<typeof setInterval> | null = null;

  private get storage(): Storage | null {
    return this.esNavegador ? (this.doc.defaultView?.localStorage ?? null) : null;
  }
```

En `ngOnInit()` al final:

```ts
    // Volvió o recargó con un pedido apartado: se retoma, no se pierde.
    const pendiente = leerPedidoPendiente(this.storage);
    if (pendiente) this.retomar(pendiente);
```

Métodos nuevos:

```ts
  private retomar(p: PedidoPendiente): void {
    this.pedidoCreado = p;
    this.referenciaEnCurso.set(p.referencia);
    this.pagoEnCurso.set(true);
    this.reservaVencida.set(false);
    this.iniciarReloj();
    this.iniciarSondeo(p.token);
  }

  private iniciarReloj(): void {
    this.detenerReloj();
    if (!this.esNavegador || !this.pedidoCreado) return;
    const tick = () => {
      const s = segundosRestantes(this.pedidoCreado!.expiraEn);
      this.segundosReserva.set(s);
      if (s <= 0) this.alVencer();
    };
    tick();
    this.reloj = setInterval(tick, 1000);
  }

  private detenerReloj(): void {
    if (this.reloj) clearInterval(this.reloj);
    this.reloj = null;
  }

  /** La reserva venció: el carrito queda intacto para volver a intentarlo. */
  private alVencer(): void {
    this.detenerReloj();
    this.detenerSondeo();
    limpiarPedidoPendiente(this.storage);
    this.pedidoCreado = null;
    this.pagoEnCurso.set(false);
    this.referenciaEnCurso.set(null);
    this.reservaVencida.set(true);
  }
```

`ngOnDestroy`: añadir `this.detenerReloj();`.

En `pagar()`, reemplazar la lógica de huella/creación:

```ts
      const huella = JSON.stringify([form, this.cart.items(), this.cart.total(), codigoDesc ?? null]);
      let bold = this.pedidoCreado?.huella === huella ? this.pedidoCreado.bold : null;

      if (!bold) {
        // Un pedido anterior con otro carrito no debe seguir apartando stock.
        if (this.pedidoCreado) {
          await this.checkout.cancelarPedidoPendiente(this.pedidoCreado.token).catch(() => false);
          limpiarPedidoPendiente(this.storage);
          this.pedidoCreado = null;
        }
        const creado = await this.checkout.crearPedido(form, this.cart.items(), this.cart.total(), codigoDesc);
        this.pedidoCreado = {
          token: creado.token, referencia: creado.referencia, expiraEn: creado.reservaExpiraEn,
          huella, bold: creado.bold,
        };
        guardarPedidoPendiente(this.storage, this.pedidoCreado);
        bold = creado.bold;
      }

      await this.bold.abrirCheckout(bold);

      this.referenciaEnCurso.set(bold.orderId);
      this.pagoEnCurso.set(true);
      this.reservaVencida.set(false);
      this.iniciarReloj();
      this.iniciarSondeo(this.pedidoCreado!.token);
```

`cancelarIntento()` pasa a liberar:

```ts
  /** "Cancelar y liberar": devuelve lo apartado y deja editar el pedido. */
  async cancelarIntento(): Promise<void> {
    const p = this.pedidoCreado;
    this.detenerSondeo();
    this.detenerReloj();
    this.pagoEnCurso.set(false);
    this.referenciaEnCurso.set(null);
    this.pedidoCreado = null;
    limpiarPedidoPendiente(this.storage);
    if (p) {
      try { await this.checkout.cancelarPedidoPendiente(p.token); }
      catch (e: any) { this.checkout.error.set(e?.message ?? 'No pudimos liberar tu reserva.'); }
    }
  }
```

En `revisarEstado`: en la rama `aprobado`, antes de navegar, `limpiarPedidoPendiente(this.storage); this.detenerReloj();`. En la rama rechazado/cancelado, añadir `limpiarPedidoPendiente(this.storage); this.detenerReloj();`.

`intervaloSondeo`: extender hasta 15 min: `if (transcurridoMs < 900_000) return 30_000;` en lugar del límite de 540_000.

- [ ] **Step 3: Template del checkout**

Antes del botón «Pagar» (buscar el botón que llama `pagar()`):

```html
@if (!pagoEnCurso()) {
  <p class="aviso-reserva">Al continuar apartamos tus productos por 15 minutos para que completes el pago.</p>
}
@if (reservaVencida()) {
  <p class="aviso-reserva is-vencida" role="status">Tu reserva venció. Tus productos siguen en el carrito: puedes intentarlo de nuevo.</p>
}
```

Dentro del bloque `@if (pagoEnCurso())` (línea ~288), encima de los botones existentes «reabrir» y «cancelar»:

```html
<p class="reserva-cuenta" role="timer" aria-live="off">
  Tu reserva vence en <b>{{ cuentaReserva() }}</b>
</p>
```

Cambiar los textos de esos botones: el de `reabrirPago()` → «Continuar pago»; el de `cancelarIntento()` → «Cancelar y liberar».

En el resumen del pedido (`checkout.component.html:200-203`), junto al nombre de cada línea: `@if (item.varianteLabel) { <span class="item-variante"> · {{ item.varianteLabel }}</span> }`, y `track claveLinea(item)` (importar y exponer `claveLinea` en el componente).

- [ ] **Step 4: Estilos** (`checkout.component.scss`)

```scss
.aviso-reserva { font-size: 13px; margin: 8px 0 12px; opacity: .8;
  &.is-vencida { opacity: 1; color: #9B1C1C; } }
.reserva-cuenta { font-size: 14px; margin: 0 0 12px; b { font-variant-numeric: tabular-nums; } }
```

- [ ] **Step 5: Build y pruebas**

Run: `npx ng build --configuration development` → OK. Run: `npx ng test --watch=false` → PASS.

- [ ] **Step 6: Commit**

```bash
git add src/app/pages/cuaquiverso/services/checkout.service.ts src/app/pages/cuaquiverso/checkout/checkout.component.*
git commit -m "feat(checkout): aviso y contador de la reserva, continuar pago y cancelar y liberar"
```

---

### Task 14: Confirmación — etiqueta de variante, contador y pago tras cancelar

**Files:**
- Modify: `src/app/pages/cuaquiverso/checkout/confirmacion/confirmacion.component.{ts,html}`

**Interfaces:**
- Consumes: `PedidoDetalle.reserva_expira_en`, `cancelado_por_cliente`, `PedidoItem.variante_label` (Task 13); Task 9 helpers.

- [ ] **Step 1: Template de ítems (línea ~159)**

```html
          @for (item of pedido()!.pedido_items; track $index) {
            …
                <div class="oi-name">{{ item.nombre }}@if (item.variante_label) { · {{ item.variante_label }} }</div>
```

- [ ] **Step 2: Contador en estado pendiente**

En el componente:

```ts
  readonly segundosReserva = signal(0);
  readonly cuentaReserva = computed(() => formatoCuenta(this.segundosReserva()));
  private reloj: ReturnType<typeof setInterval> | null = null;

  private iniciarReloj(expiraEn: string | null): void {
    if (this.reloj) clearInterval(this.reloj);
    if (!expiraEn || !this.esNavegador) return;
    const tick = () => this.segundosReserva.set(segundosRestantes(expiraEn));
    tick();
    this.reloj = setInterval(tick, 1000);
  }
```

En `aplicar(p)`: en la rama `pendiente`, `this.iniciarReloj(p.reserva_expira_en);`; en `aprobado` además `limpiarPedidoPendiente(this.esNavegador ? localStorage : null);`. En `ngOnDestroy`, limpiar `reloj`.

Rama nueva al inicio de `aplicar` para el caso «canceló y pagó igual»: si `p.estado === 'cancelado' && p.cancelado_por_cliente` y todavía no se consultó en esta visita, llamar una vez a `this.checkout.verificarPago(p.referencia, this.boldOrderId)` y recargar:

```ts
    if (p.estado === 'cancelado' && p.cancelado_por_cliente && !this.reconsultado) {
      this.reconsultado = true;
      this.checkout.verificarPago(p.referencia, this.boldOrderId).then(estado => {
        if (estado === 'aprobado') this.cargar();
      });
    }
```

(`private reconsultado = false;`).

En el template, dentro del bloque que se muestra en estado pendiente («Confirmando tu pago»), añadir:

```html
@if (segundosReserva() > 0) {
  <p class="reserva-cuenta">Tus productos siguen apartados por <b>{{ cuentaReserva() }}</b>.</p>
}
```

- [ ] **Step 3: Build**

Run: `npx ng build --configuration development` → OK.

- [ ] **Step 4: Commit**

```bash
git add src/app/pages/cuaquiverso/checkout/confirmacion/
git commit -m "feat(confirmación): variante por línea, contador de reserva y pago tras cancelar"
```

---

### Task 15: Admin — editor de variantes en el formulario de producto

**Files:**
- Create: `src/app/pages/admin/productos/variantes-editor/filas.ts`, `filas.spec.ts`, `variantes-editor.component.{ts,html,scss}`
- Modify: `src/app/pages/admin/productos/producto-form.component.{ts,html}`

**Interfaces:**
- Consumes: Task 5 (`normalizarOpciones`, `generarCombinaciones`, `claveCombinacion`, `etiquetaVariante`), Task 8 (`getVariantesAdmin`, `guardarVariantes`, `ProductoVariante`, `ProductoOpcion`).
- Produces:
  ```ts
  // filas.ts
  export interface FilaVariante { opciones: Combinacion; etiqueta: string; id: string | null;
    precio: number | null; stock: number; activo: boolean; existente: boolean }
  export function reconciliarFilas(opciones: OpcionDef[], previas: FilaVariante[], existentes: ProductoVariante[]): FilaVariante[]
  export function contarDesactivadas(existentes: ProductoVariante[], filas: FilaVariante[], orden: string[]): number
  // componente
  selector 'app-variantes-editor'; inputs: fotos: string[] (required), esEdicion: boolean;
  métodos públicos: cargar(opciones: ProductoOpcion[], variantes: ProductoVariante[]): void;
    payload(): { opciones: OpcionDef[]; variantes: { opciones: Combinacion; precio: number | null; stock_inicial: number; activo: boolean }[] };
    activo(): boolean; desactivadas(): number; error(): string | null
  ```

- [ ] **Step 1: Pruebas de `filas.ts`**

```ts
// src/app/pages/admin/productos/variantes-editor/filas.spec.ts
import { contarDesactivadas, reconciliarFilas } from './filas';

const v = (valor: string) => ({ valor, foto_url: null });
const EXISTENTES = [
  { id: 'sn', producto_id: 'p', opciones: { Talla: 'S', Color: 'Negro' }, precio: null, stock_actual: 3, activo: true, posicion: 0 },
  { id: 'sr', producto_id: 'p', opciones: { Talla: 'S', Color: 'Rosa' }, precio: 9, stock_actual: 1, activo: true, posicion: 1 },
];

describe('reconciliarFilas', () => {
  it('conserva stock/precio/id de las combinaciones existentes y crea las nuevas en 0', () => {
    const filas = reconciliarFilas(
      [{ nombre: 'Talla', valores: [v('S'), v('M')] }, { nombre: 'Color', valores: [v('Negro')] }],
      [], EXISTENTES);
    expect(filas.map(f => [f.etiqueta, f.id, f.stock, f.existente])).toEqual([
      ['S · Negro', 'sn', 3, true],
      ['M · Negro', null, 0, false],
    ]);
  });

  it('conserva lo que el admin ya escribió en filas nuevas al añadir otro valor', () => {
    const previas = reconciliarFilas([{ nombre: 'Talla', valores: [v('M')] }], [], []);
    previas[0].stock = 7; previas[0].precio = 60000;
    const filas = reconciliarFilas([{ nombre: 'Talla', valores: [v('M'), v('L')] }], previas, []);
    expect(filas.map(f => [f.etiqueta, f.stock, f.precio])).toEqual([['M', 7, 60000], ['L', 0, null]]);
  });
});

describe('contarDesactivadas', () => {
  it('cuenta las existentes activas que ya no están en las filas', () => {
    const filas = reconciliarFilas([{ nombre: 'Talla', valores: [v('S')] }, { nombre: 'Color', valores: [v('Negro')] }], [], EXISTENTES);
    expect(contarDesactivadas(EXISTENTES, filas, ['Talla', 'Color'])).toBe(1);
  });
});
```

- [ ] **Step 2: Correr para verificar que falla**

Run: `npx ng test --watch=false --include='src/app/pages/admin/productos/variantes-editor/filas.spec.ts'` → FAIL.

- [ ] **Step 3: Implementar `filas.ts`**

```ts
// src/app/pages/admin/productos/variantes-editor/filas.ts
//
// Filas de la tabla de combinaciones del admin. Al tocar las opciones la tabla
// se regenera, pero lo que ya existía (id, stock, precio) y lo que el admin ya
// escribió en filas nuevas no se puede perder.
import {
  Combinacion, OpcionDef, claveCombinacion, etiquetaVariante, generarCombinaciones,
} from '../../../../../../supabase/functions/_shared/variantes';
import { ProductoVariante } from '../../../../core/services/inventario.service';

export interface FilaVariante {
  opciones: Combinacion;
  etiqueta: string;
  id: string | null;
  precio: number | null;
  /** Existentes: stock actual (sólo lectura). Nuevas: stock inicial editable. */
  stock: number;
  activo: boolean;
  existente: boolean;
}

export function reconciliarFilas(
  opciones: OpcionDef[],
  previas: FilaVariante[],
  existentes: ProductoVariante[],
): FilaVariante[] {
  const orden = opciones.map(o => o.nombre);
  const porClave = <T extends { opciones: Combinacion }>(xs: T[]) =>
    new Map(xs.map(x => [claveCombinacion(x.opciones, orden), x]));
  const prev = porClave(previas);
  const exist = porClave(existentes);

  return generarCombinaciones(opciones).map(c => {
    const k = claveCombinacion(c, orden);
    const e = exist.get(k);
    const p = prev.get(k);
    return {
      opciones: c,
      etiqueta: etiquetaVariante(c, orden),
      id: e?.id ?? null,
      precio: p ? p.precio : (e?.precio ?? null),
      stock: e ? e.stock_actual : (p?.stock ?? 0),
      activo: p ? p.activo : (e?.activo ?? true),
      existente: !!e,
    };
  });
}

export function contarDesactivadas(existentes: ProductoVariante[], filas: FilaVariante[], orden: string[]): number {
  const claves = new Set(filas.map(f => claveCombinacion(f.opciones, orden)));
  return existentes.filter(e => e.activo && !claves.has(claveCombinacion(e.opciones, orden))).length;
}
```

- [ ] **Step 4: Correr las pruebas**

Run: `npx ng test --watch=false --include='src/app/pages/admin/productos/variantes-editor/filas.spec.ts'` → PASS.

- [ ] **Step 5: Componente editor**

```ts
// src/app/pages/admin/productos/variantes-editor/variantes-editor.component.ts
import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { OpcionDef, normalizarOpciones } from '../../../../../../supabase/functions/_shared/variantes';
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

  readonly desactivadas = computed(() =>
    contarDesactivadas(this.existentes, this.activo() ? this.filas() : [],
      this.opciones().map(o => o.nombre)));

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

  payload() {
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
```

Template `variantes-editor.component.html` (usar las clases de panel/inputs que ya usa `producto-form.component.html`; revisar sus nombres antes de escribir):

```html
<div class="section-sep"></div>
<label class="toggle-row">
  <input type="checkbox" [checked]="activo()" (change)="alternar($any($event.target).checked)" />
  <span>Este producto tiene variantes <small>(talla, color, tamaño…)</small></span>
</label>

@if (activo()) {
  @for (op of opciones(); track $index; let i = $index) {
    <div class="ve-opcion">
      <div class="ve-opcion-h">
        <input class="ve-nombre" placeholder="Nombre de la opción (ej. Talla)" maxlength="30"
               [ngModel]="op.nombre" (ngModelChange)="renombrarOpcion(i, $event)" />
        <button type="button" class="btn-link" (click)="quitarOpcion(i)">Quitar</button>
      </div>
      <div class="ve-valores">
        @for (val of op.valores; track val.valor; let k = $index) {
          <span class="ve-chip">
            @if (val.foto_url) { <img [src]="val.foto_url" alt="" /> }
            {{ val.valor }}
            <button type="button" aria-label="Mover a la izquierda" (click)="moverValor(i, k, -1)">‹</button>
            <button type="button" aria-label="Mover a la derecha" (click)="moverValor(i, k, 1)">›</button>
            <button type="button" [attr.aria-label]="'Foto para ' + val.valor"
                    (click)="fotoAbierta.set({ op: i, val: k })">📷</button>
            <button type="button" [attr.aria-label]="'Quitar ' + val.valor" (click)="quitarValor(i, k)">×</button>
          </span>
        }
        <input class="ve-nuevo" placeholder="Escribe un valor y pulsa Enter" maxlength="30"
               [(ngModel)]="nuevoValor[i]" (keydown.enter)="$event.preventDefault(); agregarValor(i)" />
      </div>
      @if (fotoAbierta()?.op === i) {
        <div class="ve-fotos" role="listbox" aria-label="Elegir foto">
          <button type="button" (click)="asignarFoto(i, fotoAbierta()!.val, null)">Sin foto</button>
          @for (f of fotos(); track f) {
            <button type="button" (click)="asignarFoto(i, fotoAbierta()!.val, f)"><img [src]="f" alt="" /></button>
          }
          @if (fotos().length === 0) { <small>Guarda primero las fotos del producto para poder asignarlas.</small> }
        </div>
      }
    </div>
  }
  @if (opciones().length < maxOpciones) {
    <button type="button" class="btn-link" (click)="agregarOpcion()">+ Agregar opción</button>
  }

  @if (filas().length > 0) {
    <table class="ve-tabla">
      <thead><tr><th>Combinación</th><th>Precio</th><th>{{ esEdicion() ? 'Stock' : 'Stock inicial' }}</th><th>Activa</th></tr></thead>
      <tbody>
        @for (f of filas(); track f.etiqueta; let j = $index) {
          <tr [class.is-off]="!f.activo">
            <td>{{ f.etiqueta }}</td>
            <td><input type="number" min="1" placeholder="Precio del producto"
                       [ngModel]="f.precio" (ngModelChange)="editarFila(j, { precio: $event })" /></td>
            <td>
              @if (f.existente) { {{ f.stock }} <small>(reabastece o ajusta desde la lista)</small> }
              @else { <input type="number" min="0" [ngModel]="f.stock" (ngModelChange)="editarFila(j, { stock: $event ?? 0 })" /> }
            </td>
            <td><input type="checkbox" [checked]="f.activo" (change)="editarFila(j, { activo: $any($event.target).checked })" /></td>
          </tr>
        }
      </tbody>
    </table>
    <div class="ve-masivo">
      <button type="button" class="btn-link" (click)="aplicarATodas('precio', filas()[0].precio)">Poner el precio de la primera a todas</button>
      <button type="button" class="btn-link" (click)="aplicarATodas('stock', filas()[0].stock)">Poner el stock de la primera a todas las nuevas</button>
    </div>
  }
  @if (desactivadas() > 0) {
    <p class="ve-aviso" role="status">Al guardar se desactivarán {{ desactivadas() }} combinación(es) que ya no existen. Su historial se conserva.</p>
  }
  @if (error()) { <p class="field-error">{{ error() }}</p> }
}
```

`variantes-editor.component.scss`: estilos mínimos para `.ve-opcion`, `.ve-valores` (flex wrap, gap 6px), `.ve-chip` (pill con borde, img 20px redonda), `.ve-fotos img` (48px), `.ve-tabla` (100% ancho, inputs 100px; en móvil `display:block; overflow-x:auto`), `.is-off { opacity:.5 }`, `.ve-aviso` (color de advertencia existente).

- [ ] **Step 6: Integración en `producto-form.component`**

TS:

```ts
import { VariantesEditorComponent } from './variantes-editor/variantes-editor.component';
// imports: [CommonModule, ReactiveFormsModule, FormsModule, VariantesEditorComponent]
  private readonly editor = viewChild(VariantesEditorComponent);
  /** Fotos ya guardadas: las únicas que se pueden asignar a un valor. */
  readonly fotosGuardadas = computed(() => {
    const g = this.galeria();
    return [this.coverPreview(), ...g.existentes].filter((u): u is string => !!u && !u.startsWith('blob:'));
  });
```

(`viewChild` de `@angular/core`.) En `ngOnInit`, dentro de la rama de edición tras `patchValue`:

```ts
    const { opciones, variantes } = await this.inv.getVariantesAdmin(id);
    this.editor()?.cargar(opciones, variantes);
```

(si `editor()` aún no existe por el ciclo de vida, guardar el resultado en una propiedad y cargarlo en `ngAfterViewInit`).

En `guardar()`:
- Antes de `this.guardando.set(true)`: `const ed = this.editor(); if (ed?.error()) { this.errorMsg.set(ed.error()); return; }` y si `ed?.desactivadas()` > 0, pedir confirmación con un aviso en la UI (`this.confirmarDesactivar` signal + segundo clic en Guardar), no `window.confirm`.
- Si el editor está activo al crear: `stock_inicial` del producto = 0 (`this.asegurarId(datos, ed?.activo() ? 0 : v.stock_inicial ?? 0)`).
- Después de `updateProducto` exitoso y antes de navegar:

```ts
      if (ed && (ed.activo() || this.teniaVariantes)) {
        const { opciones, variantes } = ed.payload();
        const { error: vErr } = await this.inv.guardarVariantes(id, opciones, variantes);
        if (vErr) { this.errorMsg.set(`El producto se guardó, pero las variantes no: ${vErr}`); return; }
        await this.inv.cargarTodos();
      }
```

  (`private teniaVariantes = false;` se fija en `ngOnInit` a `variantes.some(v => v.activo)`.)

HTML: en `producto-form.component.html`, después del bloque de precio/stock (antes de «Apariencia en tienda», línea ~143):

```html
<app-variantes-editor [fotos]="fotosGuardadas()" [esEdicion]="isEdit()" />
```

y ocultar el campo `stock_inicial` cuando `editor()?.activo()`: envolver su contenedor con `@if (!editor()?.activo()) { … }`.

- [ ] **Step 7: Build y pruebas**

Run: `npx ng build --configuration development` → OK. Run: `npx ng test --watch=false` → PASS.

- [ ] **Step 8: Commit**

```bash
git add src/app/pages/admin/productos/variantes-editor/ src/app/pages/admin/productos/producto-form.component.*
git commit -m "feat(admin): editor de opciones y combinaciones en el formulario de producto"
```

---

### Task 16: Admin — lista de productos y reporte de ventas

**Files:**
- Modify: `src/app/pages/admin/productos/productos-list.component.{ts,html}`, `src/app/pages/admin/productos/ventas-general.component.{ts,html}`

**Interfaces:**
- Consumes: `getVariantesAdmin`, `restockProducto(…, varianteId)`, `ajustarStock(…, varianteId)`, `getHistorialProducto(id, varianteId)`, `VentaEvento.producto_variantes` (Task 8); `etiquetaVariante` (Task 5).

- [ ] **Step 1: Cargar variantes para la lista**

En `productos-list.component.ts`:

```ts
  /** Variantes por producto (todas), para el badge y el drawer por combinación. */
  readonly variantesPorProducto = signal<Map<string, { orden: string[]; variantes: ProductoVariante[] }>>(new Map());

  private async cargarVariantes(): Promise<void> {
    const { data: ops } = await this.sb.db.from('producto_opciones').select('producto_id, nombre, posicion');
    const { data: vars } = await this.sb.db.from('producto_variantes').select('*').order('posicion');
    const m = new Map<string, { orden: string[]; variantes: ProductoVariante[] }>();
    for (const v of (vars ?? []) as ProductoVariante[]) {
      if (!m.has(v.producto_id)) m.set(v.producto_id, { orden: [], variantes: [] });
      m.get(v.producto_id)!.variantes.push(v);
    }
    for (const o of ((ops ?? []) as { producto_id: string; nombre: string; posicion: number }[])
         .sort((a, b) => a.posicion - b.posicion)) {
      m.get(o.producto_id)?.orden.push(o.nombre);
    }
    this.variantesPorProducto.set(m);
  }

  activasDe(id: string): ProductoVariante[] {
    return this.variantesPorProducto().get(id)?.variantes.filter(v => v.activo) ?? [];
  }

  etiqueta(id: string, v: ProductoVariante): string {
    return etiquetaVariante(v.opciones, this.variantesPorProducto().get(id)?.orden ?? Object.keys(v.opciones));
  }
```

Mejor: mover estas dos consultas a `InventarioService.getVariantesTodas()` (mismo cuerpo) para no inyectar Supabase en el componente, y llamarla desde el `ngOnInit` del componente junto a `cargarTodos()`, y de nuevo tras restock/ajuste/duplicar.

- [ ] **Step 2: Badge**

En la fila/tarjeta de producto de `productos-list.component.html`, junto al stock:

```html
@if (activasDe(p.id).length > 0) {
  <span class="badge-variantes">{{ activasDe(p.id).length }} variantes</span>
}
```

- [ ] **Step 3: Restock/ajuste/historial por combinación**

Añadir `readonly varianteTarget = signal<ProductoVariante | null>(null);`. En el drawer de stock (html:124-168), cuando el producto tiene variantes activas, renderizar una lista de combinaciones antes de los botones:

```html
@if (activasDe(p.id).length > 0) {
  <ul class="stock-variantes">
    @for (v of activasDe(p.id); track v.id) {
      <li [class.is-sel]="varianteTarget()?.id === v.id">
        <span>{{ etiqueta(p.id, v) }}</span><b>{{ v.stock_actual }}</b>
        <button type="button" (click)="abrirRestock(p, v)">Reabastecer</button>
        <button type="button" (click)="abrirAjuste(p, v)">Ajustar</button>
        <button type="button" (click)="verHistorial(p, v)">Historial</button>
      </li>
    }
  </ul>
} @else { <!-- botones actuales sin cambios --> }
```

Adaptar los métodos existentes (`abrirRestock`, `abrirAjuste`, el que carga historial — ver líneas 187-268) para aceptar un segundo parámetro opcional `v: ProductoVariante | null = null` que fija `varianteTarget`, y en las llamadas al servicio pasar `this.varianteTarget()?.id ?? null`. `ajusteDelta` debe restar contra `varianteTarget()?.stock_actual ?? ajusteTarget()?.stock_actual`. Al cerrar los modales, `varianteTarget.set(null)`. El título del modal: `{{ ajusteTarget()?.nombre }}@if (varianteTarget()) { · {{ etiqueta(ajusteTarget()!.id, varianteTarget()!) }} }`.

- [ ] **Step 4: Reporte de ventas**

En `ventas-general.component.html`, donde se imprime el nombre del producto de una venta:

```html
{{ v.productos_evento?.nombre }}@if (v.producto_variantes) { · {{ etiquetaVenta(v) }} }
```

con, en el `.ts`:

```ts
  etiquetaVenta(v: VentaEvento): string {
    return v.producto_variantes ? Object.values(v.producto_variantes.opciones).join(' · ') : '';
  }
```

(Aquí no hay orden de opciones cargado; `Object.values` respeta el orden de inserción del JSON guardado por `guardar_variantes`, que es el de las opciones.) Si el reporte exporta a Excel (`xlsx`), añadir la misma etiqueta a la columna de producto.

- [ ] **Step 5: Build y verificación**

Run: `npx ng build --configuration development` → OK. Run: `npx ng test --watch=false` → PASS.

- [ ] **Step 6: Commit**

```bash
git add src/app/pages/admin/productos/productos-list.component.* src/app/pages/admin/productos/ventas-general.component.* src/app/core/services/inventario.service.ts
git commit -m "feat(admin): stock e historial por combinación y variante en el reporte de ventas"
```

---

### Task 17: POS — venta por combinación

**Files:**
- Modify: `pos/index.html`

**Interfaces:**
- Consumes: tabla `producto_variantes` (lectura POS por RLS de Task 2), `producto_opciones` (lectura pública si el producto está activo), RPC `stock_disponible`, `decrementar_stock_seguro(p_producto_id, p_cantidad, p_variante_id)`.

- [ ] **Step 1: Cargar variantes y reservas**

Junto a `let products = []`, declarar `let variantsByProduct = {}; let optionOrder = {}; let reservedByVariant = {}; let selectedVariant = null;`.

En `loadProducts()`, tras `products = data || [];`:

```js
      const ids = products.map(p => p.id);
      const [varRes, opRes, dispRes] = await Promise.all([
        sb.from('producto_variantes').select('*').in('producto_id', ids).eq('activo', true).order('posicion'),
        sb.from('producto_opciones').select('producto_id, nombre, posicion').in('producto_id', ids).order('posicion'),
        sb.rpc('stock_disponible', { p_producto_ids: ids }),
      ]);
      variantsByProduct = {};
      (varRes.data || []).forEach(v => (variantsByProduct[v.producto_id] ||= []).push(v));
      optionOrder = {};
      (opRes.data || []).forEach(o => (optionOrder[o.producto_id] ||= []).push(o.nombre));
      // Reservadas en web = físico − disponible (sólo informativo: el POS vende del físico).
      reservedByVariant = {};
      (dispRes.data || []).forEach(r => {
        const fisico = r.variante_id
          ? (varRes.data || []).find(v => v.id === r.variante_id)?.stock_actual
          : products.find(p => p.id === r.producto_id)?.stock_actual;
        reservedByVariant[r.variante_id || r.producto_id] = Math.max(0, (fisico ?? 0) - r.disponible);
      });
```

Helper:

```js
  function variantLabel(v) {
    const order = optionOrder[v.producto_id] || Object.keys(v.opciones);
    return order.map(n => v.opciones[n]).filter(Boolean).join(' · ');
  }
```

Realtime: en `subscribeRealtime`, encadenar un segundo `.on('postgres_changes', { event: '*', schema: 'public', table: 'producto_variantes' }, () => loadProducts())` antes de `.subscribe()`.

- [ ] **Step 2: Selector de combinación en el modal**

En el HTML del modal de venta (`id="sale-modal"`), justo debajo de `modal-product-stock`, añadir `<div id="modal-variants" class="variant-grid" hidden></div>`. CSS (en el `<style>` del archivo): `.variant-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:8px;margin:12px 0}.variant-btn{min-height:56px;border-radius:12px;border:2px solid #D4DCE4;background:#fff;font:inherit;font-weight:600}.variant-btn.sel{border-color:#151F28;background:#151F28;color:#fff}.variant-btn:disabled{opacity:.35}.variant-btn small{display:block;font-weight:400}`.

Reemplazar `openSaleModal`:

```js
  window.openSaleModal = function(productId) {
    selectedProduct = products.find(p => p.id === productId);
    if (!selectedProduct || selectedProduct.stock_actual <= 0) return;
    selectedVariant = null;
    currentQty = 1;
    const variants = variantsByProduct[productId] || [];
    const box = document.getElementById('modal-variants');
    document.getElementById('modal-product-name').textContent = selectedProduct.nombre;

    if (variants.length > 0) {
      box.hidden = false;
      box.innerHTML = variants.map(v => {
        const res = reservedByVariant[v.id] || 0;
        return `<button type="button" class="variant-btn" data-id="${v.id}" ${v.stock_actual <= 0 ? 'disabled' : ''}
                  onclick="selectVariant('${v.id}')">${escapeHtml(variantLabel(v))}
                  <small>${v.stock_actual} disp.${res ? ` · ${res} reservada${res > 1 ? 's' : ''} en web` : ''}</small></button>`;
      }).join('');
      document.getElementById('modal-product-stock').textContent = 'Elige la combinación';
      document.getElementById('confirm-sale-btn').disabled = true;
    } else {
      box.hidden = true;
      box.innerHTML = '';
      const res = reservedByVariant[productId] || 0;
      document.getElementById('modal-product-stock').innerHTML =
        `Stock disponible: <b>${selectedProduct.stock_actual}</b>${res ? ` · ${res} reservada${res > 1 ? 's' : ''} en web` : ''}`;
      document.getElementById('confirm-sale-btn').disabled = false;
    }
    document.getElementById('modal-qty').value = 1;
    document.getElementById('modal-total').textContent = formatCOP(unitPrice());
    document.getElementById('confirm-sale-btn').textContent = 'Registrar venta';
    refreshQtyControls();
    document.getElementById('sale-modal').classList.add('open');
  };

  function unitPrice() {
    return selectedVariant?.precio ?? selectedProduct?.precio ?? 0;
  }
  function maxQty() {
    return selectedVariant ? selectedVariant.stock_actual : selectedProduct.stock_actual;
  }

  window.selectVariant = function(id) {
    selectedVariant = (variantsByProduct[selectedProduct.id] || []).find(v => v.id === id) || null;
    document.querySelectorAll('#modal-variants .variant-btn').forEach(b => b.classList.toggle('sel', b.dataset.id === id));
    currentQty = 1;
    document.getElementById('modal-qty').value = 1;
    document.getElementById('modal-product-stock').innerHTML = `Stock de ${escapeHtml(variantLabel(selectedVariant))}: <b>${selectedVariant.stock_actual}</b>`;
    document.getElementById('modal-total').textContent = formatCOP(unitPrice());
    document.getElementById('confirm-sale-btn').disabled = false;
    refreshQtyControls();
  };
```

Si `escapeHtml` no existe en el archivo, añadir: `function escapeHtml(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}`.

En `refreshQtyControls` y `changeQty`, reemplazar `selectedProduct.stock_actual` por `maxQty()` y `selectedProduct.precio` por `unitPrice()`. En `closeModal`, `selectedVariant = null;`.

- [ ] **Step 3: Registrar la venta con variante (online y offline)**

En `confirmSale`: `if (!selectedProduct || currentQty < 1) return; if ((variantsByProduct[selectedProduct.id] || []).length && !selectedVariant) return;`. Capturar `const soldVariant = selectedVariant;` y `const lineTotal = unitPrice() * soldQty;`. En `saleRecord` añadir `variante_id: soldVariant?.id ?? null`. En la llamada RPC añadir `p_variante_id: soldVariant?.id ?? null`. En la actualización optimista, si hay variante: `soldVariant.stock_actual = Math.max(0, soldVariant.stock_actual - soldQty);` además del producto. En la rama offline (el objeto que se encola), incluir `variante_id: soldVariant?.id ?? null`.

En `syncOfflineQueue`: en el insert añadir `variante_id: item.variante_id ?? null` y en la RPC `p_variante_id: item.variante_id ?? null`. (Entradas viejas sin `variante_id` → null → comportamiento de siempre.)

- [ ] **Step 4: Verificación manual en headless** (se hace en Task 18)

- [ ] **Step 5: Commit**

```bash
git add pos/index.html
git commit -m "feat(pos): venta por combinación con aviso de reservas web"
```

---

### Task 18: Verificación en vivo y despliegue final de funciones

**Files:** ninguno nuevo (puede requerir fixes puntuales).

- [ ] **Step 1: Suite completa y build de producción**

Run: `npx ng test --watch=false` → PASS. Run: `npx ng build` → OK.

- [ ] **Step 2: Levantar la app local**

Run (background): `npx ng serve --port 4300 --no-hmr`. Esperar "Local: http://localhost:4300".

- [ ] **Step 3: Crear un producto de prueba con variantes desde el admin (Chrome headless en este equipo)**

Con Chrome headless (Puppeteer/Playwright vía `npx`, script en `$CLAUDE_JOB_DIR/tmp/`), iniciar sesión en `/admin` con la cuenta que indique el usuario (pedírsela si no hay sesión), crear «PRUEBA variantes» con Talla S/M × Color Negro/Rosa, stock 1 en M·Negro, precio 55.000 en M·Rosa, asignar una foto a Rosa, **inactivo en tienda NO**: debe estar activo para probar la ficha. Captura de pantalla de la tabla de combinaciones.

- [ ] **Step 4: Ficha y carrito**

En `/cuaquiverso/tienda/<id>`: verificar (capturas) que el precio dice «Desde $…», que al elegir Rosa cambia la foto, que S·Negro (stock 0) aparece tachado, que el botón dice «Elige talla» hasta completar la selección, y que M·Negro + M·Rosa quedan como dos líneas en el carrito con su etiqueta.

- [ ] **Step 5: Reserva sin pagar**

Ir al checkout con M·Negro (stock 1), llenar datos de prueba y pulsar Pagar. Cerrar el modal de Bold sin pagar. Verificar: contador «Tu reserva vence en 14:xx»; recargar → contador sigue; en otra pestaña la ficha muestra M·Negro tachado; `stock_disponible` vía SQL devuelve 0 para esa variante. Pulsar «Cancelar y liberar» → la ficha vuelve a ofrecer M·Negro. Verificar por SQL que el pedido quedó `cancelado` con `cancelado_por_cliente = true` y sin reservas.

- [ ] **Step 6: Rechazo de variante sin stock**

Con dos contextos de navegador: ambos agregan M·Negro; el primero pulsa Pagar (reserva); el segundo pulsa Pagar → debe ver «"PRUEBA variantes · M · Negro" se agotó mientras comprabas…». Cancelar y liberar el primero.

- [ ] **Step 7: POS**

Abrir `pos/index.html` (servirlo con `npx http-server pos -p 4400` si hace falta), iniciar sesión de operador, tocar «PRUEBA variantes»: aparece el selector de combinaciones; vender 1 de M·Rosa; verificar por SQL `ventas_evento.variante_id` y stock de esa variante −1.

- [ ] **Step 8: Limpiar datos de prueba**

Por SQL: desactivar (`activo = false`) el producto «PRUEBA variantes» y cancelar sus pedidos de prueba. No borrar ventas registradas; avisar al usuario de la venta de prueba en el POS para que decida si ajusta el stock.

- [ ] **Step 9: Reportar**

Resumen al usuario con capturas, commits y lo pendiente: **publicar el hosting** (sólo si lo pide) y confirmar en producción que Bold acepta reabrir el modal con la misma referencia («Continuar pago»). Si Bold lo rechaza, el plan B de la spec (cancelar y crear pedido nuevo con el mismo carrito) se implementa como tarea aparte.
