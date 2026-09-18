import { useMemo, useState, type FormEvent } from "react";
import { FilaKpi } from "@/components/ui/Kpi";
import { Etiqueta } from "@/components/ui/Etiqueta";
import { CampoMoneda } from "@/components/ui/CampoMoneda";
import { SelectorPersona } from "@/components/ui/SelectorPersona";
import { useHogar } from "@/contexts/HogarContext";
import { useMoneda } from "@/hooks/useMoneda";
import { useCategorias } from "@/hooks/useCategorias";
import { EnlaceEditar } from "@/components/ui/EnlaceEditar";
import { aNumero, fechaCorta, hoyISO, nombrePeriodo } from "@/lib/formato";
import { CATEGORIAS, type Categoria, type ClaseMovimiento } from "@/models/dominio";
import {
  ComparativaPresupuesto,
  type LineaComparativa,
} from "./components/ComparativaPresupuesto";
import css from "./Movimientos.module.css";

function mesDe(iso: string): string {
  return iso.slice(0, 7);
}

function desplazarMes(mes: string, delta: number): string {
  const [a, m] = mes.split("-").map(Number);
  const d = new Date(a, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function Movimientos() {
  const { movimientos, gastos, crear, editar, borrar, ladoDe, idA } = useHogar();
  const { $ } = useMoneda();
  const { opciones: opcionesCategoria } = useCategorias();

  const [mes, setMes] = useState(() => mesDe(hoyISO()));
  const [nuevo, setNuevo] = useState(() => ({
    fecha: hoyISO(),
    concepto: "",
    categoria: "Mercado" as Categoria,
    monto: 0,
    clase: "gasto" as ClaseMovimiento,
    pagado_por: idA,
    compartido: true,
  }));

  const delMes = useMemo(
    () => movimientos.filter((m) => mesDe(m.fecha) === mes),
    [movimientos, mes],
  );

  const ingresosMes = delMes
    .filter((m) => m.clase === "ingreso")
    .reduce((s, m) => s + Number(m.monto), 0);
  const gastosMes = delMes
    .filter((m) => m.clase === "gasto")
    .reduce((s, m) => s + Number(m.monto), 0);

  const comparativa: LineaComparativa[] = useMemo(() => {
    const filas = CATEGORIAS.map((categoria) => ({
      categoria,
      presupuesto: gastos
        .filter((g) => g.categoria === categoria)
        .reduce((s, g) => s + Number(g.monto), 0),
      ejecutado: delMes
        .filter((m) => m.clase === "gasto" && m.categoria === categoria)
        .reduce((s, m) => s + Number(m.monto), 0),
    }));
    return filas
      .filter((f) => f.presupuesto > 0 || f.ejecutado > 0)
      .sort((a, b) => b.ejecutado - a.ejecutado);
  }, [gastos, delMes]);

  const presupuestoTotal = comparativa.reduce((s, c) => s + c.presupuesto, 0);
  const desviacion = gastosMes - presupuestoTotal;

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
      origen: "manual",
    });
    setNuevo((n) => ({ ...n, concepto: "", monto: 0 }));
    setMes(mesDe(nuevo.fecha));
  };

  return (
    <>
      <section className="panel">
        <header>
          <div>
            <h2>Movimientos de {nombrePeriodo(`${mes}-01`)}</h2>
            <p className="nota">Lo que de verdad pasó, frente a lo que habían presupuestado.</p>
          </div>
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
        </header>

        <FilaKpi
          columnas={4}
          datos={[
            { etiqueta: "Entró", valor: $(ingresosMes), detalle: `${delMes.filter((m) => m.clase === "ingreso").length} movimientos` },
            { etiqueta: "Salió", valor: $(gastosMes), detalle: `${delMes.filter((m) => m.clase === "gasto").length} movimientos` },
            {
              etiqueta: "Contra el presupuesto",
              valor: `${desviacion >= 0 ? "+" : "−"}${$(Math.abs(desviacion)).replace("−", "")}`,
              detalle: desviacion >= 0 ? "Por encima de lo planeado" : "Por debajo de lo planeado",
              tono: desviacion > 0 ? "negativo" : "positivo",
              destacado: true,
            },
            {
              etiqueta: "Balance del mes",
              valor: $(ingresosMes - gastosMes),
              detalle: "Solo movimientos registrados",
              tono: ingresosMes - gastosMes >= 0 ? "positivo" : "negativo",
            },
          ]}
        />
      </section>

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
            <span className="eyebrow">Categoría</span>
            <select
              className="campo"
              value={nuevo.categoria}
              onChange={(e) => setNuevo({ ...nuevo, categoria: e.target.value as Categoria })}
            >
              {opcionesCategoria.map((c) => (
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
              onChange={(e) => setNuevo({ ...nuevo, clase: e.target.value as ClaseMovimiento })}
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

          <button type="submit" className="pill primaria" disabled={nuevo.monto <= 0}>
            Anotar
          </button>
        </form>
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
      </section>

      <section className="panel">
        <header>
          <div>
            <h2>Detalle del mes</h2>
            <p className="nota">{delMes.length} movimientos registrados.</p>
          </div>
        </header>

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
              {delMes.length === 0 && (
                <tr>
                  <td colSpan={6}>
                    <p className="vacio">
                      Sin movimientos en {nombrePeriodo(`${mes}-01`)}. Anota uno arriba o importa el
                      extracto del banco.
                    </p>
                  </td>
                </tr>
              )}
              {delMes.map((m) => (
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
                    <select
                      aria-label="Categoría"
                      value={m.categoria}
                      onChange={(e) =>
                        void editar("movimientos", m.id, { categoria: e.target.value })
                      }
                    >
                      {opcionesCategoria.map((c) => (
                        <option key={c.clave} value={c.clave}>
                          {c.nombre}
                        </option>
                      ))}
                    </select>
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
      </section>
    </>
  );
}
