import { useId } from "react";
import css from "./TuboMeta.module.css";

/**
 * Un tanque de vidrio en 3D (cilindro isométrico) donde la altura completa
 * es la meta y el líquido es lo que llevan ahorrado. El líquido sube al
 * montar, y su superficie tiene dos olas que viajan en sentidos opuestos.
 * Todo es SVG + CSS; con `prefers-reduced-motion` queda al nivel exacto,
 * quieto.
 */

const ANCHO = 120;
const ALTO = 196;
const CX = 60;
const RX = 38;
const RY = 11;
const TAPA = 24; // y del borde superior
const FONDO = 160; // y del fondo

/** Una banda con la superficie ondulada, para animarla de lado a lado. */
function ola(nivel: number): string {
  // Empieza bien a la izquierda y mide el doble del vaso: al desplazarse
  // un periodo completo, el bucle no se nota.
  const q = "q 19 -9 38 0 t 38 0 t 38 0 t 38 0";
  return `M ${CX - RX - 76} ${nivel} ${q} V ${FONDO + RY + 2} H ${CX - RX - 76} Z`;
}

export function TuboMeta({
  fraccion,
  cumplida,
  lado,
}: {
  fraccion: number;
  cumplida: boolean;
  /** De quién es la meta: el líquido toma su color, o los dos si es compartida. */
  lado: "a" | "b" | "comun";
}) {
  const id = useId();
  const f = Math.max(0, Math.min(1, fraccion));
  const nivel = TAPA + (1 - f) * (FONDO - TAPA);
  const sube = FONDO - nivel;

  return (
    <svg
      viewBox={`0 0 ${ANCHO} ${ALTO}`}
      className={`${css.tanque} ${cumplida ? css.lleno : ""}`}
      data-lado={lado}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={`${id}-liquido`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--l1)" />
          <stop offset="100%" stopColor="var(--l2)" />
        </linearGradient>
        <clipPath id={`${id}-interior`}>
          <path
            d={`M ${CX - RX} ${TAPA} H ${CX + RX} V ${FONDO} A ${RX} ${RY} 0 0 1 ${CX - RX} ${FONDO} Z`}
          />
        </clipPath>
      </defs>

      {/* la pared trasera del vaso */}
      <path
        d={`M ${CX - RX} ${TAPA} V ${FONDO} A ${RX} ${RY} 0 0 0 ${CX + RX} ${FONDO} V ${TAPA}`}
        className={css.vidrio}
      />

      {/* el líquido, recortado al interior y subiendo hasta su nivel */}
      <g clipPath={`url(#${id}-interior)`}>
        <g className={css.liquido} style={{ ["--sube" as string]: `${sube.toFixed(1)}px` }}>
          {f > 0 && (
            <>
              <path d={ola(nivel)} fill={`url(#${id}-liquido)`} className={css.ola1} />
              <path d={ola(nivel)} fill={`url(#${id}-liquido)`} className={css.ola2} />
              <ellipse
                cx={CX}
                cy={nivel}
                rx={RX}
                ry={RY - 2.5}
                className={css.superficie}
              />
            </>
          )}
        </g>
        {/* brillo del vidrio */}
        <rect x={CX - RX + 9} y={TAPA + 6} width={7} height={FONDO - TAPA - 14} rx={3.5} className={css.brillo} />
      </g>

      {/* boca del vaso, encima del líquido */}
      <ellipse cx={CX} cy={TAPA} rx={RX} ry={RY} className={css.boca} />
    </svg>
  );
}
