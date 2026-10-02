import { useMemo, useState } from "react";
import { BarrasMensuales, type ColumnaMes } from "@/components/charts/BarrasMensuales";
import { LineaTiempo, type Serie } from "@/components/charts/LineaTiempo";
import { LeyendaSegmentos } from "@/components/charts/BarraApilada";
import { FilaKpi } from "@/components/ui/Kpi";
import { Estado } from "@/components/ui/Etiqueta";
import { useHogar } from "@/contexts/HogarContext";
import { useMoneda } from "@/hooks/useMoneda";
import { useCategorias } from "@/hooks/useCategorias";
import { cerrarMes } from "@/services/coleccion.service";
import { mensajeDeError } from "@/services/supabase";
import { nombrePeriodo, porcentaje } from "@/lib/formato";
import { COLOR_CATEGORIA, type Categoria } from "@/models/dominio";
import css from "./Historico.module.css";

/** Mes actual en formato YYYY-MM, que es lo que entiende <input type="month">. */
function mesActual(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function mesAnterior(mes: string): string {
  const [a, m] = mes.split("-").map(Number);
  const d = new Date(a, m - 2, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function Historico() {
  const { cierres, hogar, recargar } = useHogar();
  const { $ } = useMoneda();
  const { etiqueta } = useCategorias();
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");

  // Un mes se cierra cuando ya terminó, así que lo natural al entrar aquí es
  // el mes pasado, no el que está corriendo.
  const [periodo, setPeriodo] = useState(() => mesAnterior(mesActual()));

  const ordenados = useMemo(
    () => [...cierres].sort((a, b) => (a.periodo < b.periodo ? -1 : 1)),
    [cierres],
  );

  const columnas: ColumnaMes[] = ordenados.map((c) => ({
    periodo: c.periodo,
    valores: [
      { nombre: "Ingresos", valor: Number(c.ingresos), color: "--s-ingreso" },
      { nombre: "Gastos", valor: Number(c.gastos) + Number(c.cuotas), color: "--s-gasto" },
      { nombre: "Ahorro", valor: Number(c.ahorro), color: "--s-ahorro" },
    ],
  }));

  const serieDeuda: Serie[] = [
    {
      nombre: "Deuda total",
      puntos: ordenados.map((c) => Number(c.deuda_total)),
      color: "--s-deuda",
    },
  ];

  const ultimo = ordenados[ordenados.length - 1];
  const penultimo = ordenados[ordenados.length - 2];

  const variacion = (campo: "ingresos" | "gastos" | "ahorro" | "deuda_total") => {
    if (!ultimo || !penultimo) return null;
    const antes = Number(penultimo[campo]);
    const ahora = Number(ultimo[campo]);
    if (antes === 0) return null;
    return (ahora - antes) / Math.abs(antes);
  };

  const categoriasUsadas = useMemo(() => {
    const juego = new Set<Categoria>();
    for (const c of ordenados) {
      for (const clave of Object.keys(c.por_categoria ?? {})) juego.add(clave as Categoria);
    }
    return [...juego];
  }, [ordenados]);

  const cerrar = async () => {
    if (!hogar) return;
    setError("");
    setGuardando(true);
    try {
      await cerrarMes(hogar.id, `${periodo}-01`);
      await recargar();
    } catch (e) {
      setError(mensajeDeError(e));
    } finally {
      setGuardando(false);
    }
  };

  const yaCerrado = ordenados.some((c) => c.periodo.slice(0, 7) === periodo);

  return (
    <>
      <section className="panel">
        <header>
          <div>
            <h2>Histórico mensual</h2>
            <p className="nota">
              Cada cierre congela el mes: ingresos, gastos, cuotas, ahorro y deuda. Si vuelves a
              cerrar el mismo mes, se recalcula con los datos de hoy.
            </p>
          </div>
          <div className={css.cierre}>
            <label className={css.selectorMes}>
              <span className="eyebrow">Mes a cerrar</span>
              <input
                className="campo"
                type="month"
                value={periodo}
                max={mesActual()}
                onChange={(e) => e.target.value && setPeriodo(e.target.value)}
              />
            </label>
            <button className="pill primaria" onClick={() => void cerrar()} disabled={guardando}>
              {guardando ? "Cerrando…" : yaCerrado ? "Recalcular" : "Cerrar mes"}
            </button>
          </div>
        </header>

        <p className={css.pistaCierre}>
          {yaCerrado ? (
            <>
              <b>{nombrePeriodo(`${periodo}-01`)}</b> ya está cerrado. Volver a cerrarlo lo
              recalcula con los datos de hoy, que es justo lo que hay que hacer después de
              corregir movimientos.
            </>
          ) : (
            <>
              Se congelarán los totales de <b>{nombrePeriodo(`${periodo}-01`)}</b>: ingresos,
              gastos, cuotas, ahorro y deuda, más el desglose por categoría.
            </>
          )}
        </p>

        {error && <p className={css.error}>{error}</p>}

        {ordenados.length === 0 ? (
          <p className="vacio">
            Todavía no hay meses cerrados. Cierra el mes actual para empezar a construir el
            histórico: con dos o tres meses ya se ven las tendencias.
          </p>
        ) : (
          <>
            <FilaKpi
              columnas={4}
              datos={[
                {
                  etiqueta: "Meses registrados",
                  valor: String(ordenados.length),
                  detalle: `Desde ${nombrePeriodo(ordenados[0].periodo)}`,
                },
                {
                  etiqueta: "Ahorro del último mes",
                  valor: $(Number(ultimo?.ahorro ?? 0)),
                  detalle: (() => {
                    const v = variacion("ahorro");
                    return v === null
                      ? "Sin mes anterior para comparar"
                      : `${v >= 0 ? "+" : "−"}${porcentaje(Math.abs(v))} contra el mes pasado`;
                  })(),
                  tono: Number(ultimo?.ahorro ?? 0) >= 0 ? "positivo" : "negativo",
                  destacado: true,
                },
                {
                  etiqueta: "Deuda al último cierre",
                  valor: $(Number(ultimo?.deuda_total ?? 0)),
                  detalle: (() => {
                    const v = variacion("deuda_total");
                    if (v === null) return "Sin mes anterior para comparar";
                    return v <= 0
                      ? `Bajó ${porcentaje(Math.abs(v))}`
                      : `Subió ${porcentaje(v)}`;
                  })(),
                  tono: (variacion("deuda_total") ?? 0) <= 0 ? "positivo" : "negativo",
                },
                {
                  etiqueta: "Gasto promedio",
                  valor: $(
                    ordenados.reduce((s, c) => s + Number(c.gastos), 0) / ordenados.length,
                  ),
                  detalle: "Media de los meses cerrados",
                },
              ]}
            />

            <div className={css.bloque}>
              <h3 className={css.subtitulo}>Mes a mes</h3>
              <BarrasMensuales meses={columnas} etiqueta="Ingresos, gastos y ahorro por mes" />
              <LeyendaSegmentos
                segmentos={[
                  { nombre: "Ingresos", valor: 0, color: "--s-ingreso" },
                  { nombre: "Gastos y cuotas", valor: 0, color: "--s-gasto" },
                  { nombre: "Ahorro", valor: 0, color: "--s-ahorro" },
                ]}
                conValores={false}
              />
            </div>

            {ordenados.length > 1 && (
              <div className={css.bloque}>
                <h3 className={css.subtitulo}>Cómo va bajando la deuda</h3>
                <LineaTiempo
                  series={serieDeuda}
                  etiqueta="Deuda total por mes"
                  alto={180}
                  etiquetaX={(i) =>
                    ordenados[i] ? nombrePeriodo(ordenados[i].periodo).slice(0, 3) : ""
                  }
                />
              </div>
            )}
          </>
        )}
      </section>

      {ordenados.length > 0 && (
        <section className="panel">
          <header>
            <div>
              <h2>El detalle, mes por mes</h2>
              <p className="nota">La misma información del gráfico, en números exactos.</p>
            </div>
          </header>

          <div className="tablaScroll">
            <table className="datos">
              <thead>
                <tr>
                  <th>Mes</th>
                  <th className="r">Ingresos</th>
                  <th className="r">Gastos</th>
                  <th className="r">Cuotas</th>
                  <th className="r">Ahorro</th>
                  <th className="r">Deuda</th>
                  {categoriasUsadas.map((c) => (
                    <th key={c} className="r">
                      {etiqueta(c)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[...ordenados].reverse().map((c) => (
                  <tr key={c.id}>
                    <td style={{ textTransform: "capitalize", whiteSpace: "nowrap" }}>
                      {nombrePeriodo(c.periodo)}
                    </td>
                    <td className="r num">{$(Number(c.ingresos))}</td>
                    <td className="r num">{$(Number(c.gastos))}</td>
                    <td className="r num">{$(Number(c.cuotas))}</td>
                    <td className="r num">
                      {Number(c.ahorro) < 0 ? (
                        <span style={{ color: "var(--crit-ink)" }}>{$(Number(c.ahorro))}</span>
                      ) : (
                        $(Number(c.ahorro))
                      )}
                    </td>
                    <td className="r num">{$(Number(c.deuda_total))}</td>
                    {categoriasUsadas.map((cat) => (
                      <td key={cat} className="r num" style={{ fontSize: 12 }}>
                        <span
                          className={css.puntoCat}
                          style={{ background: `var(${COLOR_CATEGORIA[cat]})` }}
                        />
                        {$(Number(c.por_categoria?.[cat] ?? 0))}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {ordenados.length === 1 && (
            <p className={css.pista}>
              <Estado tono="neutro">Un solo mes</Estado> Con dos o tres cierres empiezan a verse
              las tendencias y las comparaciones cobran sentido.
            </p>
          )}
        </section>
      )}
    </>
  );
}
