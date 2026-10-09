-- supabase/migrations/024_ruleta_rondas.sql
-- «Reiniciar el juego» desde el admin. El turno gastado se guarda en el
-- localStorage de cada visitante, así que el estudio no puede borrarlo a
-- distancia. En su lugar se numera la ronda: cada quien recuerda en cuál jugó
-- y, al abrir una ronda nueva, ese recuerdo deja de coincidir y todos vuelven
-- a tener turno, en cualquier navegador y sin borrar nada.

alter table public.ruleta_config
  add column if not exists ronda integer not null default 1;

-- El incremento va en una función para que sea atómico: PostgREST solo sabe
-- escribir valores literales, y leer-y-sumar desde el cliente se pisa si hay
-- dos personas en el admin.
create or replace function public.ruleta_nueva_ronda()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  nueva integer;
begin
  if not public.is_admin() then
    raise exception 'no autorizado';
  end if;

  update public.ruleta_config
     set ronda = ronda + 1,
         actualizado_en = now()
   where id = 'default'
  returning ronda into nueva;

  return nueva;
end;
$$;

revoke all on function public.ruleta_nueva_ronda() from public;
grant execute on function public.ruleta_nueva_ronda() to authenticated;
