import { useEffect, useId, useRef, useState, type MouseEvent } from "react";
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

/**
 * Cuando los datos cambian (p. ej. al mover un deslizador), la curva no
 * salta: fluye hacia su nueva forma. Cada cuadro acerca el valor pintado al
 * objetivo; las series que se acortan se rellenan con ceros y al aterrizar
 * quedan exactas. Con `prefers-reduced-motion` devuelve el objetivo directo.
 */
function usarSeriesFluidas(series: Serie[]): Serie[] {
  const [pintadas, setPintadas] = useState(series);
  const objetivo = useRef(series);
  objetivo.current = series;
  const valores = useRef(new Map<string, number[]>());

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setPintadas(series);
      return;
    }
    let marco = 0;
    const paso = () => {
      let llego = true;
      const prox = objetivo.current.map((s) => {
        const previos = valores.current.get(s.nombre) ?? s.puntos;
        const largo = Math.max(previos.length, s.puntos.length);
        const pts = Array.from({ length: largo }, (_, i) => {
          const a = previos[i] ?? 0;
          const b = s.puntos[i] ?? 0;
          if (Math.abs(b - a) < Math.max(1, Math.abs(b)) * 0.002) return b;
          llego = false;
          return a + (b - a) * 0.22;
        });
        return { ...s, puntos: pts };
      });
      prox.forEach((s) => valores.current.set(s.nombre, s.puntos));
      if (llego) {
        // Aterrizaje exacto: fuera los ceros de relleno, datos tal cual.
        objetivo.current.forEach((s) => valores.current.set(s.nombre, s.puntos));
        setPintadas(objetivo.current);
      } else {
        setPintadas(prox);
        marco = requestAnimationFrame(paso);
      }
    };
    marco = requestAnimationFrame(paso);
    return () => cancelAnimationFrame(marco);
  }, [series]);

  return pintadas;
}

/** Serie temporal con cruceta: al pasar el puntero se leen todos los valores
 *  de ese mes a la vez, que es la comparación que interesa. */
export function LineaTiempo({ series: objetivo, etiqueta, alto = 200, etiquetaX }: Props) {
  const { $, $corto } = useMoneda();
  const svgRef = useRef<SVGSVGElement>(null);
  const [foco, setFoco] = useState<number | null>(null);
  const idGrad = useId();
  const series = usarSeriesFluidas(objetivo);

  const n = Math.max(2, ...series.map((s) => s.puntos.length));
  const maxY = Math.max(1, ...series.flatMap((s) => s.puntos));
  // Admite valores negativos (un patrimonio puede estarlo): la escala baja
  // hasta el mínimo y el cero se dibuja como línea de referencia.
  const minY = Math.min(0, ...series.flatMap((s) => s.puntos));

  const x = (i: number) => PAD.izquierda + (i / (n - 1)) * (W - PAD.izquierda - PAD.derecha);
  const y = (v: number) =>
    PAD.arriba + ((maxY - v) / (maxY - minY)) * (alto - PAD.arriba - PAD.abajo);
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
        className={`${css.svgPleno} ${css.escena3d}`}
        role="img"
        aria-label={etiqueta}
        onMouseMove={alMover}
        onMouseLeave={() => setFoco(null)}
      >
        {(minY < 0 ? [minY, 0, maxY] : [0, maxY / 2, maxY]).map((f) => {
          const vy = y(f);
          return (
            <g key={f}>
              <line
                x1={PAD.izquierda}
                y1={vy}
                x2={W - PAD.derecha}
                y2={vy}
                stroke={f === 0 && minY < 0 ? "var(--axis)" : "var(--grid)"}
                strokeWidth={1}
              />
              <text
                x={PAD.izquierda - 8}
                y={vy + 3.5}
                textAnchor="end"
                fontSize="10"
                fontFamily="JetBrains Mono, monospace"
                fill="var(--ink-3)"
              >
                {f < 0 ? "−" : ""}
                {$corto(Math.abs(f))}
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
            fontFamily="JetBrains Mono, monospace"
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

        <defs>
          {series.map(
            (s, k) =>
              !s.punteada && (
                <linearGradient key={s.nombre} id={`${idGrad}-${k}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={`var(${s.color})`} stopOpacity="0.26" />
                  <stop offset="100%" stopColor={`var(${s.color})`} stopOpacity="0" />
                </linearGradient>
              ),
          )}
        </defs>

        {/* El relleno bajo cada curva sólida le da cuerpo al gráfico. */}
        {series.map((s, k) => {
          if (s.punteada || s.puntos.length === 0) return null;
          const base = y(0);
          return (
            <path
              key={`area-${s.nombre}`}
              d={`${trazo(s)} L${x(n - 1).toFixed(1)} ${base} L${x(0).toFixed(1)} ${base} Z`}
              fill={`url(#${idGrad}-${k})`}
              className={css.areaRelleno}
            />
          );
        })}

        {series.map((s) => (
          <path
            key={s.nombre}
            d={trazo(s)}
            fill="none"
            stroke={`var(${s.color})`}
            strokeWidth={s.punteada ? 2 : 2.5}
            strokeDasharray={s.punteada ? "5 4" : undefined}
            strokeLinejoin="round"
            // La animación de trazado pisa el dasharray, así que las series
            // punteadas no se animan: conservan su patrón. Las sólidas llevan
            // el neón de la casa.
            pathLength={s.punteada ? undefined : 1}
            className={s.punteada ? undefined : `${css.traza} ${css.conGlow}`}
            style={s.punteada ? undefined : { color: `var(${s.color})` }}
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
              className={css.llegaTarde}
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
