import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { Estado } from "@/components/ui/Etiqueta";
import { CampoMoneda } from "@/components/ui/CampoMoneda";
import { SelectorPersona } from "@/components/ui/SelectorPersona";
import { useHogar } from "@/contexts/HogarContext";
import { useMoneda } from "@/hooks/useMoneda";
import { useCategorias } from "@/hooks/useCategorias";
import { useFijosDelMes } from "@/hooks/useFijosDelMes";
import type { FijoDelMes } from "@/lib/fijos";
import { aNumero, fechaCorta, hoyISO, nombrePeriodo } from "@/lib/formato";
import { mensajeDeError } from "@/services/supabase";
import type { Movimiento, PendienteMes } from "@/models/dominio";
import css from "../Movimientos.module.css";

/** Lo que el usuario cambió en una fila antes de registrarla. Lo que no
 *  tocó sale de la propuesta (del presupuesto o del pendiente). */
interface Ajuste {
  marcado?: boolean;
  monto?: number;
  fecha?: string;
  pagadoPor?: string | null;
}

/**
 * Los pagos del mes en una sola lista de chequeo, desde el día 1:
 * los gastos fijos del presupuesto que tocan este mes, más los pagos extra
 * que resultaron solo este mes (la matrícula, el arreglo). Propone monto,
 * fecha y quién paga; se ajusta lo que cambió y se registra con un clic.
 */
export function FijosDelMes({ mes }: { mes: string }) {
  const { idA, crear, crearVarias, editar, borrar, ladoDe, pendientes_mes, movimientos } = useHogar();
  const { $ } = useMoneda();
  const { etiqueta, opciones: opcionesCategoria } = useCategorias();
  const { fijos, sinMes } = useFijosDelMes(mes);
  const [ajustes, setAjustes] = useState<Record<string, Ajuste>>({});
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");

  // Los pagos extra de este mes, con el movimiento que los pagó si ya está.
  const extras = pendientes_mes
    .filter((p) => p.periodo.startsWith(mes))
    .map((p) => ({ p, registrado: movimientos.find((m) => m.pendiente_id === p.id) ?? null }));

  const [nuevo, setNuevo] = useState(() => ({
    concepto: "",
    categoria: "Otros" as string,
    monto: 0,
    usuario_id: null as string | null,
    extraordinario: false,
  }));
  const [agregando, setAgregando] = useState(false);

  const fechaPropuesta = hoyISO().startsWith(mes) ? hoyISO() : `${mes}-01`;

  // La propuesta de cada fila, con los ajustes encima. Lo que parece ya
  // digitado a mano arranca sin marcar: es más fácil marcarlo que borrar un
  // duplicado.
  const filaFijo = (f: FijoDelMes) => {
    const a = ajustes[f.gasto.id] ?? {};
    return {
      marcado: a.marcado ?? !f.parecido,
      monto: a.monto ?? f.monto,
      fecha: a.fecha ?? f.fecha,
      pagadoPor: a.pagadoPor !== undefined ? a.pagadoPor : (f.gasto.usuario_id ?? idA),
    };
  };
  const filaExtra = (p: PendienteMes) => {
    const a = ajustes[p.id] ?? {};
    return {
      marcado: a.marcado ?? true,
      monto: a.monto ?? Number(p.monto),
      fecha: a.fecha ?? fechaPropuesta,
      pagadoPor: a.pagadoPor !== undefined ? a.pagadoPor : (p.usuario_id ?? idA),
    };
  };
  const ajustar = (id: string, cambio: Ajuste) =>
    setAjustes((prev) => ({ ...prev, [id]: { ...prev[id], ...cambio } }));

  const fijosPendientes = fijos.filter((f) => !f.registrado);
  const extrasPendientes = extras.filter((e) => !e.registrado);
  const totalLista = fijos.length + extras.length;
  const registrados = totalLista - fijosPendientes.length - extrasPendientes.length;

  const marcadosFijos = fijosPendientes.filter((f) => filaFijo(f).marcado);
  const marcadosExtras = extrasPendientes.filter((e) => filaExtra(e.p).marcado);
  const cuantosMarcados = marcadosFijos.length + marcadosExtras.length;
  const totalMarcado =
    marcadosFijos.reduce((s, f) => s + filaFijo(f).monto, 0) +
    marcadosExtras.reduce((s, e) => s + filaExtra(e.p).monto, 0);
  const faltante =
    fijosPendientes.reduce((s, f) => s + f.monto, 0) +
    extrasPendientes.reduce((s, e) => s + Number(e.p.monto), 0);

  const [a, m] = mes.split("-").map(Number);
  const ultimoDia = `${mes}-${String(new Date(a, m, 0).getDate()).padStart(2, "0")}`;

  const registrar = async () => {
    if (cuantosMarcados === 0) return;
    setGuardando(true);
    setError("");
    try {
      await crearVarias("movimientos", [
        ...marcadosFijos.map((f) => {
          const v = filaFijo(f);
          return {
            fecha: v.fecha,
            concepto: f.gasto.concepto || etiqueta(f.gasto.categoria),
            categoria: f.gasto.categoria,
            monto: v.monto,
            clase: "gasto",
            pagado_por: v.pagadoPor,
            // Un pago de los dos va al bote; uno personal, no.
            compartido: f.gasto.usuario_id === null,
            extraordinario: false,
            origen: "manual",
            gasto_id: f.gasto.id,
          };
        }),
        ...marcadosExtras.map(({ p }) => {
          const v = filaExtra(p);
          return {
            fecha: v.fecha,
            concepto: p.concepto || etiqueta(p.categoria),
            categoria: p.categoria,
            monto: v.monto,
            clase: "gasto",
            pagado_por: v.pagadoPor,
            compartido: p.usuario_id === null,
            // Solo va aparte de la comparación con el presupuesto si lo
            // marcaron como extra al agregarlo; si no, es gasto corriente.
            extraordinario: p.extraordinario === true,
            origen: "manual",
            pendiente_id: p.id,
          };
        }),
      ]);
      setAjustes({});
    } catch (e) {
      setError(mensajeDeError(e));
    } finally {
      setGuardando(false);
    }
  };

  const agregarExtra = async (e: FormEvent) => {
    e.preventDefault();
    if (nuevo.monto <= 0 || !nuevo.concepto.trim()) return;
    setError("");
    try {
      await crear("pendientes_mes", {
        periodo: `${mes}-01`,
        concepto: nuevo.concepto.trim(),
        categoria: nuevo.categoria,
        monto: nuevo.monto,
        usuario_id: nuevo.usuario_id,
        extraordinario: nuevo.extraordinario,
      });
      setNuevo({ concepto: "", categoria: "Otros", monto: 0, usuario_id: null, extraordinario: false });
      setAgregando(false);
    } catch (err) {
      setError(mensajeDeError(err));
    }
  };

  const filaRegistrada = (
    clave: string,
    concepto: string,
    detalle: string,
    mov: Movimiento,
  ) => (
    <li key={clave} className={css.fijo} data-registrado="true">
      <span className={css.fijoMarca} aria-hidden="true">
        ✓
      </span>
      <span className={css.fijoConcepto}>
        {concepto}
        <small>{detalle}</small>
      </span>
      <span className={css.fijoHecho}>
        Registrado el {fechaCorta(mov.fecha)} por <b className="num">{$(Number(mov.monto))}</b>
      </span>
    </li>
  );

  return (
    <section className="panel">
      <header>
        <div>
          <h2>Pagos de {nombrePeriodo(`${mes}-01`)}</h2>
          <p className="nota">
            La lista de chequeo del mes: los fijos del presupuesto más lo que resultó solo este
            mes. Ajusten el monto si cambió y regístrenlos de una vez.
          </p>
        </div>
        {totalLista > 0 &&
          (fijosPendientes.length + extrasPendientes.length === 0 ? (
            <Estado tono="ok">Los {totalLista} registrados</Estado>
          ) : (
            <Estado tono="warn">
              {registrados} de {totalLista} · faltan {$(faltante)}
            </Estado>
          ))}
      </header>

      {totalLista > 0 && (
        <ul className={css.fijos}>
          {fijos.map((f) => {
            const v = filaFijo(f);
            const g = f.gasto;
            const parecido = f.parecido;
            if (f.registrado) {
              return filaRegistrada(g.id, g.concepto || etiqueta(g.categoria), etiqueta(g.categoria), f.registrado);
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
                    {" · "}
                    <button
                      type="button"
                      className={css.quitarPendiente}
                      title="Lo borra del presupuesto: deja de aparecer todos los meses"
                      onClick={() => void borrar("gastos_presupuesto", g.id)}
                    >
                      quitar del presupuesto
                    </button>
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

          {extras.map(({ p, registrado }) => {
            if (registrado) {
              return filaRegistrada(
                p.id,
                p.concepto,
                `${p.extraordinario ? "Extra · " : ""}Solo este mes · ${etiqueta(p.categoria)}`,
                registrado,
              );
            }
            const v = filaExtra(p);
            return (
              <li key={p.id} className={`firma ${css.fijo}`} data-lado={ladoDe(p.usuario_id)}>
                <input
                  type="checkbox"
                  className={css.fijoMarca}
                  checked={v.marcado}
                  onChange={(e) => ajustar(p.id, { marcado: e.target.checked })}
                  aria-label={`Registrar ${p.concepto}`}
                />
                <span className={css.fijoConcepto}>
                  {p.concepto}
                  <small>
                    {p.extraordinario && "Extra · "}Solo este mes · {etiqueta(p.categoria)} ·{" "}
                    <button
                      type="button"
                      className={css.quitarPendiente}
                      onClick={() => void borrar("pendientes_mes", p.id)}
                    >
                      quitar
                    </button>
                  </small>
                </span>
                <input
                  type="date"
                  className={`campo ${css.fijoFecha}`}
                  aria-label={`Fecha de ${p.concepto}`}
                  value={v.fecha}
                  min={`${mes}-01`}
                  max={ultimoDia}
                  onChange={(e) => ajustar(p.id, { fecha: e.target.value })}
                />
                <SelectorPersona
                  className={`campo ${css.fijoQuien}`}
                  valor={v.pagadoPor}
                  etiqueta={`Quién pagó ${p.concepto}`}
                  textoComun="Sin especificar"
                  onCambio={(q) => ajustar(p.id, { pagadoPor: q })}
                />
                <CampoMoneda
                  className={`campo ${css.fijoMonto}`}
                  valor={v.monto}
                  etiqueta={`Monto de ${p.concepto}`}
                  onCambio={(monto) => ajustar(p.id, { monto })}
                />
              </li>
            );
          })}
        </ul>
      )}

      {totalLista === 0 && sinMes === 0 && (
        <p className="nota" style={{ marginTop: 12 }}>
          Este mes no hay pagos en la lista. Los fijos salen de los gastos marcados como fijos en{" "}
          <Link to="/presupuesto">Presupuesto</Link>; lo que resulte solo este mes se agrega aquí
          abajo.
        </p>
      )}

      <div className={css.fijosPie}>
        {fijosPendientes.length + extrasPendientes.length > 0 && (
          <button
            className="pill primaria"
            onClick={() => void registrar()}
            disabled={guardando || cuantosMarcados === 0}
          >
            {guardando
              ? "Registrando…"
              : `Registrar ${cuantosMarcados} ${cuantosMarcados === 1 ? "pago" : "pagos"} · ${$(totalMarcado)}`}
          </button>
        )}
        {!agregando && (
          <button className="pill ghost" onClick={() => setAgregando(true)}>
            + Agregar un pago de este mes
          </button>
        )}
        {error && <span className={css.fijosError}>{error}</span>}
      </div>

      {agregando && (
        <form className={css.extraForm} onSubmit={(e) => void agregarExtra(e)}>
          <input
            className="campo"
            placeholder="Matrícula, arreglo, regalo…"
            aria-label="Concepto del pago"
            value={nuevo.concepto}
            onChange={(e) => setNuevo({ ...nuevo, concepto: e.target.value })}
          />
          <select
            className="campo"
            aria-label="Categoría"
            value={nuevo.categoria}
            onChange={(e) => setNuevo({ ...nuevo, categoria: e.target.value })}
          >
            {opcionesCategoria.map((c) => (
              <option key={c.clave} value={c.clave}>
                {c.nombre}
              </option>
            ))}
          </select>
          <SelectorPersona
            className="campo"
            valor={nuevo.usuario_id}
            etiqueta="Quién lo asume"
            onCambio={(q) => setNuevo({ ...nuevo, usuario_id: q })}
          />
          <input
            className="campo n"
            inputMode="decimal"
            placeholder="Monto"
            aria-label="Monto del pago"
            value={nuevo.monto === 0 ? "" : String(nuevo.monto)}
            onChange={(e) => setNuevo({ ...nuevo, monto: aNumero(e.target.value) })}
          />
          <label className={css.extraCasilla} title="Compra puntual que no se repite: queda aparte de la comparación con el presupuesto">
            <input
              type="checkbox"
              checked={nuevo.extraordinario}
              onChange={(e) => setNuevo({ ...nuevo, extraordinario: e.target.checked })}
            />
            <span>Es extraordinario</span>
          </label>
          <button className="pill" type="submit" disabled={nuevo.monto <= 0 || !nuevo.concepto.trim()}>
            Agregar
          </button>
          <button className="pill ghost" type="button" onClick={() => setAgregando(false)}>
            Cancelar
          </button>
        </form>
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
