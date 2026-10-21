import { useEffect, useRef, useState } from "react";

function reduceMovimiento(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/**
 * Una cifra que cuenta hasta su valor: desde cero al montar y desde el valor
 * anterior cuando cambia. Con `prefers-reduced-motion` salta directo, sin
 * animación. El formato lo pone quien la usa (moneda, porcentaje, entero).
 */
export function Cifra({
  valor,
  formato,
  duracion = 900,
}: {
  valor: number;
  formato: (n: number) => string;
  duracion?: number;
}) {
  const [mostrado, setMostrado] = useState(() => (reduceMovimiento() ? valor : 0));
  // El último valor pintado, para que una animación interrumpida continúe
  // desde donde iba y no desde el principio.
  const actual = useRef(mostrado);

  useEffect(() => {
    if (reduceMovimiento() || actual.current === valor) {
      actual.current = valor;
      setMostrado(valor);
      return;
    }
    const origen = actual.current;
    const inicio = performance.now();
    let marco = requestAnimationFrame(function paso(ahora) {
      const t = Math.min((ahora - inicio) / duracion, 1);
      const suave = 1 - Math.pow(1 - t, 3); // easeOutCubic: arranca rápido, aterriza suave
      const v = origen + (valor - origen) * suave;
      actual.current = v;
      setMostrado(v);
      if (t < 1) marco = requestAnimationFrame(paso);
    });
    return () => cancelAnimationFrame(marco);
  }, [valor, duracion]);

  return <>{formato(mostrado)}</>;
}
