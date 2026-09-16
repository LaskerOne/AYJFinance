-- ============================================================================
--  Cuentas de Dos · funciones de negocio
--  Se ejecutan con los permisos de quien llama (security invoker), así que las
--  políticas RLS de 0001 siguen mandando: nadie toca un hogar que no es suyo.
-- ============================================================================

-- ---------------------------------------------------------------------------
--  sembrar_ejemplo · llena un hogar recién creado con un presupuesto de
--  muestra, para que el tablero no arranque en blanco. No hace nada si el
--  hogar ya tiene datos.
-- ---------------------------------------------------------------------------
create or replace function public.sembrar_ejemplo(p_hogar uuid)
returns void language plpgsql as $$
declare
  v_yo uuid := auth.uid();
begin
  if exists (select 1 from public.ingresos where hogar_id = p_hogar)
     or exists (select 1 from public.gastos_presupuesto where hogar_id = p_hogar) then
    return;
  end if;

  insert into public.ingresos (hogar_id, usuario_id, concepto, monto, frecuencia, orden) values
    (p_hogar, v_yo,  'Salario',             4800000, 'mensual', 1),
    (p_hogar, v_yo,  'Trabajo independiente', 700000, 'mensual', 2),
    (p_hogar, v_yo,  'Prima',               4800000, 'anual',   3),
    (p_hogar, null,  'Arriendo apartaestudio', 950000, 'mensual', 4);

  insert into public.gastos_presupuesto (hogar_id, usuario_id, categoria, concepto, monto, tipo, orden) values
    (p_hogar, null, 'Vivienda',   'Arriendo',               2300000, 'fijo',     1),
    (p_hogar, null, 'Vivienda',   'Administración',          320000, 'fijo',     2),
    (p_hogar, null, 'Servicios',  'Energía, agua y gas',     210000, 'variable', 3),
    (p_hogar, null, 'Servicios',  'Internet y celulares',    175000, 'fijo',     4),
    (p_hogar, null, 'Mercado',    'Mercado quincenal',      1100000, 'variable', 5),
    (p_hogar, v_yo, 'Transporte', 'Gasolina y peajes',       380000, 'variable', 6),
    (p_hogar, null, 'Salud',      'Medicina prepagada',      460000, 'fijo',     7),
    (p_hogar, null, 'Ocio',       'Restaurantes y salidas',  520000, 'variable', 8),
    (p_hogar, null, 'Ocio',       'Suscripciones',            89000, 'fijo',     9),
    (p_hogar, v_yo, 'Personal',   'Gimnasio',                150000, 'fijo',    10),
    (p_hogar, null, 'Otros',      'Veterinario de la perra',  180000, 'variable', 11);

  insert into public.deudas (hogar_id, usuario_id, nombre, saldo, tasa_ea, cuota, dia_pago, orden) values
    (p_hogar, v_yo, 'Tarjeta de crédito',   3400000, 28.800, 420000,  5, 1),
    (p_hogar, null, 'Crédito de vehículo', 18500000, 16.200, 780000, 15, 2),
    (p_hogar, null, 'Libre inversión',      6200000, 21.500, 390000, 20, 3);

  insert into public.metas (hogar_id, usuario_id, nombre, objetivo, acumulado, aporte, es_emergencia, orden) values
    (p_hogar, null, 'Fondo de emergencia',    20000000,  7400000, 700000, true,  1),
    (p_hogar, null, 'Cuota inicial del apto', 60000000, 12300000, 600000, false, 2),
    (p_hogar, null, 'Viaje de fin de año',     4500000,  1850000, 400000, false, 3);
end;
$$;

-- ---------------------------------------------------------------------------
--  cerrar_mes · congela el mes indicado en el histórico.
--  Toma los movimientos reales del periodo; si no hay ninguno, cae al
--  presupuesto, para que un mes sin digitar no aparezca como un mes en cero.
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
    select coalesce(sum(
      monto * case frecuencia when 'quincenal' then 2 when 'anual' then 1.0/12 else 1 end
    ), 0)::numeric(14,2)
    into v_ingresos
    from public.ingresos where hogar_id = p_hogar;

    select coalesce(sum(monto), 0) into v_gastos
    from public.gastos_presupuesto where hogar_id = p_hogar;

    select coalesce(jsonb_object_agg(categoria, total), '{}'::jsonb)
    into v_cat
    from (
      select categoria, sum(monto)::numeric(14,2) as total
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

-- ---------------------------------------------------------------------------
--  aprender_regla · guarda (o refuerza) la categoría que tú corregiste al
--  importar, para que la próxima vez el extracto se clasifique solo.
-- ---------------------------------------------------------------------------
create or replace function public.aprender_regla(
  p_hogar uuid, p_patron text, p_categoria text
) returns void language plpgsql as $$
declare
  v_patron text := lower(btrim(p_patron));
begin
  if length(v_patron) < 3 then
    return;
  end if;

  insert into public.reglas_categoria (hogar_id, patron, categoria)
  values (p_hogar, v_patron, p_categoria)
  on conflict (hogar_id, patron) do update set
    categoria = excluded.categoria,
    veces     = public.reglas_categoria.veces + 1;
end;
$$;
