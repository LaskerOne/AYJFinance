import type { ReactNode } from "react";
import css from "./Kpi.module.css";

export interface DatoKpi {
  etiqueta: string;
  valor: ReactNode;
  detalle?: ReactNode;
  tono?: "neutro" | "positivo" | "negativo";
  destacado?: boolean;
}

/** Fila de cifras grandes. Se usa solo cuando esos números son el titular
 *  de la sección, no como decoración de cualquier bloque. */
export function FilaKpi({ datos, columnas }: { datos: DatoKpi[]; columnas?: number }) {
  const n = columnas ?? datos.length;
  return (
    <div className={css.fila} style={{ ["--columnas" as string]: String(n) }}>
      {datos.map((d) => (
        <div key={d.etiqueta} className={`${css.kpi} ${d.destacado ? css.destacado : ""}`}>
          <span className="eyebrow">{d.etiqueta}</span>
          <span className={`${css.valor} ${d.tono === "positivo" ? css.pos : ""} ${d.tono === "negativo" ? css.neg : ""}`}>
            {d.valor}
          </span>
          {d.detalle !== undefined && <span className={css.detalle}>{d.detalle}</span>}
        </div>
      ))}
    </div>
  );
}
