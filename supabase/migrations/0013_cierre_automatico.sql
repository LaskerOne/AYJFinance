-- ============================================================================
-- 0013 · Cierre automático del mes y base para las alertas
--
-- 1. PUNTAJE DE SALUD en SQL. El mismo cálculo de src/lib/salud.ts
--    (cinco medidas lineales de 20 puntos) para que el servidor pueda
--    ponerlo en los cierres que hace solo. Si se cambia la fórmula en un
--    lado, hay que cambiarla en el otro.
--
-- 2. CIERRE DE MES en dos piezas: cerrar_mes_nucleo hace el trabajo (y
--    ahora guarda también el puntaje), y cerrar_mes sigue siendo lo que
--    llama la app: verifica que quien cierra pertenezca al hogar y delega.
--
-- 3. CIERRE AUTOMÁTICO: el día 1 de cada mes a las 6:00 (hora de Bogotá)
--    se cierra el mes anterior de todo hogar que no lo haya cerrado a mano.
--    Corre con pg_cron, dentro de la base: no necesita nada externo.
--
-- 4. ALERTAS POR CORREO, la parte de datos: cada persona decide si las
--    recibe (perfiles.alertas_correo, apagado por defecto) y una tabla
--    recuerda qué aviso ya se mandó para no repetirlo. El envío lo hace la
--    función `alertas` y se programa en la migración 0014.
--
-- Requiere las migraciones 0008 a 0012.
-- ============================================================================

-- --- 1 · puntaje ---------------------------------------------------------------

create or replace function public.entre_0_1(v numeric, piso numeric, meta numeric)
returns numeric language sql immutable as $$
  select greatest(0, least(1, (v - piso) / nullif(meta - piso, 0)));
$$;

create or replace function public.puntaje_salud(p_hogar uuid)
returns int language plpgsql stable set search_path = public as $$
declare
  v_ingreso numeric; v_gastos numeric; v_cuotas numeric; v_deudas numeric;
  v_aportes numeric; v_fondo numeric; v_activos numeric;
  v_disp numeric; v_libre numeric; v_costo_vida numeric;
begin
  select coalesce(sum(monto * factor_mensual(frecuencia)), 0) into v_ingreso
    from ingresos where hogar_id = p_hogar;
  select coalesce(sum(monto * factor_mensual(frecuencia)), 0) into v_gastos
    from gastos_presupuesto where hogar_id = p_hogar;
  select coalesce(sum(cuota), 0), coalesce(sum(greatest(saldo, 0)), 0) into v_cuotas, v_deudas
    from deudas where hogar_id = p_hogar;
  select coalesce(sum(aporte), 0), coalesce(sum(acumulado) filter (where es_emergencia), 0)
    into v_aportes, v_fondo
    from metas where hogar_id = p_hogar;
  select coalesce(sum(valor), 0) into v_activos from activos where hogar_id = p_hogar;

  v_disp := v_ingreso - v_gastos - v_cuotas;
  v_libre := v_disp - v_aportes;
  v_costo_vida := v_gastos + v_cuotas;

  return round(
      20 * (1 - entre_0_1(case when v_ingreso > 0 then v_cuotas / v_ingreso else 0 end, 0.3, 0.6))
    + 20 * entre_0_1(case when v_ingreso > 0 then v_disp / v_ingreso else 0 end, 0, 0.2)
    + 20 * entre_0_1(case when v_costo_vida > 0 then v_fondo / v_costo_vida else 0 end, 0, 6)
    + 20 * entre_0_1(case when v_ingreso > 0 then v_libre / v_ingreso else 0 end, -0.1, 0)
    + 20 * entre_0_1(case when v_gastos > 0 then (v_activos - v_deudas) / (v_gastos * 12) else 0 end, 0, 1)
  )::int;
end;
$$;

-- --- 2 · cierre en dos piezas ------------------------------------------------------

create or replace function public.cerrar_mes_nucleo(p_hogar uuid, p_periodo date)
returns public.cierres_mensuales language plpgsql set search_path = public as $$
declare
  v_ini date := date_trunc('month', p_periodo)::date;
  v_fin date := (date_trunc('month', p_periodo) + interval '1 month')::date;
  v_ingresos numeric(14,2);
  v_gastos numeric(14,2);
  v_cuotas numeric(14,2);
  v_deuda numeric(14,2);
  v_activos numeric(14,2);
  v_cat jsonb;
  v_hay_movs boolean;
  v_fila public.cierres_mensuales;
begin
  select exists (
    select 1 from movimientos
    where hogar_id = p_hogar and fecha >= v_ini and fecha < v_fin
  ) into v_hay_movs;

  if v_hay_movs then
    select
      coalesce(sum(monto) filter (where clase = 'ingreso'), 0),
      coalesce(sum(monto) filter (where clase = 'gasto'), 0)
    into v_ingresos, v_gastos
    from movimientos
    where hogar_id = p_hogar and fecha >= v_ini and fecha < v_fin;

    select coalesce(jsonb_object_agg(categoria, total), '{}'::jsonb)
    into v_cat
    from (
      select categoria, sum(monto)::numeric(14,2) as total
      from movimientos
      where hogar_id = p_hogar and fecha >= v_ini and fecha < v_fin and clase = 'gasto'
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

-- El núcleo no revisa quién llama: nadie de afuera puede ejecutarlo.
revoke execute on function public.cerrar_mes_nucleo(uuid, date) from public, anon, authenticated;

-- Lo que llama la app. Corre como su dueño para poder usar el núcleo, y por
-- eso la verificación de pertenencia al hogar es lo primero.
create or replace function public.cerrar_mes(p_hogar uuid, p_periodo date)
returns public.cierres_mensuales language plpgsql security definer set search_path = public as $$
begin
  if not public.es_miembro(p_hogar) then
    raise exception 'No perteneces a este hogar';
  end if;
  return public.cerrar_mes_nucleo(p_hogar, p_periodo);
end;
$$;

-- --- 3 · cierre automático ----------------------------------------------------------

create or replace function public.cerrar_meses_pendientes()
returns int language plpgsql security definer set search_path = public as $$
declare
  v_mes date := (date_trunc('month', now() at time zone 'America/Bogota') - interval '1 month')::date;
  v_hogar record;
  v_cerrados int := 0;
begin
  for v_hogar in
    select h.id from hogares h
    where not exists (
      select 1 from cierres_mensuales c where c.hogar_id = h.id and c.periodo = v_mes
    )
  loop
    perform cerrar_mes_nucleo(v_hogar.id, v_mes);
    v_cerrados := v_cerrados + 1;
  end loop;
  return v_cerrados;
end;
$$;

revoke execute on function public.cerrar_meses_pendientes() from public, anon, authenticated;

-- pg_cron viene con Supabase. Si esta línea falla, actívenlo en el panel:
-- Integrations → Cron, y vuelvan a correr esta migración.
create extension if not exists pg_cron;

select cron.unschedule(jobid) from cron.job where jobname = 'cerrar-mes-anterior';
select cron.schedule(
  'cerrar-mes-anterior',
  '0 11 1 * *',                       -- día 1, 11:00 UTC = 6:00 en Bogotá
  $$select public.cerrar_meses_pendientes()$$
);

-- --- 4 · alertas: datos ---------------------------------------------------------------

alter table public.perfiles
  add column if not exists alertas_correo boolean not null default false;

-- Qué aviso ya se mandó (p. ej. "cuota:<id>:2026-11"), para no repetirlo.
-- Sin políticas: solo la función del servidor (service role) la usa.
create table if not exists public.alertas_enviadas (
  hogar_id    uuid not null references public.hogares on delete cascade,
  clave       text not null,
  enviada_en  timestamptz not null default now(),
  primary key (hogar_id, clave)
);
alter table public.alertas_enviadas enable row level security;
