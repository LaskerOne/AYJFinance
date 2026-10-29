import { useState } from "react";
import { Link } from "react-router-dom";
import { Estado } from "@/components/ui/Etiqueta";
import { CampoMoneda } from "@/components/ui/CampoMoneda";
import { SelectorPersona } from "@/components/ui/SelectorPersona";
import { useHogar } from "@/contexts/HogarContext";
import { useMoneda } from "@/hooks/useMoneda";
import { useCategorias } from "@/hooks/useCategorias";
import { useFijosDelMes } from "@/hooks/useFijosDelMes";
import type { FijoDelMes } from "@/lib/fijos";
import { fechaCorta, nombrePeriodo } from "@/lib/formato";
import { mensajeDeError } from "@/services/supabase";
import css from "../Movimientos.module.css";

/** Lo que el usuario cambió en una fila antes de registrarla. Lo que no
 *  tocó sale de la propuesta del presupuesto. */
interface Ajuste {
  marcado?: boolean;
  monto?: number;
  fecha?: string;
  pagadoPor?: string | null;
}

/**
 * Los gastos fijos del presupuesto que tocan este mes, listos para pasar a
 * movimientos con un clic. Propone monto, fecha y quién paga; se ajusta lo
 * que haya cambiado (la luz no llega igual todos los meses) y se registra.
 */
export function FijosDelMes({ mes }: { mes: string }) {
  const { idA, crearVarias, editar, ladoDe } = useHogar();
  const { $ } = useMoneda();
  const { etiqueta } = useCategorias();
  const { fijos, sinMes } = useFijosDelMes(mes);
  const [ajustes, setAjustes] = useState<Record<string, Ajuste>>({});
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");

  const pendientes = fijos.filter((f) => !f.registrado);
  const registrados = fijos.length - pendientes.length;

  // La propuesta de cada fila, con los ajustes encima. Lo que parece ya
  // digitado a mano arranca sin marcar: es más fácil marcarlo que borrar un
  // duplicado.
  const fila = (f: FijoDelMes) => {
    const a = ajustes[f.gasto.id] ?? {};
    return {
      marcado: a.marcado ?? !f.parecido,
      monto: a.monto ?? f.monto,
      fecha: a.fecha ?? f.fecha,
      pagadoPor: a.pagadoPor !== undefined ? a.pagadoPor : (f.gasto.usuario_id ?? idA),
    };
  };
  const ajustar = (id: string, cambio: Ajuste) =>
    setAjustes((p) => ({ ...p, [id]: { ...p[id], ...cambio } }));

  const marcados = pendientes.filter((f) => fila(f).marcado);
  const totalMarcado = marcados.reduce((s, f) => s + fila(f).monto, 0);
  const faltante = pendientes.reduce((s, f) => s + f.monto, 0);

  const [a, m] = mes.split("-").map(Number);
  const ultimoDia = `${mes}-${String(new Date(a, m, 0).getDate()).padStart(2, "0")}`;

  const registrar = async () => {
    if (marcados.length === 0) return;
    setGuardando(true);
    setError("");
    try {
      await crearVarias(
        "movimientos",
        marcados.map((f) => {
          const v = fila(f);
          return {
            fecha: v.fecha,
            concepto: f.gasto.concepto || etiqueta(f.gasto.categoria),
            categoria: f.gasto.categoria,
            monto: v.monto,
            clase: "gasto",
            pagado_por: v.pagadoPor,
            // Un fijo de los dos va al bote; uno personal, no.
            compartido: f.gasto.usuario_id === null,
            extraordinario: false,
            origen: "manual",
            gasto_id: f.gasto.id,
          };
        }),
      );
      setAjustes({});
    } catch (e) {
      setError(mensajeDeError(e));
    } finally {
      setGuardando(false);
    }
  };

  if (fijos.length === 0 && sinMes === 0) return null;

  return (
    <section className="panel">
      <header>
        <div>
          <h2>Pagos fijos de {nombrePeriodo(`${mes}-01`)}</h2>
          <p className="nota">
            Salen de los gastos fijos del presupuesto. Ajusten el monto si cambió y regístrenlos
            de una vez.
          </p>
        </div>
        {fijos.length > 0 &&
          (pendientes.length === 0 ? (
            <Estado tono="ok">Los {fijos.length} registrados</Estado>
          ) : (
            <Estado tono="warn">
              {registrados} de {fijos.length} · faltan {$(faltante)}
            </Estado>
          ))}
      </header>

      {fijos.length > 0 && (
        <ul className={css.fijos}>
          {fijos.map((f) => {
            const v = fila(f);
            const g = f.gasto;
            const parecido = f.parecido;
            if (f.registrado) {
              return (
                <li key={g.id} className={css.fijo} data-registrado="true">
                  <span className={css.fijoMarca} aria-hidden="true">
                    ✓
                  </span>
                  <span className={css.fijoConcepto}>
                    {g.concepto || etiqueta(g.categoria)}
                    <small>{etiqueta(g.categoria)}</small>
                  </span>
                  <span className={css.fijoHecho}>
                    Registrado el {fechaCorta(f.registrado.fecha)} por{" "}
                    <b className="num">{$(Number(f.registrado.monto))}</b>
                  </span>
                </li>
              );
            }
            return (
              <li key={g.id} className={`firma ${css.fijo}`} data-lado={ladoDe(g.usuario_id)}>
                <input
                  type="checkbox"
                  className={css.fijoMarca}
                  checked={v.marcado}
                  onChange={(e) => ajustar(g.id, { marcado: e.target.checked })}
                  aria-label={`Registrar ${g.concepto}`}
                />
                <span className={css.fijoConcepto}>
                  {g.concepto || etiqueta(g.categoria)}
                  <small>
                    {etiqueta(g.categoria)}
                    {g.frecuencia === "quincenal" && " · dos quincenas"}
                    {g.frecuencia !== "mensual" && g.frecuencia !== "quincenal" && ` · ${g.frecuencia}`}
                  </small>
                </span>
                <input
                  type="date"
                  className={`campo ${css.fijoFecha}`}
                  aria-label={`Fecha de ${g.concepto}`}
                  value={v.fecha}
                  min={`${mes}-01`}
                  max={ultimoDia}
                  onChange={(e) => ajustar(g.id, { fecha: e.target.value })}
                />
                <SelectorPersona
                  className={`campo ${css.fijoQuien}`}
                  valor={v.pagadoPor}
                  etiqueta={`Quién pagó ${g.concepto}`}
                  textoComun="Sin especificar"
                  onCambio={(p) => ajustar(g.id, { pagadoPor: p })}
                />
                <CampoMoneda
                  className={`campo ${css.fijoMonto}`}
                  valor={v.monto}
                  etiqueta={`Monto de ${g.concepto}`}
                  onCambio={(monto) => ajustar(g.id, { monto })}
                />
                {parecido && (
                  <p className={css.fijoParecido}>
                    ¿Ya lo anotaron? «{parecido.concepto}» por{" "}
                    <b className="num">{$(Number(parecido.monto))}</b> el{" "}
                    {fechaCorta(parecido.fecha)}.{" "}
                    <button
                      type="button"
                      className="pill ghost"
                      onClick={() => void editar("movimientos", parecido.id, { gasto_id: g.id })}
                    >
                      Sí, es ese
                    </button>
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {pendientes.length > 0 && (
        <div className={css.fijosPie}>
          <button
            className="pill primaria"
            onClick={() => void registrar()}
            disabled={guardando || marcados.length === 0}
          >
            {guardando
              ? "Registrando…"
              : `Registrar ${marcados.length} ${marcados.length === 1 ? "pago" : "pagos"} · ${$(totalMarcado)}`}
          </button>
          {error && <span className={css.fijosError}>{error}</span>}
        </div>
      )}

      {sinMes > 0 && (
        <p className="nota" style={{ marginTop: 12 }}>
          {sinMes === 1 ? "Un fijo periódico no tiene" : `${sinMes} fijos periódicos no tienen`} mes
          de pago, así que no se sabe cuándo toca.{" "}
          <Link to="/presupuesto">Definirlo en Presupuesto</Link>.
        </p>
      )}
    </section>
  );
}
