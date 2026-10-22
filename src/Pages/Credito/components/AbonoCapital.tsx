import { useMemo, useState } from "react";
import { CampoMoneda } from "@/components/ui/CampoMoneda";
import { Estado } from "@/components/ui/Etiqueta";
import { useHogar } from "@/contexts/HogarContext";
import { useMoneda } from "@/hooks/useMoneda";
import { compararAbono } from "@/lib/credito";
import { enMeses } from "@/lib/formato";
import css from "../Credito.module.css";

/**
 * El mismo abono extraordinario aplicado de las dos maneras que permite la
 * ley: mantener la cuota y terminar antes, o mantener el plazo y pagar menos
 * cada mes. Una ahorra más intereses; la otra libera caja cada mes.
 */
export function AbonoCapital() {
  const { deudas } = useHogar();
  const { $ } = useMoneda();
  const vivas = deudas.filter((d) => Number(d.saldo) > 0.5 && Number(d.cuota) > 0);
  const [id, setId] = useState(vivas[0]?.id ?? "");
  const [abono, setAbono] = useState(1_000_000);

  const deuda = vivas.find((d) => d.id === id) ?? vivas[0];
  const c = useMemo(
    () => (deuda ? compararAbono(deuda, Math.min(abono, Number(deuda.saldo))) : null),
    [deuda, abono],
  );

  if (!deuda || !c) {
    return null;
  }

  const estancado = c.sinAbono.estancado;
  const ahorroPlazo = estancado ? 0 : c.sinAbono.intereses - c.reducePlazo.intereses;
  const ahorroCuota = estancado ? 0 : c.sinAbono.intereses - c.reduceCuota.intereses;
  const liberaCuota = Number(deuda.cuota) - c.nuevaCuota;

  return (
    <section className="panel">
      <header>
        <div>
          <h2>Abonar a capital: ¿menos plazo o menos cuota?</h2>
          <p className="nota">
            En los créditos de consumo pueden abonar o prepagar sin penalidad (Ley 1555 de 2012)
            y elegir a qué se aplica el abono. Esta es la diferencia con sus números.
          </p>
        </div>
      </header>

      <div className={css.abonoEntrada}>
        <label className={css.campoLab}>
          <span className="eyebrow">Deuda</span>
          <select className="campo" value={deuda.id} onChange={(e) => setId(e.target.value)}>
            {vivas.map((d) => (
              <option key={d.id} value={d.id}>
                {d.nombre || "Sin nombre"} · {$(Number(d.saldo))}
              </option>
            ))}
          </select>
        </label>
        <label className={css.campoLab}>
          <span className="eyebrow">Abono extraordinario</span>
          <CampoMoneda className="campo" valor={abono} etiqueta="Monto del abono" onCambio={setAbono} />
        </label>
      </div>

      {estancado ? (
        <p className={css.pie}>
          <Estado tono="crit">La cuota no cubre intereses</Estado> Con esa cuota la deuda no baja;
          cualquier abono ayuda, pero lo urgente es renegociar la cuota.
        </p>
      ) : (
        <>
          <div className={css.dosCaminos}>
            <article className={`bordeViajero ${css.camino}`} data-mejor={ahorroPlazo >= ahorroCuota}>
              <span className="eyebrow">Reducir el plazo</span>
              <span className={css.caminoGrande}>
                {enMeses(Math.max(0, c.sinAbono.meses - c.reducePlazo.meses))} antes
              </span>
              <span className={css.caminoDato}>
                Terminan en {enMeses(c.reducePlazo.meses)} en vez de {enMeses(c.sinAbono.meses)}
              </span>
              <span className={css.caminoDato}>
                La cuota sigue en <b className="num">{$(Number(deuda.cuota))}</b>
              </span>
              <span className={css.caminoAhorro}>
                Ahorran <b className="num">{$(ahorroPlazo)}</b> en intereses
              </span>
            </article>

            <article className={`bordeViajero ${css.camino}`} data-mejor={ahorroCuota > ahorroPlazo}>
              <span className="eyebrow">Reducir la cuota</span>
              <span className={css.caminoGrande}>{$(liberaCuota)} menos al mes</span>
              <span className={css.caminoDato}>
                La cuota baja a <b className="num">{$(c.nuevaCuota)}</b>
              </span>
              <span className={css.caminoDato}>Terminan en el mismo plazo: {enMeses(c.reduceCuota.meses)}</span>
              <span className={css.caminoAhorro}>
                Ahorran <b className="num">{$(ahorroCuota)}</b> en intereses
              </span>
            </article>
          </div>
          <p className={css.pie}>
            Reducir el plazo casi siempre ahorra más intereses (aquí,{" "}
            <b>{$(Math.max(0, ahorroPlazo - ahorroCuota))}</b> más). Reducir la cuota conviene
            cuando el mes está apretado y esa plata liberada evita endeudarse en otra parte. Al
            hacer el abono, díganle al banco por escrito cuál de las dos quieren.
          </p>
        </>
      )}
    </section>
  );
}
