-- ============================================================================
-- 0018 · Un pago agregado al mes no es extraordinario por defecto
--
-- En 0017 todo pago agregado a la lista del mes se registraba como
-- extraordinario. Pero la mayoría son pagos normales que tocan este mes
-- (el mercado que se pagó aparte, el servicio que llegó tarde): sacarlos de
-- la comparación contra el presupuesto escondía gasto corriente. Ahora es
-- una casilla al agregarlo, apagada salvo que la marquen.
--
-- Los pagos ya registrados desde la lista nunca tuvieron esa opción, así que
-- se devuelven a corrientes. El que de verdad fuera extra se vuelve a marcar.
-- Las RLS de pendientes_mes y movimientos no cambian: la columna nueva
-- hereda las políticas de su tabla.
-- ============================================================================

alter table public.pendientes_mes
  add column if not exists extraordinario boolean not null default false;

comment on column public.pendientes_mes.extraordinario is
  'Si al registrarlo el movimiento va como extraordinario (fuera de la comparación con el presupuesto).';

update public.movimientos
   set extraordinario = false
 where pendiente_id is not null
   and extraordinario;
