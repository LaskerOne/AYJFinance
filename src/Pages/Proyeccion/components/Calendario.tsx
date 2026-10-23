import { useMoneda } from "@/hooks/useMoneda";
import type { MesProyectado } from "@/lib/proyeccion";
import css from "../Proyeccion.module.css";

const SIGNO = { entra: "+", sale: "−", libera: "↗", aviso: "ⓘ" } as const;

/**
 * Los doce meses que vienen, uno por tarjeta: cuánto sobra o falta y qué
 * pasa ese mes (primas, pagos anuales, deudas que terminan). El mes más
 * apretado se marca para que nadie llegue a él desprevenido.
 */
export function Calendario({ meses }: { meses: MesProyectado[] }) {
  const { $, $corto } = useMoneda();
  const peor = meses.reduce((p, m) => (m.neto < p.neto ? m : p), meses[0]);

  return (
    <div className={css.calendario}>
      {meses.map((m, i) => {
        const sale = m.gastos + m.cuotas + m.aportes;
        const anio = i === 0 || m.periodo.endsWith("-01") ? ` ${m.periodo.slice(0, 4)}` : "";
        return (
          <article
            key={m.periodo}
            className={`bordeViajero ${css.mes}`}
            data-rojo={m.neto < 0}
            style={{ ["--i" as string]: String(i) }}
          >
            <header className={css.mesCabeza}>
              <span className={css.mesNombre}>
                {m.nombre}
                {anio}
              </span>
              {m === peor && m.neto < 0 && <span className={css.apretado}>El más apretado</span>}
            </header>
            <span className={`num ${css.mesNeto}`} data-rojo={m.neto < 0}>
              {m.neto < 0 ? "−" : "+"}
              {$(Math.abs(m.neto)).replace("−", "")}
            </span>
            <span className={css.mesFlujo}>
              entra {$corto(m.ingresos)} · sale {$corto(sale)}
            </span>
            {m.eventos.length > 0 && (
              <ul className={css.eventos}>
                {m.eventos.slice(0, 3).map((e, k) => (
                  <li key={k} data-tipo={e.tipo}>
                    <span aria-hidden="true">{SIGNO[e.tipo]}</span>
                    <span className={css.eventoTexto}>{e.texto}</span>
                    <span className="num">{$corto(e.monto)}</span>
                  </li>
                ))}
                {m.eventos.length > 3 && <li data-tipo="aviso">y {m.eventos.length - 3} más</li>}
              </ul>
            )}
          </article>
        );
      })}
    </div>
  );
}
