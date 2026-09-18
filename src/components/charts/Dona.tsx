import { useState } from "react";
import { COLOR_CATEGORIA, type Categoria } from "@/models/dominio";
import { useMoneda } from "@/hooks/useMoneda";
import { useCategorias } from "@/hooks/useCategorias";
import { porcentaje } from "@/lib/formato";
import { useTooltip } from "./useTooltip";
import css from "./charts.module.css";

interface Props {
  datos: Array<{ categoria: Categoria; monto: number }>;
  total: number;
  titulo?: string;
}

const R = 82;
const r = 52;
const C = 92;
const SEPARACION = 0.022; // radianes: el hueco de 2 px entre porciones

function arco(a0: number, a1: number): string {
  const grande = a1 - a0 > Math.PI ? 1 : 0;
  const x0 = C + R * Math.cos(a0);
  const y0 = C + R * Math.sin(a0);
  const x1 = C + R * Math.cos(a1);
  const y1 = C + R * Math.sin(a1);
  const x2 = C + r * Math.cos(a1);
  const y2 = C + r * Math.sin(a1);
  const x3 = C + r * Math.cos(a0);
  const y3 = C + r * Math.sin(a0);
  return [
    `M${x0.toFixed(2)} ${y0.toFixed(2)}`,
    `A${R} ${R} 0 ${grande} 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`,
    `L${x2.toFixed(2)} ${y2.toFixed(2)}`,
    `A${r} ${r} 0 ${grande} 0 ${x3.toFixed(2)} ${y3.toFixed(2)}`,
    "Z",
  ].join(" ");
}

/**
 * Dona de composición con su lista al lado.
 * La lista no es decorativa: tres de los colores de categoría quedan por
 * debajo de 3:1 sobre fondo claro, así que las etiquetas visibles son la
 * compensación obligatoria, no un adorno.
 */
export function Dona({ datos, total, titulo = "Distribución" }: Props) {
  const { $, $corto } = useMoneda();
  const { etiqueta } = useCategorias();
  const { contenedor, mostrar, ocultar, nodo } = useTooltip();
  const [resaltada, setResaltada] = useState<Categoria | null>(null);

  if (datos.length === 0 || total <= 0) {
    return (
      <div className={css.donaCaja}>
        <svg width="184" height="184" viewBox="0 0 184 184" role="img" aria-label="Sin datos">
          <circle cx="92" cy="92" r="67" fill="none" stroke="var(--surface-3)" strokeWidth="30" />
        </svg>
        <p className="vacio">Sin gastos registrados todavía.</p>
      </div>
    );
  }

  let angulo = -Math.PI / 2;
  const porciones = datos.map((d) => {
    const barrido = (d.monto / total) * Math.PI * 2;
    const hueco = datos.length > 1 ? SEPARACION / 2 : 0;
    const a0 = angulo + hueco;
    const a1 = Math.max(angulo + barrido - hueco, angulo + hueco + 0.004);
    angulo += barrido;
    return { ...d, d: arco(a0, a1) };
  });

  return (
    <div className={css.marco} ref={contenedor}>
      <div className={css.donaCaja}>
        <svg width="184" height="184" viewBox="0 0 184 184" role="img" aria-label={titulo}>
          {porciones.map((p) => (
            <path
              key={p.categoria}
              d={p.d}
              fill={`var(${COLOR_CATEGORIA[p.categoria]})`}
              opacity={resaltada && resaltada !== p.categoria ? 0.35 : 1}
              onMouseMove={(e) => {
                setResaltada(p.categoria);
                mostrar(e, p.categoria, `${$(p.monto)} · ${porcentaje(p.monto / total)}`);
              }}
              onMouseLeave={() => {
                setResaltada(null);
                ocultar();
              }}
            />
          ))}
          <text
            x="92"
            y="86"
            textAnchor="middle"
            fontSize="10.5"
            fontFamily="IBM Plex Mono, monospace"
            letterSpacing="1.2"
            fill="var(--ink-3)"
          >
            TOTAL
          </text>
          <text
            x="92"
            y="106"
            textAnchor="middle"
            fontSize="15"
            fontWeight="700"
            fontFamily="Bricolage Grotesque, sans-serif"
            fill="var(--ink)"
          >
            {$corto(total)}
          </text>
        </svg>

        <div className={css.listaCat}>
          {datos.map((d) => (
            <div
              key={d.categoria}
              className={`${css.filaCat} ${resaltada === d.categoria ? css.activa : ""}`}
              onMouseEnter={() => setResaltada(d.categoria)}
              onMouseLeave={() => setResaltada(null)}
            >
              <span
                className={css.muestra}
                style={{ background: `var(${COLOR_CATEGORIA[d.categoria]})` }}
              />
              <span className={css.nombreCat}>{etiqueta(d.categoria)}</span>
              <span className={css.montoCat}>{$(d.monto)}</span>
              <span className={css.pctCat}>{porcentaje(d.monto / total)}</span>
            </div>
          ))}
        </div>
      </div>
      {nodo}
    </div>
  );
}
