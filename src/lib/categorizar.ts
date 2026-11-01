import { etiquetaDe } from "@/lib/etiquetas";
import { normalizar } from "@/lib/habitos";
import type { Categoria, ReglaCategoria } from "@/models/dominio";

/**
 * El oráculo sugiere la categoría de un movimiento a partir del concepto.
 * Primero las reglas que el hogar ya le enseñó (las correcciones del
 * importador); si ninguna aplica, la etiqueta de hábito dice a qué categoría
 * suele pertenecer esa costumbre. Es una sugerencia: la última palabra
 * siempre la tiene el usuario.
 */

const CATEGORIA_DE_ETIQUETA: Record<string, Categoria> = {
  "Comidas por fuera": "Ocio",
  "Café y antojos": "Ocio",
  "Licor y salidas": "Ocio",
  "Transporte suelto": "Transporte",
  "Tienda y mercaditos": "Mercado",
  "Juegos y apps": "Ocio",
};

export interface SugerenciaCategoria {
  categoria: Categoria;
  /** De dónde salió: una regla aprendida del hogar o una etiqueta de hábito. */
  razon: "regla" | "etiqueta";
  etiqueta?: string;
}

export function categoriaSugerida(
  concepto: string,
  reglas: ReglaCategoria[],
): SugerenciaCategoria | null {
  const texto = normalizar(concepto);
  if (!texto) return null;

  // La regla más específica (el patrón más largo) manda.
  const aprendidas = [...reglas].sort((a, b) => b.patron.length - a.patron.length);
  for (const r of aprendidas) {
    const patron = normalizar(r.patron);
    if (patron && texto.includes(patron)) return { categoria: r.categoria, razon: "regla" };
  }

  const etiqueta = etiquetaDe(concepto);
  if (etiqueta && CATEGORIA_DE_ETIQUETA[etiqueta]) {
    return { categoria: CATEGORIA_DE_ETIQUETA[etiqueta], razon: "etiqueta", etiqueta };
  }
  return null;
}
