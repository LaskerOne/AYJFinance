-- ============================================================================
-- 0017 · Pendientes del mes
--
-- La lista de "Pagos fijos del mes" (migración 0015) sale del presupuesto.
-- Esta tabla guarda los pagos EXTRA de un mes concreto: lo que resultó este
-- mes y hay que pagar, pero no es un gasto fijo del presupuesto (el uniforme
-- del colegio, la matrícula, el regalo). Se anotan desde la misma lista y se
-- registran igual, con un clic.
--
-- El vínculo va en los movimientos (pendiente_id, como gasto_id en 0015):
-- un pendiente está pagado cuando un movimiento lo referencia. Si el
-- pendiente se borra, el movimiento queda (es plata que salió).
--
-- Es aditiva: no borra ni transforma datos.
-- ============================================================================

create table if not exists public.pendientes_mes (
  id          uuid primary key default gen_random_uuid(),
  hogar_id    uuid not null references public.hogares on delete cascade,
  periodo     date not null,                -- primer día del mes al que pertenece
  concepto    text not null default '',
  categoria   text not null default 'Otros'
                check (categoria = any (public.categorias_validas())),
  monto       numeric(14,2) not null default 0,
  usuario_id  uuid references auth.users on delete set null,  -- null = del bote
  creado_en   timestamptz not null default now()
);

create index if not exists pendientes_mes_hogar_idx
  on public.pendientes_mes (hogar_id, periodo);

alter table public.pendientes_mes enable row level security;
drop policy if exists pendientes_mes_todo on public.pendientes_mes;
create policy pendientes_mes_todo on public.pendientes_mes for all to authenticated
  using (public.es_miembro(hogar_id))
  with check (public.es_miembro(hogar_id));

alter table public.pendientes_mes replica identity full;
do $$
begin
  alter publication supabase_realtime add table public.pendientes_mes;
exception when duplicate_object then
  null;  -- ya estaba publicada
end $$;

alter table public.movimientos
  add column if not exists pendiente_id uuid
    references public.pendientes_mes (id) on delete set null;

create index if not exists movimientos_pendiente_idx
  on public.movimientos (pendiente_id)
  where pendiente_id is not null;
