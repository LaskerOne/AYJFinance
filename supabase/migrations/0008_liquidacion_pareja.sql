-- ============================================================================
-- 0008 · Liquidación del bote entre la pareja
--
-- 1. Un movimiento puede ser una TRANSFERENCIA entre los dos: la plata que
--    uno le pasa al otro para saldar el bote común. No es gasto ni ingreso
--    del hogar, así que todo lo que suma (incluido cerrar_mes) la ignora
--    sin cambios, porque ya filtra por clase = 'gasto' / 'ingreso'.
--    pagado_por = quien envía; quien recibe es la otra persona.
--
-- 2. Una deuda puede ser CON LA PAREJA (un préstamo entre ustedes). Se sigue
--    tratando como cualquier deuda en el plan de pagos, y además aparece en
--    la liquidación como "lo que se deben entre los dos".
--
-- Es aditiva: no borra ni transforma datos.
-- ============================================================================

alter table public.movimientos drop constraint if exists movimientos_clase_check;
alter table public.movimientos
  add constraint movimientos_clase_check
  check (clase in ('gasto', 'ingreso', 'transferencia'));

alter table public.deudas
  add column if not exists con_pareja boolean not null default false;
