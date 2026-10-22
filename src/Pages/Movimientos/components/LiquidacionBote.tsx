import { useMemo, useState } from "react";
import { Estado } from "@/components/ui/Etiqueta";
import { useHogar } from "@/contexts/HogarContext";
import { useFinanzas } from "@/hooks/useFinanzas";
import { useMoneda } from "@/hooks/useMoneda";
import { liquidarMes } from "@/lib/liquidacion";
import { fechaCorta, hoyISO, nombrePeriodo, porcentajeEntero } from "@/lib/formato";
import type { Movimiento } from "@/models/dominio";
import css from "../Movimientos.module.css";

/** Último día del mes (YYYY-MM), para fechar la liquidación de un mes pasado. */
function finDeMes(mes: string): string {
  const [a, m] = mes.split("-").map(Number);
  const d = new Date(a, m, 0);
  return `${mes}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * Cuentas claras del bote común: con lo que cada uno pagó de los gastos
 * compartidos y la parte que le tocaba según el reparto, dice quién le debe
 * a quién y deja registrar la transferencia que lo salda.
 */
export function LiquidacionBote({ mes, delMes }: { mes: string; delMes: Movimiento[] }) {
  const { hogar, idA, idB, nombreDe, crear, deudas } = useHogar();
  const f = useFinanzas();
  const { $ } = useMoneda();
  const [guardando, setGuardando] = useState(false);

  const reparto = hogar?.reparto ?? "proporcional";
  const l = useMemo(
    () => liquidarMes(delMes, idA, idB, reparto, f.participacionA),
    [delMes, idA, idB, reparto, f.participacionA],
  );

  const transferencias = delMes.filter((m) => m.clase === "transferencia");
  const prestamos = deudas.filter((d) => d.con_pareja && Number(d.saldo) > 0 && d.usuario_id);

  const nombreA = nombreDe(idA);
  const nombreB = nombreDe(idB);
  const deudor = l.neto > 0 ? idB : idA;
  const acreedor = l.neto > 0 ? idA : idB;
  const monto = Math.abs(l.neto);
  const saldado = monto < 1;

  if (!idB) return null;
  if (l.totalCompartido === 0 && transferencias.length === 0 && prestamos.length === 0) {
    return (
      <section className="panel">
        <header>
          <div>
            <h2>Cuentas claras del bote</h2>
            <p className="nota">Quién le debe a quién por los gastos compartidos del mes.</p>
          </div>
        </header>
        <p className="vacio">
          En {nombrePeriodo(`${mes}-01`)} no hay gastos marcados como bote común. Cuando los
          haya, aquí verán quién pagó de más y cuánto hay que pasarse para quedar a paz y salvo.
        </p>
      </section>
    );
  }

  const saldar = async () => {
    if (saldado || !deudor) return;
    setGuardando(true);
    try {
      await crear("movimientos", {
        fecha: mes === hoyISO().slice(0, 7) ? hoyISO() : finDeMes(mes),
        concepto: `Liquidación del bote · ${nombrePeriodo(`${mes}-01`)}`,
        categoria: "Otros",
        monto,
        clase: "transferencia",
        pagado_por: deudor,
        compartido: false,
        extraordinario: false,
        origen: "manual",
      });
    } finally {
      setGuardando(false);
    }
  };

  const fraccionA = l.totalCompartido > 0 ? l.pagadoA / l.totalCompartido : 0;

  return (
    <section className="panel">
      <header>
        <div>
          <h2>Cuentas claras del bote</h2>
          <p className="nota">
            Los gastos del bote común de {nombrePeriodo(`${mes}-01`)}, repartidos{" "}
            {reparto === "mitad" ? "mitad y mitad" : "en proporción al ingreso"}: a {nombreA} le
            toca el {porcentajeEntero(l.parteA)} y a {nombreB} el{" "}
            {porcentajeEntero(1 - l.parteA)}.
          </p>
        </div>
      </header>

      <div className={css.liqVeredicto}>
        {saldado ? (
          <>
            <Estado tono="ok">A paz y salvo</Estado>
            <span className={css.liqFrase}>Nadie le debe nada a nadie por el bote este mes.</span>
          </>
        ) : (
          <>
            <span className={css.liqFrase}>
              <b>{nombreDe(deudor)}</b> le debe a <b>{nombreDe(acreedor)}</b>
            </span>
            <span className={`num ${css.liqMonto}`}>{$(monto)}</span>
          </>
        )}
      </div>

      {l.totalCompartido > 0 && (
        <>
          {/* Quién puso qué: la barra es lo pagado; la marca blanca es dónde
              debería estar el corte según el reparto. */}
          <div className={css.liqBarra} aria-hidden="true">
            <div className="barra" style={{ height: 14 }}>
              <div
                className="fill"
                style={{ width: `${fraccionA * 100}%`, background: "var(--a)" }}
              />
              <div className="marca" style={{ left: `${l.parteA * 100}%` }} />
            </div>
          </div>
          <div className={css.liqPersonas}>
            {[
              { nombre: nombreA, pagado: l.pagadoA, toca: l.tocaA, color: "var(--a)" },
              { nombre: nombreB, pagado: l.pagadoB, toca: l.tocaB, color: "var(--b)" },
            ].map((p) => (
              <div key={p.nombre} className={css.liqPersona}>
                <span className={css.liqNombre}>
                  <span className={css.puntoCat} style={{ background: p.color }} />
                  {p.nombre}
                </span>
                <span className={css.liqCifras}>
                  Pagó <b className="num">{$(p.pagado)}</b> · le tocaba{" "}
                  <b className="num">{$(p.toca)}</b>
                </span>
              </div>
            ))}
          </div>
        </>
      )}

      {transferencias.length > 0 && (
        <ul className={css.liqTransferencias}>
          {transferencias.map((t) => (
            <li key={t.id}>
              {fechaCorta(t.fecha)}: {nombreDe(t.pagado_por)} le pasó{" "}
              <b className="num">{$(Number(t.monto))}</b> a{" "}
              {nombreDe(t.pagado_por === idA ? idB : idA)}
            </li>
          ))}
        </ul>
      )}

      {l.sinAtribuir > 0 && (
        <p className={css.avisoMes}>
          {l.sinAtribuir} {l.sinAtribuir === 1 ? "gasto del bote no dice" : "gastos del bote no dicen"}{" "}
          quién lo pagó ({$(l.sinAtribuirMonto)}). Complétenlo en el detalle del mes para que entre
          en la cuenta.
        </p>
      )}

      {!saldado && (
        <div className={css.liqAcciones}>
          <button className="pill primaria" onClick={() => void saldar()} disabled={guardando}>
            {guardando
              ? "Registrando…"
              : `Registrar que ${nombreDe(deudor)} le pasó ${$(monto)}`}
          </button>
          <span className="nota">
            Queda como una transferencia entre ustedes: no cuenta como gasto ni como ingreso.
          </span>
        </div>
      )}

      {prestamos.length > 0 && (
        <div className={css.liqPrestamos}>
          <span className="eyebrow">Préstamos entre ustedes</span>
          {prestamos.map((d) => (
            <p key={d.id}>
              {nombreDe(d.usuario_id)} le debe <b className="num">{$(Number(d.saldo))}</b> a{" "}
              {nombreDe(d.usuario_id === idA ? idB : idA)}
              {d.nombre ? ` · ${d.nombre}` : ""}
              {Number(d.cuota) > 0 ? ` · paga ${$(Number(d.cuota))} al mes` : ""}
            </p>
          ))}
        </div>
      )}
    </section>
  );
}
