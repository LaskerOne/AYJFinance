import css from "./Medidor.module.css";

export interface Zona {
  /** Límite superior de la zona, en las mismas unidades que `valor`. */
  hasta: number;
  tono: "ok" | "warn" | "crit";
}

/**
 * Un riel con zonas de estado (bien / cuidado / alerta) y una aguja en el
 * valor. Las zonas se pintan tenues y la aguja es neutra: el color de estado
 * lo dice la zona y el chip con texto, nunca la aguja sola.
 */
export function Medidor({
  valor,
  min,
  max,
  zonas,
  etiqueta,
}: {
  valor: number;
  min: number;
  max: number;
  zonas: Zona[];
  etiqueta: string;
}) {
  const pos = (v: number) => Math.max(0, Math.min(1, (v - min) / (max - min))) * 100;
  let desde = min;

  return (
    <div className={css.medidor} role="img" aria-label={etiqueta}>
      <div className={css.riel}>
        {zonas.map((z, i) => {
          const ancho = pos(Math.min(z.hasta, max)) - pos(desde);
          desde = z.hasta;
          return ancho > 0 ? (
            <span key={i} className={css.zona} data-tono={z.tono} style={{ width: `${ancho}%` }} />
          ) : null;
        })}
      </div>
      <span className={css.aguja} style={{ left: `${pos(valor)}%` }} />
    </div>
  );
}
