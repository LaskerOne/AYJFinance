import { BarraProgreso } from "@/components/charts/BarraProgreso";
import { Estado } from "@/components/ui/Etiqueta";
import { useMoneda } from "@/hooks/useMoneda";
import { porcentaje, porcentajeEntero } from "@/lib/formato";
import type { CorteRegla, Finanzas } from "@/lib/calculos";
import css from "../Resumen.module.css";

const COLOR_ESTADO: Record<CorteRegla["estado"], string> = {
  ok: "--ok",
  warn: "--warn",
  crit: "--crit",
};

interface Pista {
  nombre: string;
  detalle: string;
  corte: CorteRegla;
}

function textoDe(c: CorteRegla): string {
  if (c.direccion === "max") {
    return c.fraccion <= c.objetivo
      ? "Dentro del objetivo"
      : `Te pasas por ${porcentaje(c.fraccion - c.objetivo)}`;
  }
  return c.fraccion >= c.objetivo
    ? "Por encima del objetivo"
    : `Te faltan ${porcentaje(c.objetivo - c.fraccion)}`;
}

/** Regla 50/30/20: es un chequeo de estado, no una serie de datos, así que
 *  usa la paleta de estado (verde / ámbar / rojo) con ícono y texto. */
export function ReglaCincuenta({ finanzas }: { finanzas: Finanzas }) {
  const { $ } = useMoneda();

  const pistas: Pista[] = [
    {
      nombre: "Necesidades",
      detalle: "techo, mercado, servicios, salud, cuotas",
      corte: finanzas.regla.necesidades,
    },
    { nombre: "Gustos", detalle: "ocio, personal, otros", corte: finanzas.regla.gustos },
    { nombre: "Ahorro", detalle: "metas y lo que queda libre", corte: finanzas.regla.ahorro },
  ];

  return (
    <div className={css.regla}>
      {pistas.map((p) => (
        <div key={p.nombre} className={css.pista}>
          <div className={css.pistaCabeza}>
            <span className={css.pistaNombre}>
              {p.nombre} <small>{p.detalle}</small>
            </span>
            <span className={css.pistaValor}>
              {porcentaje(p.corte.fraccion)} · {$(p.corte.valor)}
            </span>
          </div>

          <BarraProgreso
            fraccion={p.corte.fraccion}
            color={COLOR_ESTADO[p.corte.estado]}
            marca={p.corte.objetivo}
            tituloMarca={`Objetivo ${porcentajeEntero(p.corte.objetivo)}`}
            etiqueta={`${p.nombre}: ${porcentaje(p.corte.fraccion)} del ingreso`}
          />

          <div className={css.pistaPie}>
            <Estado tono={p.corte.estado}>{textoDe(p.corte)}</Estado>
            <span>
              Objetivo {p.corte.direccion === "max" ? "máx." : "mín."}{" "}
              {porcentajeEntero(p.corte.objetivo)}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
