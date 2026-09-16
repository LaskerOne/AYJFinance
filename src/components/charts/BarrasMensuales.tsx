import { useMoneda } from "@/hooks/useMoneda";
import { nombrePeriodo } from "@/lib/formato";
import { useTooltip } from "./useTooltip";
import css from "./charts.module.css";

export interface ColumnaMes {
  periodo: string;
  valores: Array<{ nombre: string; valor: number; color: string }>;
}

/** Barras agrupadas por mes: la comparación mes contra mes del histórico. */
export function BarrasMensuales({ meses, etiqueta }: { meses: ColumnaMes[]; etiqueta: string }) {
  const { $ } = useMoneda();
  const { contenedor, mostrar, ocultar, nodo } = useTooltip();

  const maximo = Math.max(
    1,
    ...meses.flatMap((m) => m.valores.map((v) => Math.abs(v.valor))),
  );

  return (
    <div className={css.marco} ref={contenedor}>
      <div className={css.mesesCaja} role="img" aria-label={etiqueta}>
        {meses.map((m) => (
          <div key={m.periodo} className={css.mes}>
            <div className={css.columnas}>
              {m.valores.map((v) => (
                <div
                  key={v.nombre}
                  className={css.columna}
                  style={{
                    height: `${Math.max(2, (Math.abs(v.valor) / maximo) * 100)}%`,
                    background: `var(${v.color})`,
                    opacity: v.valor < 0 ? 0.45 : 1,
                  }}
                  onMouseMove={(e) =>
                    mostrar(e, `${v.nombre} · ${nombrePeriodo(m.periodo)}`, $(v.valor))
                  }
                  onMouseLeave={ocultar}
                />
              ))}
            </div>
            <span className={css.etiquetaMes}>{nombrePeriodo(m.periodo).slice(0, 3)}</span>
          </div>
        ))}
      </div>
      {nodo}
    </div>
  );
}
