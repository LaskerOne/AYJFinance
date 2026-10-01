-- ============================================================================
--  Gastos extraordinarios
--
--  Una compra puntual —unos intercomunicadores, un electrodoméstico, una
--  reparación— no es gasto corriente, pero hoy se suma igual al mes y hace
--  ver como descontrolado un presupuesto que estaba bien. Marcarla permite
--  compararla aparte en vez de mezclarla con lo que sí se repite.
--
--  Sigue contando como dinero que salió: lo que cambia es contra qué se mide.
-- ============================================================================

alter table public.movimientos
  add column if not exists extraordinario boolean not null default false;

comment on column public.movimientos.extraordinario is
  'Compra puntual que no se repite: suma al gasto del mes pero no se compara contra el presupuesto.';

create index if not exists movimientos_extraordinario_idx
  on public.movimientos (hogar_id, fecha)
  where extraordinario;
