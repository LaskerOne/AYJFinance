import { Link } from "react-router-dom";
import { Estado } from "@/components/ui/Etiqueta";
import { useMoneda } from "@/hooks/useMoneda";
import type { Provision } from "@/lib/proyeccion";
import { NOMBRE_FRECUENCIA } from "@/models/dominio";
import css from "../Proyeccion.module.css";

/**
 * Fondos de provisión: la cuota mensual que hay que apartar para cada pago
 * que no es mensual, y cuánto debería haber guardado hoy. El presupuesto ya
 * cuenta ese equivalente mensual; el riesgo es gastárselo porque el pago
 * "todavía no llega".
 */
export function Provisiones({ lista }: { lista: Provision[] }) {
  const { $ } = useMoneda();
  const totalMensual = lista.reduce((s, p) => s + p.mensual, 0);
  const totalHoy = lista.reduce((s, p) => s + (p.deberiaHaber ?? 0), 0);

  return (
    <section className="panel">
      <header>
        <div>
          <h2>Plata que hay que ir apartando</h2>
          <p className="nota">
            Cada pago que no es mensual ya cuenta en el presupuesto como su parte mensual. Para que
            no tome por sorpresa, esa parte se aparta cada mes en un bolsillo aparte.
          </p>
        </div>
        {lista.length > 0 && (
          <span className="eyebrow">Apartar {$(totalMensual)} al mes</span>
        )}
      </header>

      {lista.length === 0 ? (
        <p className="vacio">
          Todos los gastos del presupuesto son mensuales o quincenales: no hay nada que provisionar.
        </p>
      ) : (
        <>
          <div className="tablaScroll">
            <table className="datos" style={{ minWidth: 620 }}>
              <thead>
                <tr>
                  <th>Pago</th>
                  <th>Cada</th>
                  <th>Próximo</th>
                  <th className="r">Monto</th>
                  <th className="r">Apartar al mes</th>
                  <th className="r">Debería haber hoy</th>
                </tr>
              </thead>
              <tbody>
                {lista.map((p) => (
                  <tr key={p.concepto + p.frecuencia}>
                    <td style={{ padding: "9px 8px" }}>{p.concepto}</td>
                    <td style={{ color: "var(--ink-2)", fontSize: 12.5 }}>{NOMBRE_FRECUENCIA[p.frecuencia]}</td>
                    <td style={{ fontSize: 12.5, textTransform: "capitalize" }}>
                      {p.proximo === null ? (
                        <Estado tono="warn">Sin mes</Estado>
                      ) : p.faltan === 0 ? (
                        <Estado tono="crit">Este mes</Estado>
                      ) : (
                        `${p.proximo} · en ${p.faltan} ${p.faltan === 1 ? "mes" : "meses"}`
                      )}
                    </td>
                    <td className="r num">{$(p.monto)}</td>
                    <td className="r num" style={{ color: "var(--a-ink)", fontWeight: 600 }}>
                      {$(p.mensual)}
                    </td>
                    <td className="r num">{p.deberiaHaber === null ? "—" : $(p.deberiaHaber)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={4}>Total</td>
                  <td className="r tot">{$(totalMensual)}</td>
                  <td className="r tot">{$(totalHoy)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
          <p className={css.pie}>
            «Debería haber hoy» es lo que tendría que estar guardado si se hubiera apartado la
            cuota de cada mes desde el último pago. Si hay menos, el próximo pago saldrá del mes
            corriente. {lista.some((p) => p.proximo === null) && (
              <>
                Los que dicen <b>Sin mes</b> necesitan su mes de pago:{" "}
                <Link to="/presupuesto">asígnenlo en Presupuesto</Link>.
              </>
            )}
          </p>
        </>
      )}
    </section>
  );
}
