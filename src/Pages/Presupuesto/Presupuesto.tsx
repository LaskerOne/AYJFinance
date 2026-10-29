import { useState } from "react";
import { Cifra } from "@/components/ui/Cifra";
import { Estado } from "@/components/ui/Etiqueta";
import { BarraApilada, type Segmento } from "@/components/charts/BarraApilada";
import { CampoMoneda } from "@/components/ui/CampoMoneda";
import { SelectorPersona } from "@/components/ui/SelectorPersona";
import { useHogar } from "@/contexts/HogarContext";
import { useMoneda } from "@/hooks/useMoneda";
import { useFinanzas } from "@/hooks/useFinanzas";
import { useCategorias } from "@/hooks/useCategorias";
import { gastoMensual, ingresoMensual } from "@/lib/calculos";
import { SelectorMesPago } from "./components/SelectorMesPago";
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

  // Lo comprometido cada mes: gastos de vida, cuotas y aportes a metas.
  const comprometido = f.gastos + f.cuotas + f.aportes;
  const fraccionComprometida = f.ingreso > 0 ? comprometido / f.ingreso : 0;
  const ingresoHogar = Math.max(0, f.ingreso - f.ingresoA - f.ingresoB);
  const fuentesIngreso: Segmento[] = [
    { nombre: "Ingresos de los dos", valor: f.ingresoA + f.ingresoB, color: "--a" },
    { nombre: "Del hogar", valor: ingresoHogar, color: "--comun" },
  ];

  return (
    <>
      <section className="panel hero heroGrid">
        <div className="heroCifras">
          <span className="eyebrow">Comprometido cada mes</span>
          <span className="heroNumero heroVio">
            <Cifra valor={comprometido} formato={$} />
          </span>
          <span className="heroDetalle">
            Gastos de vida, cuotas y aportes a metas, sobre {$(f.ingreso)} que entran.
          </span>
          <div className="heroChips">
            <Estado
              tono={
                fraccionComprometida <= 0.8
                  ? "ok"
                  : fraccionComprometida <= 1
                    ? "warn"
                    : "crit"
              }
            >
              {Math.round(fraccionComprometida * 100)} % del ingreso
            </Estado>
            <Estado tono={f.libre >= 0 ? "neutro" : "crit"}>
              {f.libre >= 0 ? `Queda ${$(f.libre)} sin asignar` : `Descuadre de ${$(-f.libre)}`}
            </Estado>
          </div>
        </div>
        <div className="heroGrafico">
          <span className="eyebrow">A dónde va cada peso presupuestado</span>
          <BarraApilada
            segmentos={[
              { nombre: "Gastos de vida", valor: f.gastos, color: "--s-gasto" },
              { nombre: "Cuotas", valor: f.cuotas, color: "--s-deuda" },
              { nombre: "Metas", valor: f.aportes, color: "--s-ahorro" },
              { nombre: "Sin asignar", valor: Math.max(0, f.libre), color: "--s-libre" },
            ]}
            total={f.ingreso}
            etiqueta="Reparto del ingreso presupuestado"
          />
          {fuentesIngreso[0].valor + fuentesIngreso[1].valor > 0 && (
            <>
              <span className="eyebrow" style={{ marginTop: 10 }}>
                De dónde sale
              </span>
              <BarraApilada
                segmentos={
                  f.ingresoA + f.ingresoB > 0 && ingresoHogar > 0
                    ? fuentesIngreso
                    : [
                        { nombre: "Tuyo", valor: f.ingresoA, color: "--a" },
                        { nombre: "De tu pareja", valor: f.ingresoB, color: "--b" },
                      ]
                }
                total={f.ingreso}
                alto={16}
                etiqueta="Ingreso por persona"
              />
            </>
          )}
        </div>
      </section>

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
                  <th>Mes de pago</th>
                  <th title="Salario de empleado con prima y cesantías">Prestaciones</th>
                  <th className="r">Monto</th>
                  <th className="r">Equivale al mes</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {ingresos.length === 0 && (
                  <tr>
                    <td colSpan={8}>
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
                    <td>
                      <SelectorMesPago
                        frecuencia={i.frecuencia}
                        valor={i.mes_pago}
                        onCambio={(mes) => void editar("ingresos", i.id, { mes_pago: mes })}
                      />
                    </td>
                    <td style={{ textAlign: "center" }}>
                      {i.frecuencia === "mensual" || i.frecuencia === "quincenal" ? (
                        <input
                          type="checkbox"
                          aria-label="Salario con prima y cesantías"
                          checked={Boolean(i.con_prestaciones)}
                          onChange={(e) =>
                            void editar("ingresos", i.id, { con_prestaciones: e.target.checked })
                          }
                          style={{ width: "auto", accentColor: "var(--a)" }}
                        />
                      ) : (
                        <span style={{ color: "var(--ink-3)" }}>—</span>
                      )}
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
                  <td colSpan={6}>Total mensual</td>
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
                  <th>Mes de pago</th>
                  <th title="Con él, el pago sale con su fecha en los fijos del mes">Día de pago</th>
                  <th className="r">Monto</th>
                  <th className="r">Equivale al mes</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {gastos.length === 0 && (
                  <tr>
                    <td colSpan={10}>
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
                    <td>
                      <SelectorMesPago
                        frecuencia={g.frecuencia ?? "mensual"}
                        valor={g.mes_pago}
                        onCambio={(mes) => void editar("gastos_presupuesto", g.id, { mes_pago: mes })}
                      />
                    </td>
                    <td>
                      {/* Solo los fijos se registran desde la lista del mes;
                          a un variable no le sirve. */}
                      {g.tipo === "fijo" ? (
                        <input
                          aria-label="Día de pago"
                          className="n"
                          inputMode="numeric"
                          placeholder="—"
                          style={{ width: 56 }}
                          defaultValue={g.dia_pago ?? ""}
                          onBlur={(e) => {
                            const dia = Math.trunc(Number(e.target.value));
                            const valor = dia >= 1 && dia <= 31 ? dia : null;
                            e.target.value = valor === null ? "" : String(valor);
                            if (valor !== (g.dia_pago ?? null)) {
                              void editar("gastos_presupuesto", g.id, { dia_pago: valor });
                            }
                          }}
                        />
                      ) : (
                        <span style={{ color: "var(--ink-3)", paddingLeft: 8 }}>—</span>
                      )}
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
                  <td colSpan={8}>Total mensual equivalente</td>
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
    </>
  );
}
