-- ============================================================================
-- 0016 · Mes contable: el pago de fin de mes cuenta para el mes siguiente
--
-- El hogar cobra el 15 y el 29/30, y el pago de fin de mes en realidad paga
-- la primera quincena del mes siguiente. Contarlo en el mes en que cae hace
-- ver un mes con plata de más y el siguiente con plata de menos.
--
-- 1. CORTE DE INGRESOS en el hogar (p. ej. 29): todo ingreso con fecha en o
--    después de ese día cuenta para el mes siguiente. Nulo = apagado, todo
--    sigue en su mes calendario.
--
-- 2. CUENTA_PARA en los movimientos: excepción manual por movimiento (un
--    bono de fin de mes que sí es del mes, un arriendo pagado por
--    adelantado). Tiene prioridad sobre la regla del corte.
--
-- 3. mes_contable(): la regla en una sola función, usada por el cierre.
--    La fecha del movimiento no cambia nunca: el extracto del banco sigue
--    cuadrando. Solo cambia a qué mes se atribuye.
--
-- 4. cerrar_mes_nucleo agrupa por mes contable, y recalcular_cierres()
--    rehace los totales de los cierres ya guardados cuando el hogar cambia
--    el corte (solo ingresos/gastos/ahorro/por_categoria: las fotos de
--    deuda, activos y puntaje quedan como estaban).
--
-- Es aditiva: no borra ni transforma datos.
-- ============================================================================

alter table public.hogares
  add column if not exists corte_ingresos smallint
    check (corte_ingresos between 20 and 31);

alter table public.movimientos
  add column if not exists cuenta_para date;

-- El mes (primer día) al que se atribuye un movimiento. Si el mes no llega
-- al día del corte (febrero con corte 29), el corte es su último día.
create or replace function public.mes_contable(
  p_fecha date, p_clase text, p_cuenta_para date, p_corte smallint
) returns date language sql immutable as $
  select case
    when p_cuenta_para is not null
      then date_trunc('month', p_cuenta_para)::date
    when p_clase = 'ingreso' and p_corte is not null
         and extract(day from p_fecha) >= least(
           p_corte::int,
           extract(day from (date_trunc('month', p_fecha) + interval '1 month' - interval '1 day'))::int
         )
      then (date_trunc('month', p_fecha) + interval '1 month')::date
    else date_trunc('month', p_fecha)::date
  end;
$;

-- ---------------------------------------------------------------------------
--  cerrar_mes_nucleo: igual que en 0013, pero agrupando por mes contable
-- ---------------------------------------------------------------------------
create or replace function public.cerrar_mes_nucleo(p_hogar uuid, p_periodo date)
returns public.cierres_mensuales language plpgsql set search_path = public as $$
declare
  v_ini date := date_trunc('month', p_periodo)::date;
  v_corte smallint;
  v_ingresos numeric(14,2);
  v_gastos numeric(14,2);
  v_cuotas numeric(14,2);
  v_deuda numeric(14,2);
  v_activos numeric(14,2);
  v_cat jsonb;
  v_hay_movs boolean;
  v_fila public.cierres_mensuales;
begin
  select corte_ingresos into v_corte from hogares where id = p_hogar;

  select exists (
    select 1 from movimientos
    where hogar_id = p_hogar
      and mes_contable(fecha, clase, cuenta_para, v_corte) = v_ini
  ) into v_hay_movs;

  if v_hay_movs then
    select
      coalesce(sum(monto) filter (where clase = 'ingreso'), 0),
      coalesce(sum(monto) filter (where clase = 'gasto'), 0)
    into v_ingresos, v_gastos
    from movimientos
    where hogar_id = p_hogar
      and mes_contable(fecha, clase, cuenta_para, v_corte) = v_ini;

    select coalesce(jsonb_object_agg(categoria, total), '{}'::jsonb)
    into v_cat
    from (
      select categoria, sum(monto)::numeric(14,2) as total
      from movimientos
      where hogar_id = p_hogar
        and mes_contable(fecha, clase, cuenta_para, v_corte) = v_ini
        and clase = 'gasto'
      group by categoria
    ) t;
  else
    select coalesce(sum(monto * factor_mensual(frecuencia)), 0)::numeric(14,2)
    into v_ingresos
    from ingresos where hogar_id = p_hogar;

    select coalesce(sum(monto * factor_mensual(frecuencia)), 0)::numeric(14,2)
    into v_gastos
    from gastos_presupuesto where hogar_id = p_hogar;

    select coalesce(jsonb_object_agg(categoria, total), '{}'::jsonb)
    into v_cat
    from (
      select categoria,
             sum(monto * factor_mensual(frecuencia))::numeric(14,2) as total
      from gastos_presupuesto
      where hogar_id = p_hogar
      group by categoria
    ) t;
  end if;

  select coalesce(sum(cuota), 0), coalesce(sum(saldo), 0)
  into v_cuotas, v_deuda
  from deudas where hogar_id = p_hogar;

  select coalesce(sum(valor), 0) into v_activos from activos where hogar_id = p_hogar;

  insert into cierres_mensuales
    (hogar_id, periodo, ingresos, gastos, cuotas, ahorro, deuda_total, por_categoria,
     activos_total, puntaje)
  values
    (p_hogar, v_ini, v_ingresos, v_gastos, v_cuotas,
     v_ingresos - v_gastos - v_cuotas, v_deuda, v_cat, v_activos, puntaje_salud(p_hogar))
  on conflict (hogar_id, periodo) do update set
    ingresos      = excluded.ingresos,
    gastos        = excluded.gastos,
    cuotas        = excluded.cuotas,
    ahorro        = excluded.ahorro,
    deuda_total   = excluded.deuda_total,
    por_categoria = excluded.por_categoria,
    activos_total = excluded.activos_total,
    puntaje       = excluded.puntaje,
    cerrado_en    = now()
  returning * into v_fila;

  return v_fila;
end;
$$;

revoke execute on function public.cerrar_mes_nucleo(uuid, date) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
--  recalcular_cierres: rehace los totales de movimientos de los cierres ya
--  guardados con el corte vigente. Las fotos del momento del cierre (cuotas,
--  deuda, activos, puntaje) no se tocan: describen ese entonces, no hoy.
-- ---------------------------------------------------------------------------
create or replace function public.recalcular_cierres(p_hogar uuid)
returns int language plpgsql security definer set search_path = public as $$
declare
  v_corte smallint;
  v_c record;
  v_ing numeric(14,2);
  v_gas numeric(14,2);
  v_cat jsonb;
  v_n int := 0;
begin
  if not public.es_miembro(p_hogar) then
    raise exception 'No perteneces a este hogar';
  end if;

  select corte_ingresos into v_corte from hogares where id = p_hogar;

  for v_c in
    select id, periodo, cuotas from cierres_mensuales where hogar_id = p_hogar
  loop
    -- Un cierre sin movimientos fue estimado desde el presupuesto: se deja.
    if not exists (
      select 1 from movimientos
      where hogar_id = p_hogar
        and mes_contable(fecha, clase, cuenta_para, v_corte) = v_c.periodo
    ) then
      continue;
    end if;

    select
      coalesce(sum(monto) filter (where clase = 'ingreso'), 0),
      coalesce(sum(monto) filter (where clase = 'gasto'), 0)
    into v_ing, v_gas
    from movimientos
    where hogar_id = p_hogar
      and mes_contable(fecha, clase, cuenta_para, v_corte) = v_c.periodo;

    select coalesce(jsonb_object_agg(categoria, total), '{}'::jsonb)
    into v_cat
    from (
      select categoria, sum(monto)::numeric(14,2) as total
      from movimientos
      where hogar_id = p_hogar
        and mes_contable(fecha, clase, cuenta_para, v_corte) = v_c.periodo
        and clase = 'gasto'
      group by categoria
    ) t;

    update cierres_mensuales set
      ingresos      = v_ing,
      gastos        = v_gas,
      ahorro        = v_ing - v_gas - v_c.cuotas,
      por_categoria = v_cat
    where id = v_c.id;

    v_n := v_n + 1;
  end loop;

  return v_n;
end;
$$;
