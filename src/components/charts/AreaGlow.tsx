import { useId, useRef, useState, type MouseEvent } from "react";
import { useMoneda } from "@/hooks/useMoneda";
import css from "./charts.module.css";

interface Props {
  /** Valores ya acumulados u ordenados en el tiempo, uno por paso. */
  puntos: number[];
  etiqueta: string;
  etiquetaX: (indice: number) => string;
  /** Línea punteada de referencia (p. ej. el presupuesto del mes). */
  referencia?: number;
  etiquetaReferencia?: string;
  /** Variable CSS del color, p. ej. "--a-ink". */
  color?: string;
  alto?: number;
}

const W = 720;
const PAD = { arriba: 18, derecha: 18, abajo: 28, izquierda: 56 };

/** Área con brillo: una sola serie protagonista que se llena bajo la curva.
 *  Para el héroe de una pantalla, no para comparar series. */
export function AreaGlow({
  puntos,
  etiqueta,
  etiquetaX,
  referencia,
  etiquetaReferencia,
  color = "--a-ink",
  alto = 210,
}: Props) {
  const { $, $corto } = useMoneda();
  const svgRef = useRef<SVGSVGElement>(null);
  const [foco, setFoco] = useState<number | null>(null);
  const idGrad = useId();

  const n = Math.max(2, puntos.length);
  const maxY = Math.max(1, ...puntos, referencia ?? 0) * 1.06;

  const x = (i: number) => PAD.izquierda + (i / (n - 1)) * (W - PAD.izquierda - PAD.derecha);
  const y = (v: number) => PAD.arriba + (1 - v / maxY) * (alto - PAD.arriba - PAD.abajo);
  const en = (i: number) => (i < puntos.length ? puntos[i] : 0);

  const linea = Array.from(
    { length: puntos.length },
    (_, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(en(i)).toFixed(1)}`,
  ).join(" ");
  const base = y(0);
  const area = `${linea} L${x(puntos.length - 1).toFixed(1)} ${base} L${x(0).toFixed(1)} ${base} Z`;

  const alMover = (e: MouseEvent<SVGSVGElement>) => {
    const caja = svgRef.current?.getBoundingClientRect();
    if (!caja) return;
    const enVb = ((e.clientX - caja.left) / caja.width) * W;
    const fraccion = (enVb - PAD.izquierda) / (W - PAD.izquierda - PAD.derecha);
    const i = Math.round(fraccion * (n - 1));
    setFoco(i >= 0 && i < puntos.length ? i : null);
  };

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
        <defs>
          <linearGradient id={idGrad} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={`var(${color})`} stopOpacity="0.34" />
            <stop offset="100%" stopColor={`var(${color})`} stopOpacity="0" />
          </linearGradient>
        </defs>

        {[0, 0.5, 1].map((f) => {
          const vy = y(maxY * f);
          return (
            <g key={f}>
              <line x1={PAD.izquierda} y1={vy} x2={W - PAD.derecha} y2={vy} stroke="var(--grid)" strokeWidth={1} />
              <text x={PAD.izquierda - 8} y={vy + 3.5} textAnchor="end" fontSize="10" fontFamily="var(--cifras)" fill="var(--ink-3)">
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
            fontFamily="var(--cifras)"
            fill="var(--ink-3)"
          >
            {etiquetaX(i)}
          </text>
        ))}

        {referencia !== undefined && referencia > 0 && (
          <g>
            <line
              x1={PAD.izquierda}
              y1={y(referencia)}
              x2={W - PAD.derecha}
              y2={y(referencia)}
              stroke="var(--ink)"
              strokeWidth={1.6}
              strokeDasharray="7 5"
              opacity={0.6}
            />
            {etiquetaReferencia && (
              <text
                x={W - PAD.derecha}
                y={y(referencia) - 6}
                textAnchor="end"
                fontSize="12"
                fontWeight={600}
                fontFamily="var(--display)"
                fill="var(--ink-2)"
              >
                {etiquetaReferencia}
              </text>
            )}
          </g>
        )}

        <path d={area} fill={`url(#${idGrad})`} className={css.areaRelleno} />
        <path
          d={linea}
          fill="none"
          stroke={`var(${color})`}
          strokeWidth={2.5}
          strokeLinejoin="round"
          strokeLinecap="round"
          pathLength={1}
          className={`${css.traza} ${css.conGlow}`}
          style={{ color: `var(${color})` }}
        />

        {puntos.length > 0 && (
          <g className={css.llegaTarde}>
            <circle
              cx={x(puntos.length - 1)}
              cy={y(en(puntos.length - 1))}
              r={5}
              fill="none"
              stroke={`var(${color})`}
              strokeWidth={1.5}
              className={css.anillo}
            />
            <circle
              cx={x(puntos.length - 1)}
              cy={y(en(puntos.length - 1))}
              r={4.5}
              fill={`var(${color})`}
              stroke="var(--surface)"
              strokeWidth={2}
            />
          </g>
        )}

        {foco !== null && (
          <g>
            <line x1={x(foco)} y1={PAD.arriba} x2={x(foco)} y2={alto - PAD.abajo} stroke="var(--line-2)" strokeWidth={1} />
            <circle cx={x(foco)} cy={y(en(foco))} r={5} fill={`var(${color})`} stroke="var(--surface)" strokeWidth={2} />
          </g>
        )}
      </svg>

      {foco !== null && (
        <div
          className={css.tip}
          style={{ left: `${(x(foco) / W) * 100}%`, top: `${(y(en(foco)) / alto) * 100}%` }}
          role="tooltip"
        >
          <span className={css.tipTitulo}>{etiquetaX(foco)}</span>
          <span className={css.tipDetalle}>{$(en(foco))}</span>
        </div>
      )}
    </div>
  );
}
