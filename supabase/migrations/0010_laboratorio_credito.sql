-- ============================================================================
-- 0010 · Laboratorio de crédito
--
-- 1. CARGOS de cada deuda además de la cuota: seguro y cuota de manejo,
--    mensuales. Con ellos se calcula el costo efectivo real de la deuda,
--    que suele ser más alto que la tasa pactada.
--
-- 2. TASA DE USURA vigente (% E.A.) y el mes al que corresponde. La
--    certifica la Superintendencia Financiera por resolución y no hay una
--    fuente abierta para traerla sola, así que el hogar la actualiza cuando
--    cambia; la aplicación avisa si quedó vieja.
--
-- Es aditiva: no borra ni transforma datos.
-- ============================================================================

alter table public.deudas
  add column if not exists seguro_mensual numeric(14, 2) not null default 0,
  add column if not exists cuota_manejo numeric(14, 2) not null default 0;

alter table public.hogares
  add column if not exists tasa_usura numeric(6, 2),
  add column if not exists tasa_usura_mes text;
