import { useId } from "react";
import { useMoneda } from "@/hooks/useMoneda";
import { useTooltip } from "./useTooltip";
import css from "./charts.module.css";

export interface ColumnaNeto {
  etiqueta: string;
  valor: number;
  detalle?: string;
}

const W = 720;
const PAD = { arriba: 22, abajo: 30, lados: 8 };

/**
 * Barras divergentes sobre una línea de cero: lo que sobra sube en el color
 * de la casa y lo que falta baja en rojo. Cada barra lleva su cifra, así que
 * el signo nunca depende solo del color.
 */
export function BarrasNeto({
  columnas,
  etiqueta,
  alto = 200,
}: {
  columnas: ColumnaNeto[];
  etiqueta: string;
  alto?: number;
}) {
  const { $, $corto } = useMoneda();
  const { contenedor, mostrar, ocultar, nodo } = useTooltip();
  const id = useId();

  const max = Math.max(0, ...columnas.map((c) => c.valor));
  const min = Math.min(0, ...columnas.map((c) => c.valor));
  const rango = Math.max(1, max - min);
  const alturaUtil = alto - PAD.arriba - PAD.abajo;
  const y = (v: number) => PAD.arriba + ((max - v) / rango) * alturaUtil;
  const cero = y(0);

  const paso = (W - PAD.lados * 2) / Math.max(1, columnas.length);
  const ancho = Math.min(38, paso * 0.62);

  return (
    <div className={css.marco} ref={contenedor}>
      <svg viewBox={`0 0 ${W} ${alto}`} className={css.svgPleno} role="img" aria-label={etiqueta}>
        <defs>
          {/* Volumen de prisma: cara izquierda iluminada, derecha en sombra. */}
          <linearGradient id={`${id}-volumen`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#fff" stopOpacity="0.32" />
            <stop offset="45%" stopColor="#fff" stopOpacity="0" />
            <stop offset="100%" stopColor="#000" stopOpacity="0.24" />
          </linearGradient>
        </defs>
        <line x1={PAD.lados} x2={W - PAD.lados} y1={cero} y2={cero} stroke="var(--axis)" strokeWidth={1} />
        {columnas.map((c, i) => {
          const cx = PAD.lados + paso * i + paso / 2;
          const arriba = c.valor >= 0;
          const h = Math.max(2, Math.abs(y(c.valor) - cero));
          const top = arriba ? cero - h : cero;
          return (
            <g
              key={c.etiqueta + i}
              className={css.netoGrupo}
              style={{ color: arriba ? "var(--a)" : "var(--crit)" }}
              onMouseMove={(e) => mostrar(e, c.etiqueta, `${$(c.valor)}${c.detalle ? ` · ${c.detalle}` : ""}`)}
              onMouseLeave={ocultar}
            >
              {/* Zona de toque más grande que la barra. */}
              <rect x={cx - paso / 2} y={PAD.arriba - 10} width={paso} height={alto - PAD.arriba} fill="transparent" />
              <rect
                x={cx - ancho / 2}
                y={top}
                width={ancho}
                height={h}
                rx={4}
                fill={arriba ? "var(--a)" : "var(--crit)"}
                className={arriba ? css.netoArriba : css.netoAbajo}
                style={{ animationDelay: `${i * 45}ms` }}
              />
              <rect
                x={cx - ancho / 2}
                y={top}
                width={ancho}
                height={h}
                rx={4}
                fill={`url(#${id}-volumen)`}
                className={`${css.volumen} ${arriba ? css.netoArriba : css.netoAbajo}`}
                style={{ animationDelay: `${i * 45}ms` }}
              />
              <text
                x={cx}
                y={arriba ? top - 6 : top + h + 13}
                textAnchor="middle"
                fontSize="10"
                fontFamily="var(--cifras)"
                fill="var(--ink-2)"
              >
                {c.valor < 0 ? "−" : ""}
                {$corto(Math.abs(c.valor))}
              </text>
              <text
                x={cx}
                y={alto - 9}
                textAnchor="middle"
                fontSize="10.5"
                fontFamily="var(--cifras)"
                fill="var(--ink-3)"
              >
                {c.etiqueta}
              </text>
            </g>
          );
        })}
      </svg>
      {nodo}
    </div>
  );
}
