-- ============================================================================
-- 0015 · Fijos del mes
--
-- Los gastos fijos del presupuesto pasan a servir de plantilla: cada mes la
-- app arma la lista de los que tocan y se registran como movimientos con un
-- clic, en vez de digitarlos uno por uno.
--
-- 1. DÍA DE PAGO en los gastos del presupuesto: con él, el movimiento sale
--    con la fecha en que de verdad se paga y la lista se ordena por fecha.
--
-- 2. GASTO_ID en los movimientos: de qué gasto fijo salió cada movimiento.
--    Así la app sabe cuáles ya se registraron ese mes y no los duplica. Si el
--    gasto se borra del presupuesto, el movimiento se queda (es plata que sí
--    salió) y solo pierde el vínculo.
--
-- Es aditiva: no borra ni transforma datos. Las políticas RLS de las dos
-- tablas ya cubren las columnas nuevas.
-- ============================================================================

alter table public.gastos_presupuesto
  add column if not exists dia_pago smallint check (dia_pago between 1 and 31);

alter table public.movimientos
  add column if not exists gasto_id uuid
    references public.gastos_presupuesto (id) on delete set null;

create index if not exists movimientos_gasto_idx
  on public.movimientos (gasto_id)
  where gasto_id is not null;
