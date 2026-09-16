-- ============================================================================
--  Arreglo · el creador de un hogar debe poder verlo
--
--  Síntoma: al entrar por primera vez, la aplicación fallaba con
--  "No se pudo abrir el hogar".
--
--  Causa: la política de lectura de `hogares` solo admitía a los miembros.
--  Al crear el hogar, la fila se inserta y se lee de vuelta en la misma
--  operación — pero en ese instante todavía no existe la fila de `miembros`,
--  así que la lectura devolvía vacío y el cliente lo tomaba como error.
--  El mismo bloqueo afectaba a la política de inserción en `miembros`, que
--  consulta `hogares` para comprobar quién creó el hogar.
--
--  Solución: quien creó el hogar siempre puede verlo, sea o no miembro aún.
-- ============================================================================

drop policy if exists hogares_select on public.hogares;
create policy hogares_select on public.hogares for select to authenticated
using (
  public.es_miembro(id)
  or creado_por = auth.uid()
);

-- Por coherencia: quien lo creó también puede renombrarlo o cambiarle la
-- moneda aunque la membresía se haya perdido por alguna razón.
drop policy if exists hogares_update on public.hogares;
create policy hogares_update on public.hogares for update to authenticated
using (public.es_miembro(id) or creado_por = auth.uid())
with check (public.es_miembro(id) or creado_por = auth.uid());
