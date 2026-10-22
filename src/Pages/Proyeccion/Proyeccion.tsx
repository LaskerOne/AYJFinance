import { useMemo } from "react";
import { Link } from "react-router-dom";
import { BarrasNeto } from "@/components/charts/BarrasNeto";
import { Cifra } from "@/components/ui/Cifra";
import { Estado } from "@/components/ui/Etiqueta";
import { useHogar } from "@/contexts/HogarContext";
import { useMoneda } from "@/hooks/useMoneda";
import { proyectarFlujo, provisiones, sinMesDePago } from "@/lib/proyeccion";
import { Calendario } from "./components/Calendario";
import { Provisiones } from "./components/Provisiones";
import { PlanPrima } from "./components/PlanPrima";
import { Escenarios } from "./components/Escenarios";
import css from "./Proyeccion.module.css";

/**
 * Los próximos doce meses con la caja real: cuándo entran las primas, cuándo
 * pegan los pagos anuales, cuándo termina cada deuda. Y debajo, las tres
 * herramientas para prepararse: provisiones, el plan de la prima y el
 * ensayo de escenarios.
 */
export function Proyeccion() {
  const { ingresos, gastos, deudas, metas } = useHogar();
  const { $ } = useMoneda();

  const meses = useMemo(
    () => proyectarFlujo({ ingresos, gastos, deudas, metas }),
    [ingresos, gastos, deudas, metas],
  );
  const listaProvisiones = useMemo(() => provisiones(gastos), [gastos]);
  const faltanMes = sinMesDePago(ingresos, gastos);

  const final = meses[meses.length - 1]?.acumulado ?? 0;
  const enRojo = meses.filter((m) => m.neto < 0).length;
  const peor = meses.reduce((p, m) => (m.neto < p.neto ? m : p), meses[0]);
  const aportesAnio = meses.reduce((s, m) => s + m.aportes, 0);

  return (
    <>
      <section className="panel hero heroGrid">
        <div className="heroCifras">
          <span className="eyebrow">Sin asignar en 12 meses</span>
          <span className={`heroNumero ${final >= 0 ? "heroPos" : "heroNeg"}`}>
            <Cifra valor={final} formato={$} />
          </span>
          <span className="heroDetalle">
            Lo que sobraría (o faltaría) sumando cada mes, con los aportes a metas tal como están.
            {aportesAnio > 0 && <> Aparte, {$(aportesAnio)} irían a metas.</>}
          </span>
          <div className="heroChips">
            {enRojo > 0 ? (
              <Estado tono={enRojo > 3 ? "crit" : "warn"}>
                {enRojo} {enRojo === 1 ? "mes" : "meses"} en rojo
              </Estado>
            ) : (
              <Estado tono="ok">Ningún mes en rojo</Estado>
            )}
            {peor && peor.neto < 0 && (
              <Estado tono="neutro">
                Más apretado: {peor.nombre} ({$(peor.neto)})
              </Estado>
            )}
          </div>
        </div>
        <div className="heroGrafico">
          <span className="eyebrow">Sobra o falta, mes a mes</span>
          <BarrasNeto
            columnas={meses.map((m) => ({
              etiqueta: m.nombre.slice(0, 3),
              valor: m.neto,
              detalle: m.eventos.length ? m.eventos.map((e) => e.texto).join(", ") : undefined,
            }))}
            etiqueta="Lo que sobra o falta cada uno de los próximos doce meses"
            alto={190}
          />
        </div>
      </section>

      {faltanMes > 0 && (
        <p className={css.aviso}>
          <Estado tono="warn">Falta un dato</Estado> {faltanMes}{" "}
          {faltanMes === 1 ? "concepto no mensual no tiene" : "conceptos no mensuales no tienen"} mes
          de pago, así que se reparten parejo y no se ven sus picos.{" "}
          <Link to="/presupuesto">Asígnenlo en Presupuesto</Link>.
        </p>
      )}

      <section className="panel">
        <header>
          <div>
            <h2>Los próximos doce meses</h2>
            <p className="nota">
              Cada mes con lo que entra, lo que sale y lo que pasa: primas, pagos que no son
              mensuales, deudas que terminan y metas que se cumplen.
            </p>
          </div>
        </header>
        <Calendario meses={meses} />
      </section>

      <Provisiones lista={listaProvisiones} />
      <PlanPrima />
      <Escenarios />
    </>
  );
}
