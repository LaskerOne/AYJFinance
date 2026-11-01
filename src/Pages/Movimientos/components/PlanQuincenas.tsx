import { useMemo } from "react";
import { Estado } from "@/components/ui/Etiqueta";
import { Cifra } from "@/components/ui/Cifra";
import { useHogar } from "@/contexts/HogarContext";
import { useFinanzas } from "@/hooks/useFinanzas";
import { useMoneda } from "@/hooks/useMoneda";
import { planQuincenas, type Quincena } from "@/lib/quincenas";
import { hoyISO } from "@/lib/formato";
import css from "../Movimientos.module.css";

/**
 * "¿Nos alcanza esta quincena?": el pago de fin de mes paga la primera, el
 * de mitad de mes la segunda. Cada tarjeta muestra qué entra, qué pagos
 * caen por su día, cuánto día a día cabe y cuánto queda libre. Solo aparece
 * cuando el hogar activó el corte de ingresos: es su forma de cobrar.
 */
export function PlanQuincenas({ mes }: { mes: string }) {
  const { hogar, gastos, deudas, movimientos, pendientes_mes } = useHogar();
  const f = useFinanzas();
  const { $ } = useMoneda();
  const corte = hogar?.corte_ingresos ?? null;

  const plan = useMemo(
    () =>
      corte === null
        ? null
        : planQuincenas({
            gastos,
            deudas,
            movimientos,
            pendientes: pendientes_mes,
            ingresoPresupuesto: f.ingreso,
            corte,
            periodo: mes,
            hoy: hoyISO(),
          }),
    [corte, gastos, deudas, movimientos, pendientes_mes, f.ingreso, mes],
  );

  if (!plan) return null;

  const tarjeta = (q: Quincena) => (
    <article key={q.numero} className={`bordeViajero ${css.quincena}`} data-actual={q.actual}>
      <header className={css.quincenaCabeza}>
        <h3 className={css.quincenaTitulo}>
          {q.numero === 1 ? `Del 1 al 14` : `Del 15 al ${q.hasta.slice(8)}`}
        </h3>
        {q.actual && <Estado tono="ok">En curso</Estado>}
      </header>

      <p className={css.quincenaEntra}>
        {q.numero === 1 ? "La paga el ingreso de fin de mes" : "La paga el ingreso del 15"}
        <b className="num">
          {q.estimado ? "≈ " : ""}
          {$(q.ingreso)}
        </b>
        {q.estimado && <small>aún no llega: es la mitad del ingreso presupuestado</small>}
      </p>

      {q.pagos.length > 0 && (
        <ul className={css.quincenaPagos}>
          {q.pagos.map((p, i) => (
            <li key={p.nombre + i} data-registrado={p.registrado}>
              <span className={css.quincenaPagoNombre}>
                {p.registrado ? "✓ " : ""}
                {p.nombre}
              </span>
              <span className={css.quincenaPagoDia}>{p.dia ? `día ${p.dia}` : "sin día"}</span>
              <b className="num">{$(p.monto)}</b>
            </li>
          ))}
          <li className={css.quincenaDiaADia}>
            <span className={css.quincenaPagoNombre}>Día a día (mercado, antojos…)</span>
            <span className={css.quincenaPagoDia}>estimado</span>
            <b className="num">≈ {$(q.diaADia)}</b>
          </li>
        </ul>
      )}

      <p className={css.quincenaLibre} data-negativo={q.libre < 0}>
        {q.libre >= 0 ? "Queda libre" : "Faltarían"}{" "}
        <span className="num">
          <Cifra valor={Math.abs(q.libre)} formato={$} />
        </span>
      </p>

      {q.actual && q.gastado > 0 && (
        <p className={css.quincenaGastado}>
          Llevan <b className="num">{$(q.gastado)}</b> gastados en esta quincena.
        </p>
      )}
      {q.libre < 0 && (
        <p className={css.quincenaAviso}>
          No cuadra sola: muevan un pago de fecha con su «día de pago» en Presupuesto, o aparten
          esa plata del otro ingreso.
        </p>
      )}
    </article>
  );

  return (
    <section className="panel">
      <header>
        <div>
          <h2>¿Nos alcanza esta quincena?</h2>
          <p className="nota">
            Cada ingreso paga una quincena: el de fin de mes, la primera; el del 15, la segunda.
            Los pagos caen por su día de pago.
          </p>
        </div>
      </header>
      <div className={css.quincenas}>{plan.map(tarjeta)}</div>
    </section>
  );
}
