import { useRef, useState, type MouseEvent } from "react";
import { useMoneda } from "@/hooks/useMoneda";
import css from "./charts.module.css";

export interface Serie {
  nombre: string;
  puntos: number[];
  color: string;
  /** Punteada = línea de referencia. Da un segundo canal además del color. */
  punteada?: boolean;
}

interface Props {
  series: Serie[];
  etiqueta: string;
  alto?: number;
  etiquetaX?: (indice: number) => string;
}

const W = 720;
const PAD = { arriba: 16, derecha: 18, abajo: 28, izquierda: 62 };

/** Serie temporal con cruceta: al pasar el puntero se leen todos los valores
 *  de ese mes a la vez, que es la comparación que interesa. */
export function LineaTiempo({ series, etiqueta, alto = 200, etiquetaX }: Props) {
  const { $, $corto } = useMoneda();
  const svgRef = useRef<SVGSVGElement>(null);
  const [foco, setFoco] = useState<number | null>(null);

  const n = Math.max(2, ...series.map((s) => s.puntos.length));
  const maxY = Math.max(1, ...series.flatMap((s) => s.puntos));

  const x = (i: number) => PAD.izquierda + (i / (n - 1)) * (W - PAD.izquierda - PAD.derecha);
  const y = (v: number) => PAD.arriba + (1 - v / maxY) * (alto - PAD.arriba - PAD.abajo);
  const valorEn = (s: Serie, i: number) => (i < s.puntos.length ? s.puntos[i] : 0);

  const trazo = (s: Serie) =>
    Array.from({ length: n }, (_, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(valorEn(s, i)).toFixed(1)}`).join(" ");

  const alMover = (e: MouseEvent<SVGSVGElement>) => {
    const caja = svgRef.current?.getBoundingClientRect();
    if (!caja) return;
    const enVb = ((e.clientX - caja.left) / caja.width) * W;
    const fraccion = (enVb - PAD.izquierda) / (W - PAD.izquierda - PAD.derecha);
    const i = Math.round(fraccion * (n - 1));
    setFoco(i >= 0 && i < n ? i : null);
  };

  const nombreX = etiquetaX ?? ((i: number) => (i === 0 ? "hoy" : `mes ${i}`));

  return (
    <div className={css.marco}>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${alto}`}
        className={css.svgPleno}
        role="img"
        aria-label={etiqueta}
        onMouseMove={alMover}
        onMouseLeave={() => setFoco(null)}
      >
        {[0, 0.5, 1].map((f) => {
          const vy = y(maxY * f);
          return (
            <g key={f}>
              <line
                x1={PAD.izquierda}
                y1={vy}
                x2={W - PAD.derecha}
                y2={vy}
                stroke="var(--grid)"
                strokeWidth={1}
              />
              <text
                x={PAD.izquierda - 8}
                y={vy + 3.5}
                textAnchor="end"
                fontSize="10"
                fontFamily="IBM Plex Mono, monospace"
                fill="var(--ink-3)"
              >
                {$corto(maxY * f)}
              </text>
            </g>
          );
        })}

        {[0, Math.floor((n - 1) / 2), n - 1].map((i, k) => (
          <text
            key={`${i}-${k}`}
            x={x(i)}
            y={alto - 9}
            textAnchor={k === 0 ? "start" : k === 2 ? "end" : "middle"}
            fontSize="10"
            fontFamily="IBM Plex Mono, monospace"
            fill="var(--ink-3)"
          >
            {nombreX(i)}
          </text>
        ))}

        {foco !== null && (
          <line
            x1={x(foco)}
            y1={PAD.arriba}
            x2={x(foco)}
            y2={alto - PAD.abajo}
            stroke="var(--line-2)"
            strokeWidth={1}
          />
        )}

        {series.map((s) => (
          <path
            key={s.nombre}
            d={trazo(s)}
            fill="none"
            stroke={`var(${s.color})`}
            strokeWidth={s.punteada ? 2 : 2.5}
            strokeDasharray={s.punteada ? "5 4" : undefined}
            strokeLinejoin="round"
          />
        ))}

        {series.map((s) => {
          const ultimo = s.puntos.length - 1;
          if (ultimo < 0 || s.punteada) return null;
          return (
            <circle
              key={`fin-${s.nombre}`}
              cx={x(ultimo)}
              cy={y(s.puntos[ultimo])}
              r={4.5}
              fill={`var(${s.color})`}
              stroke="var(--surface)"
              strokeWidth={2}
            />
          );
        })}

        {foco !== null &&
          series.map((s) => (
            <circle
              key={`foco-${s.nombre}`}
              cx={x(foco)}
              cy={y(valorEn(s, foco))}
              r={4}
              fill={`var(${s.color})`}
              stroke="var(--surface)"
              strokeWidth={2}
            />
          ))}
      </svg>

      {foco !== null && (
        <div
          className={css.tip}
          style={{ left: `${(x(foco) / W) * 100}%`, top: "8px" }}
          role="tooltip"
        >
          <span className={css.tipTitulo}>{nombreX(foco)}</span>
          {series.map((s) => (
            <span key={s.nombre} className={css.tipDetalle}>
              {s.nombre}: {$(valorEn(s, foco))}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
