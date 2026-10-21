import { useMoneda } from "@/hooks/useMoneda";
import { porcentajeEntero } from "@/lib/formato";
import css from "./charts.module.css";

export interface FilaRanking {
  nombre: string;
  valor: number;
}

/**
 * Ranking horizontal en un solo tono: la identidad la lleva la etiqueta de
 * cada fila, no el color, así que no hace falta un arcoíris. La barra más
 * larga es la primera y el brillo marca la protagonista.
 */
export function BarrasRanking({
  filas,
  total,
  etiqueta,
}: {
  filas: FilaRanking[];
  total: number;
  etiqueta: string;
}) {
  const { $ } = useMoneda();
  const ordenadas = [...filas].filter((f) => f.valor > 0).sort((a, b) => b.valor - a.valor);
  const mayor = Math.max(1, ...ordenadas.map((f) => f.valor));

  if (ordenadas.length === 0) {
    return <p className="vacio">Sin gastos registrados todavía.</p>;
  }

  return (
    <div className={css.ranking} role="img" aria-label={etiqueta}>
      {ordenadas.map((f, i) => (
        <div
          key={f.nombre}
          className={css.filaRanking}
          style={{ ["--i" as string]: String(i) }}
        >
          <span className={css.rankNombre}>{f.nombre}</span>
          <span className={css.rankPista}>
            <span
              className={`${css.rankBarra} ${i === 0 ? css.rankTop : ""}`}
              style={{ width: `${(f.valor / mayor) * 100}%` }}
            />
          </span>
          <span className={`num ${css.rankValor}`}>{$(f.valor)}</span>
          <span className={css.rankPct}>{total > 0 ? porcentajeEntero(f.valor / total) : "—"}</span>
        </div>
      ))}
    </div>
  );
}
