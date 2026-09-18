-- ============================================================================
--  Nombres propios para las categorías
--
--  Las nueve categorías siguen siendo las mismas —y conservan su color de la
--  paleta verificada— pero cada hogar puede llamarlas como quiera:
--  "Mercado" puede ser "Plaza", "Personal" puede ser "Gimnasio y ropa".
--
--  Se guarda solo la etiqueta visible. Lo que queda escrito en gastos y
--  movimientos sigue siendo la clave original, así que renombrar no deja
--  ninguna fila apuntando a algo que ya no existe.
-- ============================================================================

alter table public.hogares
  add column if not exists etiquetas_categorias jsonb not null default '{}'::jsonb;

comment on column public.hogares.etiquetas_categorias is
  'Mapa clave -> nombre visible. Las claves ausentes usan el nombre por defecto.';
