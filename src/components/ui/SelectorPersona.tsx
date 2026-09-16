import { useHogar } from "@/contexts/HogarContext";

interface Props {
  valor: string | null;
  onCambio: (usuarioId: string | null) => void;
  etiqueta: string;
  /** Texto de la opción compartida: cambia según la tabla. */
  textoComun?: string;
  className?: string;
}

const COMUN = "__comun__";

/** A quién pertenece una fila: a ti, a tu pareja, o al bote común. */
export function SelectorPersona({
  valor,
  onCambio,
  etiqueta,
  textoComun = "Compartido",
  className,
}: Props) {
  const { perfiles, idA, nombreDe } = useHogar();
  const pareja = perfiles.find((p) => p.id !== idA);

  return (
    <select
      className={className}
      aria-label={etiqueta}
      value={valor ?? COMUN}
      onChange={(e) => onCambio(e.target.value === COMUN ? null : e.target.value)}
    >
      <option value={COMUN}>{textoComun}</option>
      {idA && <option value={idA}>{nombreDe(idA)}</option>}
      {pareja && <option value={pareja.id}>{nombreDe(pareja.id)}</option>}
    </select>
  );
}
