import { useMemo } from "react";
import { Estado } from "@/components/ui/Etiqueta";
import { useHogar } from "@/contexts/HogarContext";
import { useAbono } from "@/hooks/useAbono";
import { useMoneda } from "@/hooks/useMoneda";
import { mesSiguiente } from "@/lib/contable";
import { simularDeudas } from "@/lib/deudas";
import { enMeses, hoyISO, nombrePeriodo } from "@/lib/formato";
import css from "../Deudas.module.css";

const MESES_PLAN = 6;

/**
 * Cuánto abonar a capital: la propuesta del oráculo con sus escenarios y,
 * para el abono elegido, a qué deuda va cada peso los próximos meses.
 */
export function CuantoAbonar({ abono, onUsar }: { abono: number; onUsar: (monto: number) => void }) {
  const { deudas, hogar } = useHogar();
  const { $ } = useMoneda();
  const r = useAbono();
  const estrategia = hogar?.estrategia_deuda ?? "avalancha";
  const cuotas = deudas
    .filter((d) => Number(d.saldo) > 0.5)
    .reduce((s, d) => s + Number(d.cuota), 0);

  const plan = useMemo(() => {
    const sim = simularDeudas(deudas, abono, estrategia, true);
    const nombre = new Map(deudas.map((d) => [d.id, d.nombre || "Sin nombre"]));
    let mes = hoyISO().slice(0, 7);
    return sim.abonos.slice(0, MESES_PLAN).map((delMes, i) => {
      if (i > 0) mes = mesSiguiente(mes);
      return {
        mes,
        destinos: delMes.map((a) => ({ nombre: nombre.get(a.id) ?? "", monto: a.monto })),
        total: delMes.reduce((s, a) => s + a.monto, 0),
        saldo: sim.serie[i + 1] ?? 0,
      };
    });
  }, [deudas, abono, estrategia]);

  if (!r) return null;

  return (
    <section className="panel">
      <header>
        <div>
          <h2>¿Cuánto abonar a capital?</h2>
          <p className="nota">
            Por fuera de la cuota de {$(cuotas)} al mes. La plata sale de lo libre del
            presupuesto ({$(r.maximo)} al mes). {r.razon}
          </p>
        </div>
        {r.recomendado > 0 && (
          <Estado tono="ok">El oráculo propone {$(r.recomendado)} al mes</Estado>
        )}
      </header>

      {r.base.estancado ? (
        <p className="vacio">
          Con las cuotas actuales alguna deuda no baja: primero hay que subir esa cuota o
          renegociarla, o cualquier abono se lo comen los intereses.
        </p>
      ) : r.escenarios.length === 0 ? (
        <p className="vacio">
          El presupuesto no deja plata libre al mes, así que hoy no hay de dónde abonar sin
          recortar algo. Si quieren salir antes, en Hábitos está lo que se va en gastos hormiga.
        </p>
      ) : (
        <div className={css.escenarios}>
          {r.escenarios.map((e) => (
            <div
              key={e.nombre}
              className={css.escenario}
              data-recomendado={e.abono === r.recomendado}
            >
              <span className="eyebrow">{e.nombre}</span>
              <b className={css.escenarioMonto}>{$(e.abono)}</b>
              <span>Libres en {enMeses(e.meses)}</span>
              <span className={css.escenarioDetalle}>
                {enMeses(e.mesesGanados)} antes · {$(e.interesAhorrado)} menos de intereses
              </span>
              <span className={css.escenarioDetalle}>
                Cada {$(1000)} abonados ahorran {$(e.rendimiento * 1000)} de intereses
              </span>
              <button
                className={e.abono === abono ? "pill" : "pill ghost"}
                onClick={() => onUsar(e.abono)}
                disabled={e.abono === abono}
              >
                {e.abono === abono ? "Es el abono actual" : "Usar este abono"}
              </button>
            </div>
          ))}
        </div>
      )}

      {r.mitad && (
        <p className={css.pistaOrden}>
          Solo con las cuotas salen en {enMeses(r.base.meses)}. Para salir en la mitad del tiempo
          ({enMeses(r.mitad.meses)}) harían falta unos <b>{$(r.mitad.abono)}</b> al mes.
          {r.mitad.abono > r.maximo && " Es más de lo libre: habría que recortar gastos o metas."}
        </p>
      )}

      {abono > 0 && plan.length > 0 && (
        <>
          <h3 className={css.planTitulo}>Con {$(abono)} al mes, así va la plata a capital</h3>
          <div className="tablaScroll">
            <table className="datos" style={{ minWidth: 460 }}>
              <thead>
                <tr>
                  <th>Mes</th>
                  <th>A qué deuda</th>
                  <th className="r">A capital</th>
                  <th className="r">Deuda al cierre</th>
                </tr>
              </thead>
              <tbody>
                {plan.map((p) => (
                  <tr key={p.mes}>
                    <td style={{ textTransform: "capitalize", whiteSpace: "nowrap" }}>
                      {nombrePeriodo(`${p.mes}-01`)}
                    </td>
                    <td>
                      {p.destinos.length > 1
                        ? p.destinos.map((d) => `${d.nombre} ${$(d.monto)}`).join(" + ")
                        : p.destinos[0]?.nombre || "—"}
                    </td>
                    <td className="r num">{$(p.total)}</td>
                    <td className="r num">{$(p.saldo)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="nota" style={{ marginTop: 10 }}>
            Cuando una deuda termina, su cuota se suma al abono de la siguiente: por eso lo que va
            a capital crece. Al hacer el abono en el banco, pidan que sea{" "}
            <b>a capital con reducción de plazo</b>: si lo aplican a bajar la cuota, el plazo no se
            acorta y el ahorro en intereses es mucho menor.
          </p>
        </>
      )}
    </section>
  );
}
