-- ============================================================================
-- 0009 · Proyección a 12 meses
--
-- 1. MES DE PAGO para gastos e ingresos que no son mensuales. Un gasto anual
--    de $1.200.000 ya cuenta como $100.000 al mes en el presupuesto, pero
--    sale de la cuenta de un golpe en un mes concreto. Con el mes de pago la
--    proyección sabe cuándo pega cada uno:
--      · anual      → solo ese mes
--      · semestral  → ese mes y seis después
--      · trimestral → cada tres meses desde ese
--      · bimestral  → cada dos meses desde ese
--    Sin mes de pago (o en mensual y quincenal) se reparte parejo.
--
-- 2. CON PRESTACIONES en los ingresos: un salario de empleado en Colombia
--    trae prima de servicios (medio salario en junio y medio en diciembre) e
--    intereses de cesantías (12 % anual, en enero). La proyección los suma.
--
-- Es aditiva: no borra ni transforma datos.
-- ============================================================================

alter table public.gastos_presupuesto
  add column if not exists mes_pago smallint check (mes_pago between 1 and 12);

alter table public.ingresos
  add column if not exists mes_pago smallint check (mes_pago between 1 and 12);

alter table public.ingresos
  add column if not exists con_prestaciones boolean not null default false;
