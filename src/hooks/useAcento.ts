import { useCallback, useEffect, useState } from "react";

export type Acento = "lima" | "violeta";

const CLAVE = "cuentas-de-dos:acento";

function leer(): Acento {
  try {
    return localStorage.getItem(CLAVE) === "violeta" ? "violeta" : "lima";
  } catch {
    return "lima";
  }
}

/**
 * Estampa `data-acento` en la raíz. Sin atributo manda el lima de fábrica;
 * con "violeta", tokens.css invierte los papeles de los dos colores de la
 * casa en toda la aplicación (y las superficies y categorías los siguen).
 */
function aplicar(acento: Acento): void {
  const raiz = document.documentElement;
  if (acento === "violeta") raiz.setAttribute("data-acento", "violeta");
  else raiz.removeAttribute("data-acento");
}

/** El color dominante, recordado en este navegador como el tema: cada uno
 *  lo elige sin cambiarle la aplicación a la otra persona. */
export function useAcento() {
  const [acento, setAcentoEstado] = useState<Acento>(leer);

  useEffect(() => {
    aplicar(acento);
    try {
      localStorage.setItem(CLAVE, acento);
    } catch {
      // Si no se puede guardar, el acento igual aplica durante esta visita.
    }
  }, [acento]);

  const setAcento = useCallback((nuevo: Acento) => setAcentoEstado(nuevo), []);

  return { acento, setAcento };
}
