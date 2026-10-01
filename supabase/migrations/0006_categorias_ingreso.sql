-- ============================================================================
--  Categorías para los ingresos
--
--  Hasta ahora la columna `categoria` de movimientos solo admitía las nueve
--  categorías de gasto, así que clasificar un sueldo obligaba a sacrificar
--  una de ellas. Los ingresos pasan a tener su propio catálogo, en la misma
--  columna: nunca conviven en el mismo cálculo ni en el mismo gráfico,
--  porque todo lo que mira categorías filtra antes por `clase`.
-- ============================================================================

create or replace function public.categorias_ingreso()
returns text[] language sql immutable as $$
  select array['Salario','Independiente','Arriendo','Bonos','Otros ingresos'];
$$;

alter table public.movimientos drop constraint if exists movimientos_categoria_check;
alter table public.movimientos add constraint movimientos_categoria_check
  check (
    categoria = any (public.categorias_validas())
    or categoria = any (public.categorias_ingreso())
  );

-- Los ingresos ya registrados quedaron en la categoría de gasto que se
-- hubiera usado para clasificarlos; se llevan a la suya.
update public.movimientos
   set categoria = 'Salario'
 where clase = 'ingreso'
   and categoria <> all (public.categorias_ingreso());
