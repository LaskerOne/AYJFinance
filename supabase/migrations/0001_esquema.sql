-- ============================================================================
--  Cuentas de Dos · esquema inicial
--  Ejecuta este archivo completo en Supabase → SQL Editor → New query.
--  Es idempotente en lo razonable: puedes volver a correrlo sobre una base
--  limpia sin sorpresas.
-- ============================================================================

-- ---------------------------------------------------------------------------
--  0. Catálogo de categorías (lo comparten presupuesto, movimientos y reglas)
-- ---------------------------------------------------------------------------
create or replace function public.categorias_validas()
returns text[] language sql immutable as $$
  select array[
    'Vivienda','Mercado','Servicios','Transporte','Salud',
    'Ocio','Personal','Educación','Otros'
  ];
$$;

-- ---------------------------------------------------------------------------
--  1. Perfiles · una fila por usuario autenticado
-- ---------------------------------------------------------------------------
create table if not exists public.perfiles (
  id          uuid primary key references auth.users on delete cascade,
  nombre      text not null default '',
  correo      text not null default '',
  creado_en   timestamptz not null default now()
);

-- Al registrarse un usuario nuevo, se le crea el perfil automáticamente.
create or replace function public.crear_perfil()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.perfiles (id, nombre, correo)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'nombre', split_part(new.email, '@', 1)),
    coalesce(new.email, '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists al_crear_usuario on auth.users;
create trigger al_crear_usuario
  after insert on auth.users
  for each row execute function public.crear_perfil();

-- ---------------------------------------------------------------------------
--  2. Hogar · la unidad que comparten los dos
-- ---------------------------------------------------------------------------
create table if not exists public.hogares (
  id                uuid primary key default gen_random_uuid(),
  nombre            text not null default 'Nuestro hogar',
  moneda            text not null default 'COP',
  reparto           text not null default 'proporcional'
                      check (reparto in ('proporcional','mitad')),
  estrategia_deuda  text not null default 'avalancha'
                      check (estrategia_deuda in ('avalancha','bola')),
  abono_extra       numeric(14,2) not null default 0,
  creado_por        uuid not null references auth.users on delete cascade,
  creado_en         timestamptz not null default now()
);

create table if not exists public.miembros (
  hogar_id    uuid not null references public.hogares on delete cascade,
  usuario_id  uuid not null references auth.users on delete cascade,
  rol         text not null default 'socio' check (rol in ('socio','invitado')),
  unido_en    timestamptz not null default now(),
  primary key (hogar_id, usuario_id)
);

-- Invitación por correo: así entra la segunda persona sin backend propio.
create table if not exists public.invitaciones (
  id          uuid primary key default gen_random_uuid(),
  hogar_id    uuid not null references public.hogares on delete cascade,
  correo      text not null,
  invitado_por uuid not null references auth.users on delete cascade,
  creada_en   timestamptz not null default now(),
  unique (hogar_id, correo)
);

-- ---------------------------------------------------------------------------
--  3. Presupuesto mensual
-- ---------------------------------------------------------------------------
create table if not exists public.ingresos (
  id          uuid primary key default gen_random_uuid(),
  hogar_id    uuid not null references public.hogares on delete cascade,
  usuario_id  uuid references auth.users on delete set null,  -- null = del hogar
  concepto    text not null default '',
  monto       numeric(14,2) not null default 0,
  frecuencia  text not null default 'mensual'
                check (frecuencia in ('mensual','quincenal','anual')),
  orden       int not null default 0,
  creado_en   timestamptz not null default now()
);

create table if not exists public.gastos_presupuesto (
  id          uuid primary key default gen_random_uuid(),
  hogar_id    uuid not null references public.hogares on delete cascade,
  usuario_id  uuid references auth.users on delete set null,  -- null = compartido
  categoria   text not null default 'Otros'
                check (categoria = any (public.categorias_validas())),
  concepto    text not null default '',
  monto       numeric(14,2) not null default 0,
  tipo        text not null default 'fijo' check (tipo in ('fijo','variable')),
  orden       int not null default 0,
  creado_en   timestamptz not null default now()
);

create table if not exists public.deudas (
  id          uuid primary key default gen_random_uuid(),
  hogar_id    uuid not null references public.hogares on delete cascade,
  usuario_id  uuid references auth.users on delete set null,
  nombre      text not null default '',
  saldo       numeric(14,2) not null default 0,
  tasa_ea     numeric(6,3) not null default 0,   -- % efectivo anual
  cuota       numeric(14,2) not null default 0,
  dia_pago    int check (dia_pago between 1 and 31),
  orden       int not null default 0,
  creado_en   timestamptz not null default now()
);

create table if not exists public.metas (
  id            uuid primary key default gen_random_uuid(),
  hogar_id      uuid not null references public.hogares on delete cascade,
  usuario_id    uuid references auth.users on delete set null,
  nombre        text not null default '',
  objetivo      numeric(14,2) not null default 0,
  acumulado     numeric(14,2) not null default 0,
  aporte        numeric(14,2) not null default 0,
  es_emergencia boolean not null default false,
  orden         int not null default 0,
  creado_en     timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
--  4. Movimientos reales (lo ejecutado, día a día)
-- ---------------------------------------------------------------------------
create table if not exists public.movimientos (
  id          uuid primary key default gen_random_uuid(),
  hogar_id    uuid not null references public.hogares on delete cascade,
  fecha       date not null default current_date,
  concepto    text not null default '',
  categoria   text not null default 'Otros'
                check (categoria = any (public.categorias_validas())),
  monto       numeric(14,2) not null default 0,
  clase       text not null default 'gasto' check (clase in ('gasto','ingreso')),
  pagado_por  uuid references auth.users on delete set null,
  compartido  boolean not null default true,
  metodo      text not null default '',
  origen      text not null default 'manual' check (origen in ('manual','importado')),
  huella      text,                              -- deduplica importaciones
  nota        text not null default '',
  creado_en   timestamptz not null default now()
);

create index if not exists movimientos_hogar_fecha_idx
  on public.movimientos (hogar_id, fecha desc);

create unique index if not exists movimientos_huella_uk
  on public.movimientos (hogar_id, huella) where huella is not null;

-- Reglas que aprenden de tus correcciones al importar
create table if not exists public.reglas_categoria (
  id          uuid primary key default gen_random_uuid(),
  hogar_id    uuid not null references public.hogares on delete cascade,
  patron      text not null,                     -- fragmento en minúsculas
  categoria   text not null
                check (categoria = any (public.categorias_validas())),
  veces       int not null default 1,
  creada_en   timestamptz not null default now(),
  unique (hogar_id, patron)
);

-- ---------------------------------------------------------------------------
--  5. Cierres mensuales (el histórico)
-- ---------------------------------------------------------------------------
create table if not exists public.cierres_mensuales (
  id            uuid primary key default gen_random_uuid(),
  hogar_id      uuid not null references public.hogares on delete cascade,
  periodo       date not null,                   -- siempre día 1 del mes
  ingresos      numeric(14,2) not null default 0,
  gastos        numeric(14,2) not null default 0,
  cuotas        numeric(14,2) not null default 0,
  ahorro        numeric(14,2) not null default 0,
  deuda_total   numeric(14,2) not null default 0,
  por_categoria jsonb not null default '{}'::jsonb,
  cerrado_en    timestamptz not null default now(),
  unique (hogar_id, periodo)
);

-- ---------------------------------------------------------------------------
--  6. Seguridad · ¿quién ve qué?
-- ---------------------------------------------------------------------------

-- SECURITY DEFINER a propósito: evita la recursión infinita que se produce si
-- la política de `miembros` se consulta a sí misma.
create or replace function public.es_miembro(p_hogar uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from public.miembros m
    where m.hogar_id = p_hogar and m.usuario_id = auth.uid()
  );
$$;

create or replace function public.mi_correo()
returns text language sql stable as $$
  select lower(coalesce(auth.jwt() ->> 'email', ''));
$$;

alter table public.perfiles            enable row level security;
alter table public.hogares             enable row level security;
alter table public.miembros            enable row level security;
alter table public.invitaciones        enable row level security;
alter table public.ingresos            enable row level security;
alter table public.gastos_presupuesto  enable row level security;
alter table public.deudas              enable row level security;
alter table public.metas               enable row level security;
alter table public.movimientos         enable row level security;
alter table public.reglas_categoria    enable row level security;
alter table public.cierres_mensuales   enable row level security;

-- Perfiles: ves el tuyo y el de quien comparte hogar contigo.
drop policy if exists perfiles_select on public.perfiles;
create policy perfiles_select on public.perfiles for select to authenticated
using (
  id = auth.uid()
  or exists (
    select 1 from public.miembros mio
    join public.miembros suyo on suyo.hogar_id = mio.hogar_id
    where mio.usuario_id = auth.uid() and suyo.usuario_id = public.perfiles.id
  )
);

drop policy if exists perfiles_update on public.perfiles;
create policy perfiles_update on public.perfiles for update to authenticated
using (id = auth.uid()) with check (id = auth.uid());

-- Hogares
drop policy if exists hogares_select on public.hogares;
create policy hogares_select on public.hogares for select to authenticated
using (public.es_miembro(id));

drop policy if exists hogares_insert on public.hogares;
create policy hogares_insert on public.hogares for insert to authenticated
with check (creado_por = auth.uid());

drop policy if exists hogares_update on public.hogares;
create policy hogares_update on public.hogares for update to authenticated
using (public.es_miembro(id)) with check (public.es_miembro(id));

drop policy if exists hogares_delete on public.hogares;
create policy hogares_delete on public.hogares for delete to authenticated
using (creado_por = auth.uid());

-- Miembros
drop policy if exists miembros_select on public.miembros;
create policy miembros_select on public.miembros for select to authenticated
using (public.es_miembro(hogar_id));

-- Te puedes añadir a un hogar si lo creaste tú, o si hay una invitación a tu correo.
drop policy if exists miembros_insert on public.miembros;
create policy miembros_insert on public.miembros for insert to authenticated
with check (
  usuario_id = auth.uid()
  and (
    exists (
      select 1 from public.hogares h
      where h.id = public.miembros.hogar_id and h.creado_por = auth.uid()
    )
    or exists (
      select 1 from public.invitaciones i
      where i.hogar_id = public.miembros.hogar_id and lower(i.correo) = public.mi_correo()
    )
  )
);

drop policy if exists miembros_delete on public.miembros;
create policy miembros_delete on public.miembros for delete to authenticated
using (usuario_id = auth.uid());

-- Invitaciones: las ve el hogar, y también la persona invitada (por su correo).
drop policy if exists invitaciones_select on public.invitaciones;
create policy invitaciones_select on public.invitaciones for select to authenticated
using (public.es_miembro(hogar_id) or lower(correo) = public.mi_correo());

drop policy if exists invitaciones_insert on public.invitaciones;
create policy invitaciones_insert on public.invitaciones for insert to authenticated
with check (public.es_miembro(hogar_id) and invitado_por = auth.uid());

drop policy if exists invitaciones_delete on public.invitaciones;
create policy invitaciones_delete on public.invitaciones for delete to authenticated
using (public.es_miembro(hogar_id));

-- Tablas de datos: una política idéntica para todas.
do $$
declare t text;
begin
  foreach t in array array[
    'ingresos','gastos_presupuesto','deudas','metas',
    'movimientos','reglas_categoria','cierres_mensuales'
  ] loop
    execute format('drop policy if exists %I_todo on public.%I', t, t);
    execute format(
      'create policy %I_todo on public.%I for all to authenticated
         using (public.es_miembro(hogar_id))
         with check (public.es_miembro(hogar_id))', t, t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
--  7. Tiempo real · qué tablas emiten cambios por WebSocket
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'hogares','miembros','ingresos','gastos_presupuesto','deudas','metas',
    'movimientos','reglas_categoria','cierres_mensuales'
  ] loop
    begin
      execute format('alter publication supabase_realtime add table public.%I', t);
    exception when duplicate_object then
      null;  -- ya estaba publicada
    end;
  end loop;
end $$;

-- Realtime necesita la fila completa para notificar borrados.
alter table public.movimientos        replica identity full;
alter table public.gastos_presupuesto replica identity full;
alter table public.ingresos           replica identity full;
alter table public.deudas             replica identity full;
alter table public.metas              replica identity full;
