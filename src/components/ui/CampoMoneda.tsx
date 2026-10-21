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
 *
 * `valor` llega y se devuelve en pesos (la moneda de los datos); si el hogar
 * está viendo USD, aquí se convierte en ambas direcciones, así que se puede
 * teclear en dólares con tranquilidad.
 */
export function CampoMoneda({ valor, onCambio, etiqueta, className }: Props) {
  const { plano, aVista, aPesos, convierte } = useMoneda();
  const visible = convierte ? Number(aVista(valor).toFixed(2)) : valor;
  const [texto, setTexto] = useState(() => plano.format(visible));
  const [editando, setEditando] = useState(false);

  useEffect(() => {
    if (!editando) setTexto(plano.format(visible));
  }, [visible, editando, plano]);

  return (
    <input
      className={`n ${className ?? ""}`}
      inputMode="decimal"
      aria-label={etiqueta}
      value={texto}
      onFocus={(e) => {
        setEditando(true);
        setTexto(visible === 0 ? "" : String(visible));
        requestAnimationFrame(() => e.target.select());
      }}
      onChange={(e) => setTexto(e.target.value)}
      onBlur={() => {
        setEditando(false);
        const n = aNumero(texto);
        setTexto(plano.format(n));
        const enPesos = aPesos(n);
        if (enPesos !== valor) onCambio(enPesos);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
      }}
    />
  );
}
