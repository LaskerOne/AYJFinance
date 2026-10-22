import { CampoMoneda } from "@/components/ui/CampoMoneda";
import { Estado } from "@/components/ui/Etiqueta";
import { useHogar } from "@/contexts/HogarContext";
import { useMoneda } from "@/hooks/useMoneda";
import { aNumero, enMeses, nombrePeriodo } from "@/lib/formato";
import type { CostoDeuda } from "@/lib/credito";
import css from "../Credito.module.css";

const FUENTE_USURA = "https://www.superfinanciera.gov.co/preguntas-frecuentes/12/12-tasas-de-interes/";

const pct = (n: number) => `${n.toFixed(2).replace(".", ",")} %`;

/**
 * La tasa que dice el banco y la que de verdad cuesta cada deuda cuando se
 * suman seguro y cuota de manejo, contra la tasa de usura vigente.
 */
export function CostoReal({ costos }: { costos: CostoDeuda[] }) {
  const { hogar, cambiarHogar, editar } = useHogar();
  const { $ } = useMoneda();

  const usura = hogar?.tasa_usura ? Number(hogar.tasa_usura) : null;
  const mesUsura = hogar?.tasa_usura_mes ?? null;
  const ahora = new Date();
  const mesHoy = `${ahora.getFullYear()}-${String(ahora.getMonth() + 1).padStart(2, "0")}`;
  const vieja = usura !== null && mesUsura !== mesHoy;

  return (
    <section className="panel">
      <header>
        <div>
          <h2>La tasa que de verdad pagan</h2>
          <p className="nota">
            La tasa pactada no cuenta el seguro ni la cuota de manejo. Agréguenlos aquí y la
            columna «costo efectivo» dice lo que cada deuda cuesta de verdad, todo incluido.
          </p>
        </div>
      </header>

      <div className={css.usura}>
        <label className={css.usuraCampo}>
          <span className="eyebrow">Tasa de usura vigente (% E.A.)</span>
          <input
            className="campo n"
            inputMode="decimal"
            placeholder="Ej. 25,8"
            defaultValue={usura === null ? "" : String(usura).replace(".", ",")}
            key={usura ?? "vacia"}
            onBlur={(e) => {
              const v = aNumero(e.target.value);
              if (v > 0 && v !== usura) void cambiarHogar({ tasa_usura: v, tasa_usura_mes: mesHoy });
            }}
          />
        </label>
        <p className={css.usuraNota}>
          Es el máximo legal que se puede cobrar en un crédito de consumo. La certifica la
          Superintendencia Financiera cada mes:{" "}
          <a href={FUENTE_USURA} target="_blank" rel="noreferrer">
            consúltenla aquí
          </a>
          .{" "}
          {usura === null ? (
            <Estado tono="warn">Sin dato</Estado>
          ) : vieja ? (
            <Estado tono="warn">
              Es de {mesUsura ? nombrePeriodo(`${mesUsura}-01`) : "otro mes"}: actualícenla
            </Estado>
          ) : (
            <Estado tono="ok">Al día</Estado>
          )}
        </p>
      </div>

      {costos.length === 0 ? (
        <p className="vacio">Sin deudas con saldo pendiente.</p>
      ) : (
        <div className="tablaScroll">
          <table className="datos" style={{ minWidth: 860 }}>
            <thead>
              <tr>
                <th>Deuda</th>
                <th className="r">Tasa pactada</th>
                <th className="r">Seguro / mes</th>
                <th className="r">Manejo / mes</th>
                <th className="r">Costo efectivo</th>
                <th>Frente a la usura</th>
                <th className="r">Le falta pagar en intereses y cargos</th>
              </tr>
            </thead>
            <tbody>
              {costos.map((c) => {
                const d = c.deuda;
                const supera = usura !== null && c.pactadaEA > usura;
                const roza = usura !== null && !supera && c.pactadaEA > usura * 0.9;
                return (
                  <tr key={d.id}>
                    <td style={{ padding: "9px 8px", fontWeight: 600 }}>{d.nombre || "Sin nombre"}</td>
                    <td className="r num">{pct(c.pactadaEA)}</td>
                    <td className="r">
                      <CampoMoneda
                        valor={Number(d.seguro_mensual ?? 0)}
                        etiqueta={`Seguro mensual de ${d.nombre}`}
                        onCambio={(v) => void editar("deudas", d.id, { seguro_mensual: v })}
                      />
                    </td>
                    <td className="r">
                      <CampoMoneda
                        valor={Number(d.cuota_manejo ?? 0)}
                        etiqueta={`Cuota de manejo de ${d.nombre}`}
                        onCambio={(v) => void editar("deudas", d.id, { cuota_manejo: v })}
                      />
                    </td>
                    <td className="r num" style={{ fontWeight: 700, color: c.efectivaEA !== null && c.efectivaEA > c.pactadaEA + 0.5 ? "var(--crit-ink)" : "var(--ink)" }}>
                      {c.efectivaEA === null ? "—" : pct(c.efectivaEA)}
                    </td>
                    <td>
                      {usura === null ? (
                        <span style={{ color: "var(--ink-3)", fontSize: 12.5 }}>Falta la usura</span>
                      ) : supera ? (
                        <Estado tono="crit">La supera</Estado>
                      ) : roza ? (
                        <Estado tono="warn">Muy cerca</Estado>
                      ) : (
                        <Estado tono="ok">Por debajo</Estado>
                      )}
                    </td>
                    <td className="r num">
                      {c.restante.estancado ? (
                        <Estado tono="crit">La cuota no cubre intereses</Estado>
                      ) : (
                        <>
                          {$(c.restante.intereses + c.restante.cargos)}
                          <span className={css.enMeses}> · {enMeses(c.restante.meses)}</span>
                        </>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <p className={css.pie}>
        Si la cuota que registraron ya incluye el seguro, déjenlo en cero para no contarlo dos
        veces. Una tasa pactada por encima de la usura es ilegal: pidan la revisión al banco o
        acudan a la Superintendencia Financiera.
      </p>
    </section>
  );
}
