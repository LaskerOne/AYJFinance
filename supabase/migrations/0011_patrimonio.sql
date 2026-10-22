-- ============================================================================
-- 0011 · Patrimonio e inversiones
--
-- 1. ACTIVOS: lo que el hogar tiene. Cuentas, CDT, fondos, acciones,
--    dólares, cesantías, pensión y bienes. Con su valor de hoy, la
--    rentabilidad pactada o esperada (% E.A.), lo que se le aporta cada mes
--    y, si aplica, la fecha de vencimiento. Patrimonio = activos − deudas.
--
-- 2. INFLACIÓN DE REFERENCIA del hogar (% anual), para mostrar la
--    rentabilidad real. La publica el DANE; el hogar la actualiza.
--
-- 3. El CIERRE DE MES guarda también el total de activos, para que el
--    histórico pueda dibujar el patrimonio mes a mes.
--
-- Es aditiva: no borra ni transforma datos.
-- ============================================================================

create table if not exists public.activos (
  id              uuid primary key default gen_random_uuid(),
  hogar_id        uuid not null references public.hogares on delete cascade,
  usuario_id      uuid references auth.users on delete set null,
  nombre          text not null default '',
  tipo            text not null default 'ahorro' check (tipo in (
                    'efectivo', 'ahorro', 'cdt', 'fic', 'acciones', 'dolares',
                    'cripto', 'cesantias', 'pension_voluntaria', 'afc',
                    'pension_obligatoria', 'inmueble', 'vehiculo', 'otro')),
  valor           numeric(14,2) not null default 0,
  tasa_ea         numeric(6,2),
  aporte_mensual  numeric(14,2) not null default 0,
  vencimiento     date,
  orden           int not null default 0,
  creado_en       timestamptz not null default now()
);

create index if not exists activos_hogar_idx on public.activos (hogar_id);

alter table public.activos enable row level security;
drop policy if exists activos_todo on public.activos;
create policy activos_todo on public.activos for all to authenticated
  using (public.es_miembro(hogar_id))
  with check (public.es_miembro(hogar_id));

alter table public.activos replica identity full;
do $$
begin
  alter publication supabase_realtime add table public.activos;
exception when duplicate_object then
  null;  -- ya estaba publicada
end $$;

alter table public.hogares
  add column if not exists inflacion_ref numeric(5,2);

alter table public.cierres_mensuales
  add column if not exists activos_total numeric(14,2) not null default 0;

-- ---------------------------------------------------------------------------
--  cerrar_mes: igual que en 0005, más el total de activos del hogar
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
  v_activos numeric(14,2);
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

  select coalesce(sum(valor), 0)
  into v_activos
  from public.activos where hogar_id = p_hogar;

  insert into public.cierres_mensuales
    (hogar_id, periodo, ingresos, gastos, cuotas, ahorro, deuda_total, por_categoria, activos_total)
  values
    (p_hogar, v_ini, v_ingresos, v_gastos, v_cuotas,
     v_ingresos - v_gastos - v_cuotas, v_deuda, v_cat, v_activos)
  on conflict (hogar_id, periodo) do update set
    ingresos      = excluded.ingresos,
    gastos        = excluded.gastos,
    cuotas        = excluded.cuotas,
    ahorro        = excluded.ahorro,
    deuda_total   = excluded.deuda_total,
    por_categoria = excluded.por_categoria,
    activos_total = excluded.activos_total,
    cerrado_en    = now()
  returning * into v_fila;

  return v_fila;
end;
$$;
