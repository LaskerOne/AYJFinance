import { useMoneda } from "@/hooks/useMoneda";
import { porcentaje } from "@/lib/formato";
import { useTooltip } from "./useTooltip";
import css from "./charts.module.css";

export interface Segmento {
  nombre: string;
  valor: number;
  color: string; // variable CSS, p. ej. "--s-gasto"
}

interface Props {
  segmentos: Segmento[];
  total: number;
  alto?: number;
  etiqueta: string;
  conLeyenda?: boolean;
}

/** Barra apilada horizontal: a dónde se reparte un total. */
export function BarraApilada({ segmentos, total, alto = 26, etiqueta, conLeyenda = true }: Props) {
  const { $ } = useMoneda();
  const { contenedor, mostrar, ocultar, nodo } = useTooltip();
  const visibles = segmentos.filter((s) => s.valor > 0);

  return (
    <div className={css.marco} ref={contenedor}>
      <div className={css.apilada} style={{ height: `${alto}px` }} role="img" aria-label={etiqueta}>
        {visibles.map((s) => (
          <div
            key={s.nombre}
            className={css.segmento}
            style={{
              width: total > 0 ? `${(s.valor / total) * 100}%` : "0%",
              background: `var(${s.color})`,
            }}
            onMouseMove={(e) =>
              mostrar(e, s.nombre, `${$(s.valor)} · ${porcentaje(total > 0 ? s.valor / total : 0)}`)
            }
            onMouseLeave={ocultar}
          />
        ))}
      </div>

      {conLeyenda && <LeyendaSegmentos segmentos={visibles} total={total} />}
      {nodo}
    </div>
  );
}

export function LeyendaSegmentos({
  segmentos,
  total,
  conValores = true,
}: {
  segmentos: Segmento[];
  total?: number;
  conValores?: boolean;
}) {
  const { $ } = useMoneda();
  return (
    <div className={css.leyenda}>
      {segmentos.map((s) => (
        <span key={s.nombre} className={css.item}>
          <span className={css.muestra} style={{ background: `var(${s.color})` }} />
          {s.nombre}
          {conValores && <b>{$(s.valor)}</b>}
          {conValores && total !== undefined && total > 0 && (
            <span className={css.pct}>{porcentaje(s.valor / total)}</span>
          )}
        </span>
      ))}
    </div>
  );
}
