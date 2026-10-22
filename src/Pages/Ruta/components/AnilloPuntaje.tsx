import { Cifra } from "@/components/ui/Cifra";
import css from "../Ruta.module.css";

const R = 54;
const C = 2 * Math.PI * R;

/**
 * El puntaje como un anillo que se llena hasta su valor al entrar, con el
 * número contando en el centro. El color es el de la casa; el estado lo dice
 * el texto de al lado, nunca el color solo.
 */
export function AnilloPuntaje({ total }: { total: number }) {
  const lleno = Math.max(0, Math.min(100, total)) / 100;
  return (
    <div className={css.anillo} role="img" aria-label={`Puntaje de salud: ${total} de 100`}>
      <svg viewBox="0 0 140 140" aria-hidden="true">
        <circle cx="70" cy="70" r={R} className={css.anilloRiel} />
        <circle
          cx="70"
          cy="70"
          r={R}
          className={css.anilloValor}
          strokeDasharray={C}
          style={{ ["--falta" as string]: String(C * (1 - lleno)), ["--total" as string]: String(C) }}
          transform="rotate(-90 70 70)"
        />
      </svg>
      <span className={css.anilloNumero}>
        <Cifra valor={total} formato={(n) => String(Math.round(n))} />
        <span className={css.anilloDe}>/ 100</span>
      </span>
    </div>
  );
}
