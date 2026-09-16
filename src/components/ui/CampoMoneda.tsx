import { useEffect, useState } from "react";
import { aNumero } from "@/lib/formato";
import { useMoneda } from "@/hooks/useMoneda";

interface Props {
  valor: number;
  onCambio: (valor: number) => void;
  etiqueta: string;
  className?: string;
}

/**
 * Campo numérico que se deja escribir como una persona escribe
 * (`4.800.000`, `4800000`, `4,8`) y se muestra siempre formateado al salir.
 */
export function CampoMoneda({ valor, onCambio, etiqueta, className }: Props) {
  const { plano } = useMoneda();
  const [texto, setTexto] = useState(() => plano.format(valor));
  const [editando, setEditando] = useState(false);

  useEffect(() => {
    if (!editando) setTexto(plano.format(valor));
  }, [valor, editando, plano]);

  return (
    <input
      className={`n ${className ?? ""}`}
      inputMode="decimal"
      aria-label={etiqueta}
      value={texto}
      onFocus={(e) => {
        setEditando(true);
        setTexto(valor === 0 ? "" : String(valor));
        requestAnimationFrame(() => e.target.select());
      }}
      onChange={(e) => setTexto(e.target.value)}
      onBlur={() => {
        setEditando(false);
        const n = aNumero(texto);
        setTexto(plano.format(n));
        if (n !== valor) onCambio(n);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
      }}
    />
  );
}
