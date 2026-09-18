import { useState } from "react";
import { CampoMoneda } from "@/components/ui/CampoMoneda";
import { SelectorPersona } from "@/components/ui/SelectorPersona";
import { useHogar } from "@/contexts/HogarContext";
import { useMoneda } from "@/hooks/useMoneda";
import { useFinanzas } from "@/hooks/useFinanzas";
import { useCategorias } from "@/hooks/useCategorias";
import { gastoMensual, ingresoMensual } from "@/lib/calculos";
import {
  FRECUENCIAS,
  NOMBRE_FRECUENCIA,
  type Frecuencia,
  type TipoGasto,
} from "@/models/dominio";

type Pestania = "ingresos" | "gastos";

export function Presupuesto() {
  const { ingresos, gastos, crear, editar, borrar } = useHogar();
  const { $ } = useMoneda();
  const f = useFinanzas();
  const { opciones: opcionesCategoria } = useCategorias();
  const [pestania, setPestania] = useState<Pestania>("ingresos");

  return (
    <section className="panel">
      <header>
        <div>
          <h2>Presupuesto mensual</h2>
          <p className="nota">
            Lo que esperan que entre y salga cada mes. Los movimientos reales se registran aparte y
            se comparan contra esto.
          </p>
        </div>
        <div className="segmentado" role="group" aria-label="Qué editar">
          <button
            type="button"
            aria-pressed={pestania === "ingresos"}
            onClick={() => setPestania("ingresos")}
          >
            Ingresos
          </button>
          <button
            type="button"
            aria-pressed={pestania === "gastos"}
            onClick={() => setPestania("gastos")}
          >
            Gastos
          </button>
        </div>
      </header>

      {pestania === "ingresos" ? (
        <>
          <div className="tablaScroll">
            <table className="datos">
              <thead>
                <tr>
                  <th>De quién</th>
                  <th>Concepto</th>
                  <th>Frecuencia</th>
                  <th className="r">Monto</th>
                  <th className="r">Equivale al mes</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {ingresos.length === 0 && (
                  <tr>
                    <td colSpan={6}>
                      <p className="vacio">Todavía no hay ingresos registrados.</p>
                    </td>
                  </tr>
                )}
                {ingresos.map((i) => (
                  <tr key={i.id}>
                    <td>
                      <SelectorPersona
                        valor={i.usuario_id}
                        etiqueta="De quién es el ingreso"
                        textoComun="Del hogar"
                        onCambio={(v) => void editar("ingresos", i.id, { usuario_id: v })}
                      />
                    </td>
                    <td>
                      <input
                        aria-label="Concepto"
                        defaultValue={i.concepto}
                        onBlur={(e) =>
                          e.target.value !== i.concepto &&
                          void editar("ingresos", i.id, { concepto: e.target.value })
                        }
                      />
                    </td>
                    <td>
                      <select
                        aria-label="Frecuencia"
                        value={i.frecuencia}
                        onChange={(e) =>
                          void editar("ingresos", i.id, { frecuencia: e.target.value as Frecuencia })
                        }
                      >
                        {(Object.keys(NOMBRE_FRECUENCIA) as Frecuencia[]).map((fr) => (
                          <option key={fr} value={fr}>
                            {NOMBRE_FRECUENCIA[fr]}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="r">
                      <CampoMoneda
                        valor={Number(i.monto)}
                        etiqueta="Monto"
                        onCambio={(v) => void editar("ingresos", i.id, { monto: v })}
                      />
                    </td>
                    <td className="r num" style={{ fontSize: 12.5, color: "var(--ink-2)" }}>
                      {$(ingresoMensual(i))}
                    </td>
                    <td>
                      <button
                        className="borrar"
                        aria-label={`Eliminar ${i.concepto}`}
                        onClick={() => void borrar("ingresos", i.id)}
                      >
                        ×
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={4}>Total mensual</td>
                  <td className="r tot">{$(f.ingreso)}</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>

          <button
            className="agregar"
            onClick={() =>
              void crear("ingresos", {
                usuario_id: null,
                concepto: "",
                monto: 0,
                frecuencia: "mensual",
                orden: ingresos.length + 1,
              })
            }
          >
            + Agregar ingreso
          </button>
        </>
      ) : (
        <>
          <div className="tablaScroll">
            <table className="datos">
              <thead>
                <tr>
                  <th>Categoría</th>
                  <th>Concepto</th>
                  <th>Tipo</th>
                  <th>Quién lo asume</th>
                  <th>Frecuencia</th>
                  <th className="r">Monto</th>
                  <th className="r">Equivale al mes</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {gastos.length === 0 && (
                  <tr>
                    <td colSpan={8}>
                      <p className="vacio">Todavía no hay gastos presupuestados.</p>
                    </td>
                  </tr>
                )}
                {gastos.map((g) => (
                  <tr key={g.id}>
                    <td>
                      <select
                        aria-label="Categoría"
                        value={g.categoria}
                        onChange={(e) =>
                          void editar("gastos_presupuesto", g.id, { categoria: e.target.value })
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
                      <input
                        aria-label="Concepto"
                        defaultValue={g.concepto}
                        onBlur={(e) =>
                          e.target.value !== g.concepto &&
                          void editar("gastos_presupuesto", g.id, { concepto: e.target.value })
                        }
                      />
                    </td>
                    <td>
                      <select
                        aria-label="Tipo de gasto"
                        value={g.tipo}
                        onChange={(e) =>
                          void editar("gastos_presupuesto", g.id, {
                            tipo: e.target.value as TipoGasto,
                          })
                        }
                      >
                        <option value="fijo">Fijo</option>
                        <option value="variable">Variable</option>
                      </select>
                    </td>
                    <td>
                      <SelectorPersona
                        valor={g.usuario_id}
                        etiqueta="Quién asume el gasto"
                        onCambio={(v) => void editar("gastos_presupuesto", g.id, { usuario_id: v })}
                      />
                    </td>
                    <td>
                      <select
                        aria-label="Frecuencia"
                        value={g.frecuencia ?? "mensual"}
                        onChange={(e) =>
                          void editar("gastos_presupuesto", g.id, {
                            frecuencia: e.target.value as Frecuencia,
                          })
                        }
                      >
                        {FRECUENCIAS.map((fr) => (
                          <option key={fr} value={fr}>
                            {NOMBRE_FRECUENCIA[fr]}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="r">
                      <CampoMoneda
                        valor={Number(g.monto)}
                        etiqueta="Monto del ciclo"
                        onCambio={(v) => void editar("gastos_presupuesto", g.id, { monto: v })}
                      />
                    </td>
                    <td className="r num" style={{ fontSize: 12.5, color: "var(--ink-2)" }}>
                      {$(gastoMensual(g))}
                    </td>
                    <td>
                      <button
                        className="borrar"
                        aria-label={`Eliminar ${g.concepto}`}
                        onClick={() => void borrar("gastos_presupuesto", g.id)}
                      >
                        ×
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={6}>Total mensual equivalente</td>
                  <td className="r tot">{$(f.gastos)}</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>

          <button
            className="agregar"
            onClick={() =>
              void crear("gastos_presupuesto", {
                usuario_id: null,
                categoria: "Vivienda",
                frecuencia: "mensual",
                concepto: "",
                monto: 0,
                tipo: "fijo",
                orden: gastos.length + 1,
              })
            }
          >
            + Agregar gasto
          </button>
        </>
      )}
    </section>
  );
}
