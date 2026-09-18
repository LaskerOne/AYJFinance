import { useCallback, useMemo } from "react";
import { useHogar } from "@/contexts/HogarContext";
import { CATEGORIAS, type Categoria } from "@/models/dominio";

/**
 * Las nueve categorías con el nombre que les haya puesto el hogar.
 *
 * La clave almacenada en gastos y movimientos nunca cambia; lo único que se
 * personaliza es la etiqueta que se ve en pantalla. Así, renombrar una
 * categoría no obliga a reescribir ninguna fila ni deja datos huérfanos.
 */
export function useCategorias() {
  const { hogar, cambiarHogar } = useHogar();

  const etiquetas = useMemo(
    () => (hogar?.etiquetas_categorias ?? {}) as Partial<Record<Categoria, string>>,
    [hogar?.etiquetas_categorias],
  );

  /** Nombre visible de una categoría. Cae al de fábrica si no la renombraron. */
  const etiqueta = useCallback(
    (clave: Categoria): string => {
      const propia = etiquetas[clave];
      return propia && propia.trim() ? propia.trim() : clave;
    },
    [etiquetas],
  );

  /** Para los desplegables: clave interna + nombre visible, en orden fijo. */
  const opciones = useMemo(
    () => CATEGORIAS.map((clave) => ({ clave, nombre: etiqueta(clave) })),
    [etiqueta],
  );

  const renombrar = useCallback(
    async (clave: Categoria, nombre: string) => {
      const limpio = nombre.trim().slice(0, 40);
      const siguiente = { ...etiquetas };
      // Volver al nombre de fábrica se guarda como ausencia, no como copia.
      if (!limpio || limpio === clave) delete siguiente[clave];
      else siguiente[clave] = limpio;
      await cambiarHogar({ etiquetas_categorias: siguiente });
    },
    [etiquetas, cambiarHogar],
  );

  const restaurar = useCallback(async () => {
    await cambiarHogar({ etiquetas_categorias: {} });
  }, [cambiarHogar]);

  const hayRenombradas = Object.keys(etiquetas).length > 0;

  return { etiqueta, opciones, renombrar, restaurar, hayRenombradas };
}
