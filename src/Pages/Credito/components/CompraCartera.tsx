import { useMemo, useState } from "react";
import { CampoMoneda } from "@/components/ui/CampoMoneda";
import { Estado } from "@/components/ui/Etiqueta";
import { useHogar } from "@/contexts/HogarContext";
import { useMoneda } from "@/hooks/useMoneda";
import { compararCompraCartera } from "@/lib/credito";
import { aNumero, enMeses } from "@/lib/formato";
import css from "../Credito.module.css";

/**
 * ¿Conviene que otro banco compre sus deudas? Se eligen cuáles, se escribe
 * la oferta y se compara todo lo que se pagaría de aquí al final. La trampa
 * típica: la cuota baja porque el plazo se alarga, y el total sube.
 */
export function CompraCartera() {
  const { deudas } = useHogar();
  const { $ } = useMoneda();
  const vivas = deudas.filter((d) => Number(d.saldo) > 0.5 && !d.con_pareja);

  const [elegidas, setElegidas] = useState<Set<string>>(
    () => new Set(vivas.filter((d) => Number(d.tasa_ea) > 0).map((d) => d.id)),
  );
  const [ea, setEa] = useState(18);
  const [plazo, setPlazo] = useState(24);
  const [costos, setCostos] = useState(0);
  const [seguro, setSeguro] = useState(0);

  const sel = vivas.filter((d) => elegidas.has(d.id));
  const r = useMemo(
    () => (sel.length ? compararCompraCartera(sel, { ea, plazo, costosIniciales: costos, seguroMensual: seguro }) : null),
    [sel, ea, plazo, costos, seguro],
  );

  if (vivas.length === 0) return null;

  const alternar = (id: string) =>
    setElegidas((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const ahorro = r ? r.hoy.costo - r.nueva.costo : 0;
  const bajaCuota = r ? r.hoy.cuota - r.nueva.cuota : 0;

  return (
    <section className="panel">
      <header>
        <div>
          <h2>¿Les conviene una compra de cartera?</h2>
          <p className="nota">
            Elijan qué deudas pasarían al banco nuevo y escriban su oferta tal como la den: tasa
            E.A., plazo y costos. La comparación cuenta todo lo que pagarían hasta el final.
          </p>
        </div>
      </header>

      <div className={css.cartera}>
        <div className={css.carteraEntrada}>
          <span className="eyebrow">Deudas que se pasarían</span>
          <div className={css.chequeos}>
            {vivas.map((d) => (
              <label key={d.id} className={css.chequeo}>
                <input
                  type="checkbox"
                  checked={elegidas.has(d.id)}
                  onChange={() => alternar(d.id)}
                  style={{ accentColor: "var(--a)" }}
                />
                <span>{d.nombre || "Sin nombre"}</span>
                <span className="num">
                  {$(Number(d.saldo))} · {String(Number(d.tasa_ea)).replace(".", ",")} %
                </span>
              </label>
            ))}
          </div>

          <div className={css.oferta}>
            <label className={css.campoLab}>
              <span className="eyebrow">Tasa ofrecida (% E.A.)</span>
              <input className="campo n" inputMode="decimal" defaultValue="18" onChange={(e) => setEa(aNumero(e.target.value))} />
            </label>
            <label className={css.campoLab}>
              <span className="eyebrow">Plazo (meses)</span>
              <input className="campo n" inputMode="numeric" defaultValue="24" onChange={(e) => setPlazo(Math.max(1, Math.round(aNumero(e.target.value))))} />
            </label>
            <label className={css.campoLab}>
              <span className="eyebrow">Costos al inicio</span>
              <CampoMoneda className="campo" valor={costos} etiqueta="Costos iniciales" onCambio={setCostos} />
            </label>
            <label className={css.campoLab}>
              <span className="eyebrow">Seguro al mes</span>
              <CampoMoneda className="campo" valor={seguro} etiqueta="Seguro mensual" onCambio={setSeguro} />
            </label>
          </div>
        </div>

        {r && (
          <div className={css.carteraResultado}>
            <p className={css.veredicto}>
              {r.hoy.estancado ? (
                <>
                  <Estado tono="warn">Hoy no bajan</Estado> Alguna de esas deudas no baja con su
                  cuota actual, así que casi cualquier oferta seria es mejor. Revisen igual el total.
                </>
              ) : ahorro > 0 ? (
                <>
                  <Estado tono="ok">Conviene</Estado> Pagarían <b>{$(ahorro)}</b> menos en total
                  {bajaCuota > 0 ? <> y la cuota bajaría <b>{$(bajaCuota)}</b> al mes</> : null}.
                </>
              ) : (
                <>
                  <Estado tono="crit">Sale más cara</Estado> La cuota{" "}
                  {bajaCuota > 0 ? <>baja <b>{$(bajaCuota)}</b></> : "no baja"}, pero en total
                  pagarían <b>{$(-ahorro)}</b> más, porque el plazo se alarga a{" "}
                  {enMeses(r.nueva.meses)}. Solo tiene sentido si hoy no alcanzan a pagar.
                </>
              )}
            </p>
            <table className={css.comparacion}>
              <thead>
                <tr>
                  <th />
                  <th>Como están</th>
                  <th>Con la compra</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Cuota al mes (con cargos)</td>
                  <td className="num">{$(r.hoy.cuota)}</td>
                  <td className="num">{$(r.nueva.cuota)}</td>
                </tr>
                <tr>
                  <td>Terminan en</td>
                  <td className="num">{r.hoy.estancado ? "Nunca" : enMeses(r.hoy.meses)}</td>
                  <td className="num">{enMeses(r.nueva.meses)}</td>
                </tr>
                <tr>
                  <td>Intereses y cargos de aquí al final</td>
                  <td className="num">{r.hoy.estancado ? "—" : $(r.hoy.costo)}</td>
                  <td className="num">{$(r.nueva.costo)}</td>
                </tr>
                <tr>
                  <td>Costo efectivo de la oferta</td>
                  <td className="num">—</td>
                  <td className="num">
                    {r.nueva.efectivaEA === null ? "—" : `${r.nueva.efectivaEA.toFixed(2).replace(".", ",")} % E.A.`}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
