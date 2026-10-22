-- ============================================================================
-- 0012 · Reunión mensual y puntaje de salud
--
-- 1. DECISIONES: lo que la pareja acuerda en la reunión de cada mes. Una
--    fila por decisión (no un texto único) para que los dos puedan escribir
--    a la vez sin pisarse y marcar cumplidas en vivo. `origen` guarda el id
--    de la sugerencia de la app cuando la decisión nació de ahí.
--
-- 2. PUNTAJE en el cierre de mes: el puntaje de salud financiera (0–100)
--    que tenía el hogar al cerrar, para ver su evolución en el histórico.
--    Lo calcula la aplicación con el mismo motor que muestra en pantalla.
--
-- Es aditiva: no borra ni transforma datos.
-- ============================================================================

create table if not exists public.decisiones (
  id           uuid primary key default gen_random_uuid(),
  hogar_id     uuid not null references public.hogares on delete cascade,
  periodo      date not null,                   -- día 1 del mes de la reunión
  texto        text not null default '',
  responsable  uuid references auth.users on delete set null,
  cumplida     boolean not null default false,
  origen       text,
  orden        int not null default 0,
  creado_en    timestamptz not null default now()
);

create index if not exists decisiones_hogar_periodo_idx on public.decisiones (hogar_id, periodo);

alter table public.decisiones enable row level security;
drop policy if exists decisiones_todo on public.decisiones;
create policy decisiones_todo on public.decisiones for all to authenticated
  using (public.es_miembro(hogar_id))
  with check (public.es_miembro(hogar_id));

alter table public.decisiones replica identity full;
do $$
begin
  alter publication supabase_realtime add table public.decisiones;
exception when duplicate_object then
  null;  -- ya estaba publicada
end $$;

alter table public.cierres_mensuales
  add column if not exists puntaje smallint check (puntaje between 0 and 100);
