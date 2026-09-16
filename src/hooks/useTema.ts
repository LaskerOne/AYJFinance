import { useCallback, useEffect, useState } from "react";

export type Tema = "sistema" | "claro" | "oscuro";

const CLAVE = "cuentas-de-dos:tema";

function leer(): Tema {
  try {
    const v = localStorage.getItem(CLAVE);
    if (v === "claro" || v === "oscuro" || v === "sistema") return v;
  } catch {
    // Navegación privada o almacenamiento bloqueado: se sigue con el del sistema.
  }
  return "sistema";
}

/**
 * Estampa `data-theme` en la raíz. Sin atributo, manda `prefers-color-scheme`,
 * que es justo lo que define `tokens.css` para el estado "sistema".
 */
function aplicar(tema: Tema): void {
  const raiz = document.documentElement;
  if (tema === "sistema") raiz.removeAttribute("data-theme");
  else raiz.setAttribute("data-theme", tema === "oscuro" ? "dark" : "light");
}

/** Preferencia de tema, recordada en este navegador. Es una comodidad por
 *  dispositivo, no un dato del hogar: cada uno la elige a su gusto. */
export function useTema() {
  const [tema, setTemaEstado] = useState<Tema>(leer);

  useEffect(() => {
    aplicar(tema);
    try {
      localStorage.setItem(CLAVE, tema);
    } catch {
      // Si no se puede guardar, el tema igual aplica durante esta visita.
    }
  }, [tema]);

  const setTema = useCallback((nuevo: Tema) => setTemaEstado(nuevo), []);

  return { tema, setTema };
}
