-- ============================================================================
--  Frecuencia en los gastos
-- ============================================================================

-- ---------------------------------------------------------------------------
--  Frecuencia de los gastos
--
--  No todo se paga cada mes: el seguro puede ser semestral, el impuesto
--  anual, el mercado quincenal. Se guarda el monto real y su periodicidad;
--  la aplicación calcula el equivalente mensual para poder sumar peras con
--  manzanas sin que el usuario haga la división a mano.
-- ---------------------------------------------------------------------------
alter table public.gastos_presupuesto
  add column if not exists frecuencia text not null default 'mensual';

alter table public.gastos_presupuesto
  drop constraint if exists gastos_presupuesto_frecuencia_check;
alter table public.gastos_presupuesto
  add constraint gastos_presupuesto_frecuencia_check
  check (frecuencia in ('quincenal','mensual','bimestral','trimestral','semestral','anual'));

-- Los ingresos admitían solo tres: se igualan al mismo juego.
alter table public.ingresos drop constraint if exists ingresos_frecuencia_check;
alter table public.ingresos
  add constraint ingresos_frecuencia_check
  check (frecuencia in ('quincenal','mensual','bimestral','trimestral','semestral','anual'));

-- Factor a mensual, en un solo sitio para que SQL y la aplicación coincidan.
create or replace function public.factor_mensual(p_frecuencia text)
returns numeric language sql immutable as $$
  select case p_frecuencia
    when 'quincenal'  then 2.0
    when 'bimestral'  then 1.0/2
    when 'trimestral' then 1.0/3
    when 'semestral'  then 1.0/6
    when 'anual'      then 1.0/12
    else 1.0
  end;
$$;

-- ---------------------------------------------------------------------------
--  cerrar_mes vuelve a escribirse: el presupuesto ahora se normaliza
-- ---------------------------------------------------------------------------
create or replace function public.cerrar_mes(p_hogar uuid, p_periodo date)
returns public.cierres_mensuales language plpgsql as $$
declare
  v_ini date := date_trunc('month', p_periodo)::date;
  v_fin date := (date_trunc('month', p_periodo) + interval '1 month')::date;
  v_ingresos numeric(14,2);
  v_gastos numeric(14,2);
  v_cuotas numeric(14,2);
  v_deuda numeric(14,2);
  v_cat jsonb;
  v_hay_movs boolean;
  v_fila public.cierres_mensuales;
begin
  if not public.es_miembro(p_hogar) then
    raise exception 'No perteneces a este hogar';
  end if;

  select exists (
    select 1 from public.movimientos
    where hogar_id = p_hogar and fecha >= v_ini and fecha < v_fin
  ) into v_hay_movs;

  if v_hay_movs then
    select
      coalesce(sum(monto) filter (where clase = 'ingreso'), 0),
      coalesce(sum(monto) filter (where clase = 'gasto'), 0)
    into v_ingresos, v_gastos
    from public.movimientos
    where hogar_id = p_hogar and fecha >= v_ini and fecha < v_fin;

    select coalesce(jsonb_object_agg(categoria, total), '{}'::jsonb)
    into v_cat
    from (
      select categoria, sum(monto)::numeric(14,2) as total
      from public.movimientos
      where hogar_id = p_hogar and fecha >= v_ini and fecha < v_fin and clase = 'gasto'
      group by categoria
    ) t;
  else
    select coalesce(sum(monto * public.factor_mensual(frecuencia)), 0)::numeric(14,2)
    into v_ingresos
    from public.ingresos where hogar_id = p_hogar;

    select coalesce(sum(monto * public.factor_mensual(frecuencia)), 0)::numeric(14,2)
    into v_gastos
    from public.gastos_presupuesto where hogar_id = p_hogar;

    select coalesce(jsonb_object_agg(categoria, total), '{}'::jsonb)
    into v_cat
    from (
      select categoria,
             sum(monto * public.factor_mensual(frecuencia))::numeric(14,2) as total
      from public.gastos_presupuesto
      where hogar_id = p_hogar
      group by categoria
    ) t;
  end if;

  select coalesce(sum(cuota), 0), coalesce(sum(saldo), 0)
  into v_cuotas, v_deuda
  from public.deudas where hogar_id = p_hogar;

  insert into public.cierres_mensuales
    (hogar_id, periodo, ingresos, gastos, cuotas, ahorro, deuda_total, por_categoria)
  values
    (p_hogar, v_ini, v_ingresos, v_gastos, v_cuotas,
     v_ingresos - v_gastos - v_cuotas, v_deuda, v_cat)
  on conflict (hogar_id, periodo) do update set
    ingresos      = excluded.ingresos,
    gastos        = excluded.gastos,
    cuotas        = excluded.cuotas,
    ahorro        = excluded.ahorro,
    deuda_total   = excluded.deuda_total,
    por_categoria = excluded.por_categoria,
    cerrado_en    = now()
  returning * into v_fila;

  return v_fila;
end;
$$;
