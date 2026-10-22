import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { FilaKpi } from "@/components/ui/Kpi";
import { useHogar } from "@/contexts/HogarContext";
import { useFinanzas } from "@/hooks/useFinanzas";
import { useMoneda } from "@/hooks/useMoneda";
import { conAbonoUnico, simularDeudas } from "@/lib/deudas";
import { aNumero, enMeses } from "@/lib/formato";
import { proximaPrima } from "@/lib/proyeccion";
import css from "../Proyeccion.module.css";

/**
 * Qué hacer con la próxima prima antes de que llegue: repartirla entre
 * deuda, colchón y gusto, y ver qué compra cada parte. Decidirlo con
 * anticipación es la diferencia entre que la prima rinda o se evapore.
 */
export function PlanPrima() {
  const { ingresos, deudas, hogar } = useHogar();
  const f = useFinanzas();
  const { $ } = useMoneda();

  const prima = proximaPrima(ingresos);
  const hayDeuda = deudas.some((d) => Number(d.saldo) > 0);
  const [aDeuda, setADeuda] = useState(hayDeuda ? 50 : 0);
  const [aColchon, setAColchon] = useState(hayDeuda ? 30 : 60);
  const disfrutar = Math.max(0, 100 - aDeuda - aColchon);

  const estrategia = hogar?.estrategia_deuda ?? "avalancha";
  const abono = Number(hogar?.abono_extra ?? 0);
  const monto = prima?.monto ?? 0;
  const montoDeuda = (monto * aDeuda) / 100;
  const montoColchon = (monto * aColchon) / 100;

  const { antes, despues } = useMemo(
    () => ({
      antes: simularDeudas(deudas, abono, estrategia, true),
      despues: simularDeudas(conAbonoUnico(deudas, montoDeuda, estrategia), abono, estrategia, true),
    }),
    [deudas, abono, estrategia, montoDeuda],
  );
  const comparable = hayDeuda && !antes.estancado && !despues.estancado;

  return (
    <section className="panel">
      <header>
        <div>
          <h2>Plan para la prima</h2>
          <p className="nota">
            Decidir antes de que llegue a qué va cada peso de la prima es lo que hace que rinda.
            Muevan las partes y miren qué compra cada una.
          </p>
        </div>
        {prima && (
          <span className="eyebrow">
            {prima.enMeses === 0 ? "Llega este mes" : `Llega en ${prima.mes}`} · ≈ {$(monto)}
          </span>
        )}
      </header>

      {!prima ? (
        <p className="vacio">
          Ningún ingreso está marcado como salario con prestaciones. Si alguno de los dos es
          empleado con prima, márquenlo en <Link to="/presupuesto">Presupuesto</Link> y aquí
          aparecerá el plan.
        </p>
      ) : (
        <>
          <div className={css.reparto}>
            <label className={css.parte}>
              <span className={css.parteNombre}>
                A la deuda <b className="num">{aDeuda} %</b>
              </span>
              <input
                type="range"
                min={0}
                max={100}
                step={5}
                value={aDeuda}
                disabled={!hayDeuda}
                onChange={(e) => {
                  const v = aNumero(e.target.value);
                  setADeuda(v);
                  setAColchon((c) => Math.min(c, 100 - v));
                }}
                style={{ ["--lleno" as string]: `${aDeuda}%` }}
              />
            </label>
            <label className={css.parte}>
              <span className={css.parteNombre}>
                Al colchón <b className="num">{aColchon} %</b>
              </span>
              <input
                type="range"
                min={0}
                max={100}
                step={5}
                value={aColchon}
                onChange={(e) => {
                  const v = aNumero(e.target.value);
                  setAColchon(v);
                  setADeuda((d) => Math.min(d, 100 - v));
                }}
                style={{ ["--lleno" as string]: `${aColchon}%` }}
              />
            </label>
            <p className={css.disfrutar}>
              Para disfrutar: <b className="num">{disfrutar} %</b> · {$((monto * disfrutar) / 100)}.
              Darse un gusto también es parte del plan: sin él, el plan no dura.
            </p>
          </div>

          <FilaKpi
            columnas={3}
            datos={[
              {
                etiqueta: `A la deuda · ${$(montoDeuda)}`,
                valor: comparable ? enMeses(Math.max(0, antes.meses - despues.meses)) : "—",
                detalle: comparable
                  ? `antes libres de deudas · ${$(Math.max(0, antes.intereses - despues.intereses))} menos en intereses`
                  : hayDeuda
                    ? "El plan actual no baja el saldo"
                    : "No tienen deudas",
                tono: "positivo",
              },
              {
                etiqueta: `Al colchón · ${$(montoColchon)}`,
                valor:
                  f.costoVida > 0
                    ? `+${(montoColchon / f.costoVida).toFixed(1).replace(".", ",")} meses`
                    : "—",
                detalle: "de vida cubiertos por el fondo de emergencia",
                tono: "positivo",
              },
              {
                etiqueta: "Para disfrutar",
                valor: $((monto * disfrutar) / 100),
                detalle: "Sin culpa: está en el plan",
              },
            ]}
          />
          <p className={css.pie}>
            Cálculo aproximado: medio salario de cada ingreso marcado con prestaciones. La prima
            real se liquida sobre el salario base (con auxilio de transporte si aplica), así que
            puede variar un poco. El abono a deuda se aplica a la deuda prioritaria de su estrategia.
          </p>
        </>
      )}
    </section>
  );
}
