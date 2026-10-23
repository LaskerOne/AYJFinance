import type { MouseEvent, ReactNode } from "react";
import css from "./Kpi.module.css";

/** Inclina la tarjeta hacia el puntero (3D sutil). Con reduced-motion no hace nada. */
function inclinar(e: MouseEvent<HTMLDivElement>) {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const el = e.currentTarget;
  const caja = el.getBoundingClientRect();
  const px = (e.clientX - caja.left) / caja.width - 0.5;
  const py = (e.clientY - caja.top) / caja.height - 0.5;
  el.style.setProperty("--rx", `${(-py * 5).toFixed(2)}deg`);
  el.style.setProperty("--ry", `${(px * 7).toFixed(2)}deg`);
}

function enderezar(e: MouseEvent<HTMLDivElement>) {
  e.currentTarget.style.setProperty("--rx", "0deg");
  e.currentTarget.style.setProperty("--ry", "0deg");
}

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
        <div
          key={d.etiqueta}
          className={`bordeViajero ${css.kpi} ${d.destacado ? css.destacado : ""}`}
          onMouseMove={inclinar}
          onMouseLeave={enderezar}
        >
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
