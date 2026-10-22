import { useMemo, useState, type FormEvent } from "react";
import { Cifra } from "@/components/ui/Cifra";
import { AreaGlow } from "@/components/charts/AreaGlow";
import { Estado, Etiqueta } from "@/components/ui/Etiqueta";
import { CampoMoneda } from "@/components/ui/CampoMoneda";
import { SelectorPersona } from "@/components/ui/SelectorPersona";
import { useHogar } from "@/contexts/HogarContext";
import { useMoneda } from "@/hooks/useMoneda";
import { useCategorias } from "@/hooks/useCategorias";
import { BarraApilada, type Segmento } from "@/components/charts/BarraApilada";
import { gastoMensual } from "@/lib/calculos";
import { EnlaceEditar } from "@/components/ui/EnlaceEditar";
import { aNumero, fechaCorta, hoyISO, nombrePeriodo } from "@/lib/formato";
import {
  CATEGORIAS,
  CATEGORIAS_INGRESO,
  COLOR_CATEGORIA_INGRESO,
  type ClaseMovimiento,
} from "@/models/dominio";
import {
  ComparativaPresupuesto,
  type LineaComparativa,
} from "./components/ComparativaPresupuesto";
import { LiquidacionBote } from "./components/LiquidacionBote";
import css from "./Movimientos.module.css";

function mesDe(iso: string): string {
  return iso.slice(0, 7);
}

function desplazarMes(mes: string, delta: number): string {
  const [a, m] = mes.split("-").map(Number);
  const d = new Date(a, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** Lunes de la semana a la que pertenece la fecha. */
function inicioSemana(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function sumarDias(iso: string, n: number): string {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function Movimientos() {
  const { movimientos, gastos, crear, editar, borrar, ladoDe, idA } = useHogar();
  const { $ } = useMoneda();
  const { opciones: opcionesCategoria, etiqueta: etiquetaCategoria } = useCategorias();

  const [mes, setMes] = useState(() => mesDe(hoyISO()));
  const [nuevo, setNuevo] = useState(() => ({
    fecha: hoyISO(),
    concepto: "",
    categoria: "Mercado" as string,
    monto: 0,
    clase: "gasto" as ClaseMovimiento,
    pagado_por: idA,
    // Sin marcar por defecto: marcar algo como del bote común por descuido
    // desvía el reparto entre los dos sin que nadie lo note.
    compartido: false,
    extraordinario: false,
  }));

  const delMes = useMemo(
    () => movimientos.filter((m) => mesDe(m.fecha) === mes),
    [movimientos, mes],
  );

  // El mes entero de corrido se vuelve denso: se agrupa por semanas y cada
  // una se abre o cierra. Qué está abierto lo decide el usuario; de arranque,
  // solo la semana más reciente.
  const [abiertas, setAbiertas] = useState<Record<string, boolean>>({});
  const semanas = useMemo(() => {
    const mapa = new Map<string, typeof delMes>();
    for (const m of delMes) {
      const clave = inicioSemana(m.fecha);
      const lista = mapa.get(clave);
      if (lista) lista.push(m);
      else mapa.set(clave, [m]);
    }
    return [...mapa.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1));
  }, [delMes]);

  const ingresosMes = delMes
    .filter((m) => m.clase === "ingreso")
    .reduce((s, m) => s + Number(m.monto), 0);
  const gastosMes = delMes
    .filter((m) => m.clase === "gasto")
    .reduce((s, m) => s + Number(m.monto), 0);

  // Lo puntual se aparta: el presupuesto describe lo que se repite, y
  // mezclarlo con una compra grande hace ver mal un mes que estaba bien.
  const extraordinarios = useMemo(
    () => delMes.filter((m) => m.clase === "gasto" && m.extraordinario),
    [delMes],
  );
  const totalExtraordinario = extraordinarios.reduce((s, m) => s + Number(m.monto), 0);
  const gastosCorrientes = gastosMes - totalExtraordinario;

  const comparativa: LineaComparativa[] = useMemo(() => {
    const filas = CATEGORIAS.map((categoria) => ({
      categoria,
      presupuesto: gastos
        .filter((g) => g.categoria === categoria)
        .reduce((s, g) => s + gastoMensual(g), 0),
      ejecutado: delMes
        .filter(
          (m) => m.clase === "gasto" && !m.extraordinario && m.categoria === categoria,
        )
        .reduce((s, m) => s + Number(m.monto), 0),
    }));
    return filas
      .filter((f) => f.presupuesto > 0 || f.ejecutado > 0)
      .sort((a, b) => b.ejecutado - a.ejecutado);
  }, [gastos, delMes]);

  const presupuestoTotal = comparativa.reduce((s, c) => s + c.presupuesto, 0);
  const desviacion = gastosCorrientes - presupuestoTotal;
  const balanceMes = ingresosMes - gastosMes;

  // Gasto corriente acumulado día a día del mes que se está viendo. En el
  // mes corriente llega hasta hoy; en uno cerrado, hasta su último día.
  const acumulado = useMemo(() => {
    const [a, m] = mes.split("-").map(Number);
    const esActual = mes === mesDe(hoyISO());
    const dias = esActual ? Math.max(2, new Date().getDate()) : new Date(a, m, 0).getDate();
    const porDia = Array.from({ length: dias }, () => 0);
    for (const mov of delMes) {
      if (mov.clase !== "gasto" || mov.extraordinario) continue;
      const dia = Number(mov.fecha.slice(8, 10));
      if (dia >= 1 && dia <= dias) porDia[dia - 1] += Number(mov.monto);
    }
    const suma: number[] = [];
    for (const [i, v] of porDia.entries()) suma.push((suma[i - 1] ?? 0) + v);
    return suma;
  }, [delMes, mes]);

  // De dónde vino el dinero que entró este mes.
  const fuentes: Segmento[] = useMemo(
    () =>
      CATEGORIAS_INGRESO.map((fuente) => ({
        nombre: fuente,
        color: COLOR_CATEGORIA_INGRESO[fuente],
        valor: delMes
          .filter((m) => m.clase === "ingreso" && m.categoria === fuente)
          .reduce((s, m) => s + Number(m.monto), 0),
      })).filter((s) => s.valor > 0),
    [delMes],
  );

  const agregar = async (e: FormEvent) => {
    e.preventDefault();
    if (nuevo.monto <= 0) return;
    await crear("movimientos", {
      fecha: nuevo.fecha,
      concepto: nuevo.concepto.trim() || "Sin descripción",
      categoria: nuevo.categoria,
      monto: nuevo.monto,
      clase: nuevo.clase,
      pagado_por: nuevo.pagado_por,
      compartido: nuevo.compartido,
      extraordinario: nuevo.clase === "gasto" && nuevo.extraordinario,
      origen: "manual",
    });
    // También vuelve a cero la casilla del bote: que quede pegada de un
    // movimiento al siguiente es justo como se marcan cosas sin querer.
    setNuevo((n) => ({ ...n, concepto: "", monto: 0, compartido: false, extraordinario: false }));
    setMes(mesDe(nuevo.fecha));
  };

  return (
    <>
      <section className="panel hero heroGrid">
        <div className="heroCifras">
          <div className={css.navegaMes}>
            <button className="pill" onClick={() => setMes(desplazarMes(mes, -1))} aria-label="Mes anterior">
              ←
            </button>
            <span className={css.mesActual}>{nombrePeriodo(`${mes}-01`)}</span>
            <button
              className="pill"
              onClick={() => setMes(desplazarMes(mes, 1))}
              aria-label="Mes siguiente"
              disabled={mes >= mesDe(hoyISO())}
            >
              →
            </button>
          </div>
          <span className="eyebrow">Balance del mes</span>
          <span className={`heroNumero ${balanceMes >= 0 ? "heroPos" : "heroNeg"}`}>
            <Cifra valor={balanceMes} formato={$} />
          </span>
          <span className="heroDetalle">
            Entró {$(ingresosMes)}, salió {$(gastosMes)}. Solo movimientos registrados.
          </span>
          <div className="heroChips">
            <Estado tono={desviacion > 0 ? "crit" : "ok"}>
              {desviacion >= 0 ? "+" : "−"}
              {$(Math.abs(desviacion)).replace("−", "")} contra el presupuesto
            </Estado>
            {totalExtraordinario > 0 && (
              <Estado tono="neutro">{$(totalExtraordinario)} extraordinarios aparte</Estado>
            )}
          </div>
        </div>
        <div className="heroGrafico">
          <span className="eyebrow">Gasto corriente acumulado</span>
          <AreaGlow
            puntos={acumulado}
            etiqueta={`Gasto corriente acumulado de ${nombrePeriodo(`${mes}-01`)} contra el presupuesto`}
            etiquetaX={(i) => `día ${i + 1}`}
            referencia={presupuestoTotal}
            etiquetaReferencia="presupuesto"
            color="--a-ink"
            alto={185}
          />
        </div>
      </section>

      {/* Entró, salió y la desviación ya viven en el héroe: una fila de
          tarjetas repitiéndolos era ruido. */}
      {fuentes.length > 0 && (
        <section className="panel">
          <header>
            <div>
              <h2>De dónde vino</h2>
              <p className="nota">Los ingresos del mes, por fuente.</p>
            </div>
          </header>
          <BarraApilada
            segmentos={fuentes}
            total={ingresosMes}
            alto={18}
            etiqueta="Ingresos del mes por fuente"
          />
        </section>
      )}

      <section className="panel">
        <header>
          <div>
            <h2>Anotar un movimiento</h2>
            <p className="nota">Lo que acaban de pagar, mientras lo tienen fresco.</p>
          </div>
        </header>

        <form className={css.formulario} onSubmit={(e) => void agregar(e)}>
          <label className={css.campo}>
            <span className="eyebrow">Fecha</span>
            <input
              className="campo"
              type="date"
              value={nuevo.fecha}
              max={hoyISO()}
              onChange={(e) => setNuevo({ ...nuevo, fecha: e.target.value })}
            />
          </label>

          <label className={`${css.campo} ${css.ancho}`}>
            <span className="eyebrow">Concepto</span>
            <input
              className="campo"
              placeholder="Mercado de la semana"
              value={nuevo.concepto}
              onChange={(e) => setNuevo({ ...nuevo, concepto: e.target.value })}
            />
          </label>

          <label className={css.campo}>
            <span className="eyebrow">{nuevo.clase === "ingreso" ? "Fuente" : "Categoría"}</span>
            <select
              className="campo"
              value={nuevo.categoria}
              onChange={(e) => setNuevo({ ...nuevo, categoria: e.target.value })}
            >
              {nuevo.clase === "ingreso"
                ? CATEGORIAS_INGRESO.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))
                : opcionesCategoria.map((c) => (
                    <option key={c.clave} value={c.clave}>
                      {c.nombre}
                    </option>
                  ))}
            </select>
          </label>

          <label className={css.campo}>
            <span className="eyebrow">Tipo</span>
            <select
              className="campo"
              value={nuevo.clase}
              onChange={(e) => {
                // Al cambiar de tipo, la categoría anterior deja de existir
                // en el catálogo nuevo: se repone con la de arranque.
                const clase = e.target.value as ClaseMovimiento;
                setNuevo({
                  ...nuevo,
                  clase,
                  categoria: clase === "ingreso" ? "Salario" : "Mercado",
                });
              }}
            >
              <option value="gasto">Gasto</option>
              <option value="ingreso">Ingreso</option>
            </select>
          </label>

          <label className={css.campo}>
            <span className="eyebrow">Monto</span>
            <input
              className="campo n"
              inputMode="decimal"
              value={nuevo.monto === 0 ? "" : String(nuevo.monto)}
              placeholder="0"
              onChange={(e) => setNuevo({ ...nuevo, monto: aNumero(e.target.value) })}
            />
          </label>

          <label className={css.campo}>
            <span className="eyebrow">Lo pagó</span>
            <SelectorPersona
              className="campo"
              valor={nuevo.pagado_por}
              etiqueta="Quién lo pagó"
              textoComun="Sin especificar"
              onCambio={(v) => setNuevo({ ...nuevo, pagado_por: v })}
            />
          </label>

          <label className={`${css.campo} ${css.checkbox}`}>
            <input
              type="checkbox"
              checked={nuevo.compartido}
              onChange={(e) => setNuevo({ ...nuevo, compartido: e.target.checked })}
            />
            <span>Es del bote común</span>
          </label>

          {nuevo.clase === "gasto" && (
            <label className={`${css.campo} ${css.checkbox}`}>
              <input
                type="checkbox"
                checked={nuevo.extraordinario}
                onChange={(e) => setNuevo({ ...nuevo, extraordinario: e.target.checked })}
              />
              <span title="Compra puntual que no se repite">Es extraordinario</span>
            </label>
          )}

          <button type="submit" className="pill primaria" disabled={nuevo.monto <= 0}>
            Anotar
          </button>
        </form>

        {/* Se mira un mes y se anota en otro: el movimiento se guarda bien
            pero desaparece de la vista, y parece que no se hubiera guardado. */}
        {mesDe(nuevo.fecha) !== mes && (
          <p className={css.avisoMes}>
            Esta fecha cae en <b>{nombrePeriodo(`${mesDe(nuevo.fecha)}-01`)}</b>, pero estás viendo{" "}
            <b>{nombrePeriodo(`${mes}-01`)}</b>. El movimiento se guardará donde dice la fecha y no
            aparecerá en esta lista.
          </p>
        )}
      </section>

      <section className="panel">
        <header>
          <div>
            <h2>Presupuestado contra ejecutado</h2>
            <p className="nota">Dónde se les está yendo la mano este mes.</p>
          </div>
          <EnlaceEditar a="/presupuesto" texto="Editar el presupuesto" />
        </header>
        <ComparativaPresupuesto lineas={comparativa} />

        {extraordinarios.length > 0 && (
          <div className={css.extraordinarios}>
            <div className={css.extraCabeza}>
              <span className="eyebrow">Aparte · gastos extraordinarios</span>
              <span className={css.extraTotal}>{$(totalExtraordinario)}</span>
            </div>
            <p className={css.extraNota}>
              Compras puntuales que no se repiten. Salieron del bolsillo igual, pero no se
              comparan contra el presupuesto porque este describe lo recurrente.
            </p>
            <ul className={css.extraLista}>
              {extraordinarios.map((m) => (
                <li key={m.id}>
                  <span className={css.extraConcepto}>{m.concepto}</span>
                  <span className={css.extraCategoria}>{etiquetaCategoria(m.categoria)}</span>
                  <span className={css.extraMonto}>{$(Number(m.monto))}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <LiquidacionBote mes={mes} delMes={delMes} />

      <section className="panel">
        <header>
          <div>
            <h2>Detalle del mes</h2>
            <p className="nota">{delMes.length} movimientos registrados.</p>
          </div>
        </header>

        {delMes.length === 0 && (
          <p className="vacio">
            Sin movimientos en {nombrePeriodo(`${mes}-01`)}. Anota uno arriba o importa el
            extracto del banco.
          </p>
        )}

        {semanas.map(([clave, lista], idx) => {
          const entroSemana = lista
            .filter((m) => m.clase === "ingreso")
            .reduce((s, m) => s + Number(m.monto), 0);
          const salioSemana = lista
            .filter((m) => m.clase === "gasto")
            .reduce((s, m) => s + Number(m.monto), 0);
          return (
        <details
          key={clave}
          className={css.semana}
          open={abiertas[clave] ?? idx === 0}
          onToggle={(e) => {
            const abierta = e.currentTarget.open;
            setAbiertas((s) => (s[clave] === abierta ? s : { ...s, [clave]: abierta }));
          }}
        >
          <summary className={css.semanaCabeza}>
            <span className={css.semanaFlecha} aria-hidden="true">
              ▸
            </span>
            <span className={css.semanaTitulo}>
              Del {fechaCorta(clave)} al {fechaCorta(sumarDias(clave, 6))}
            </span>
            <span className={css.semanaDatos}>
              {lista.length} {lista.length === 1 ? "movimiento" : "movimientos"}
              {entroSemana > 0 && (
                <>
                  {" "}
                  · entró <b className="num">{$(entroSemana)}</b>
                </>
              )}{" "}
              · salió <b className="num">{$(salioSemana)}</b>
            </span>
          </summary>
        <div className="tablaScroll">
          <table className="datos">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Concepto</th>
                <th>Categoría</th>
                <th>Lo pagó</th>
                <th className="r">Monto</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {lista.map((m) => (
                <tr key={m.id}>
                  <td style={{ whiteSpace: "nowrap", fontSize: 12.5, color: "var(--ink-2)" }}>
                    {fechaCorta(m.fecha)}
                  </td>
                  <td>
                    <input
                      aria-label="Concepto"
                      defaultValue={m.concepto}
                      onBlur={(e) =>
                        e.target.value !== m.concepto &&
                        void editar("movimientos", m.id, { concepto: e.target.value })
                      }
                    />
                  </td>
                  <td>
                    {m.clase === "transferencia" ? (
                      <span className={css.entreUstedes}>Entre ustedes</span>
                    ) : (
                    <select
                      aria-label={m.clase === "ingreso" ? "Fuente del ingreso" : "Categoría"}
                      value={m.categoria}
                      onChange={(e) =>
                        void editar("movimientos", m.id, { categoria: e.target.value })
                      }
                    >
                      {m.clase === "ingreso"
                        ? CATEGORIAS_INGRESO.map((c) => (
                            <option key={c} value={c}>
                              {c}
                            </option>
                          ))
                        : opcionesCategoria.map((c) => (
                            <option key={c.clave} value={c.clave}>
                              {c.nombre}
                            </option>
                          ))}
                    </select>
                    )}
                  </td>
                  <td>
                    <SelectorPersona
                      valor={m.pagado_por}
                      etiqueta="Quién lo pagó"
                      textoComun="Sin especificar"
                      onCambio={(v) => void editar("movimientos", m.id, { pagado_por: v })}
                    />
                  </td>
                  <td className="r">
                    <CampoMoneda
                      valor={Number(m.monto)}
                      etiqueta="Monto"
                      onCambio={(v) => void editar("movimientos", m.id, { monto: v })}
                    />
                  </td>
                  <td style={{ whiteSpace: "nowrap" }}>
                    {m.clase === "ingreso" && <Etiqueta lado="comun" texto="Ingreso" />}
                    {m.clase === "transferencia" && (
                      <Etiqueta lado={ladoDe(m.pagado_por)} texto="Liquidación" />
                    )}
                    {m.compartido && <Etiqueta lado="comun" texto="Bote" />}
                    {m.extraordinario && <Etiqueta lado="b" texto="Extra" />}
                    {m.origen === "importado" && <Etiqueta lado={ladoDe(m.pagado_por)} texto="CSV" />}
                    <button
                      className="borrar"
                      aria-label={`Eliminar ${m.concepto}`}
                      onClick={() => void borrar("movimientos", m.id)}
                    >
                      ×
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        </details>
          );
        })}
      </section>
    </>
  );
}
