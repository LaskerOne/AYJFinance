import { BarraProgreso } from "@/components/charts/BarraProgreso";
import { Estado, Etiqueta } from "@/components/ui/Etiqueta";
import { CampoMoneda } from "@/components/ui/CampoMoneda";
import { SelectorPersona } from "@/components/ui/SelectorPersona";
import { useHogar } from "@/contexts/HogarContext";
import { useMoneda } from "@/hooks/useMoneda";
import { useFinanzas } from "@/hooks/useFinanzas";
import { dentroDe, enMeses, porcentaje } from "@/lib/formato";
import css from "./Metas.module.css";

export function Metas() {
  const { metas, crear, editar, borrar, nombreDe, ladoDe } = useHogar();
  const { $ } = useMoneda();
  const f = useFinanzas();

  return (
    <>
      <section className="panel">
        <header>
          <div>
            <h2>Metas de ahorro</h2>
            <p className="nota">Avance real y fecha estimada con el aporte mensual de cada una.</p>
          </div>
          <span className="eyebrow">Aportan {$(f.aportes)} al mes</span>
        </header>

        {metas.length === 0 ? (
          <p className="vacio">Sin metas todavía. Agrega la primera abajo.</p>
        ) : (
          <div className={css.lista}>
            {metas.map((m) => {
              const objetivo = Number(m.objetivo);
              const acumulado = Number(m.acumulado);
              const aporte = Number(m.aporte);
              const avance = objetivo > 0 ? Math.min(1, acumulado / objetivo) : 0;
              const falta = Math.max(0, objetivo - acumulado);
              const meses = aporte > 0 ? Math.ceil(falta / aporte) : Infinity;
              const lista = falta <= 0;

              return (
                <div key={m.id} className={css.meta}>
                  <div className={css.cabeza}>
                    <span className={css.nombre}>
                      {m.nombre || "Sin nombre"}
                      {m.es_emergencia && <Estado tono="ok">Colchón</Estado>}
                      <Etiqueta lado={ladoDe(m.usuario_id)} texto={nombreDe(m.usuario_id)} />
                    </span>
                    <span className={css.cifras}>
                      <b>{$(acumulado)}</b> de {$(objetivo)}
                    </span>
                  </div>

                  <BarraProgreso
                    fraccion={avance}
                    color={lista ? "--ok" : "--a"}
                    etiqueta={`${m.nombre}: ${porcentaje(avance)} completo`}
                  />

                  <div className={css.pie}>
                    <span>{porcentaje(avance)} completo</span>
                    {lista ? (
                      <Estado tono="ok">Meta cumplida</Estado>
                    ) : (
                      <>
                        <span>
                          Faltan <b className="num">{$(falta)}</b>
                        </span>
                        {Number.isFinite(meses) ? (
                          <>
                            <span>
                              {enMeses(meses)} al ritmo de {$(aporte)}/mes
                            </span>
                            <span style={{ color: "var(--ink-3)" }}>≈ {dentroDe(meses)}</span>
                          </>
                        ) : (
                          <Estado tono="warn">Sin aporte mensual</Estado>
                        )}
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section className="panel">
        <header>
          <div>
            <h2>Editar metas</h2>
            <p className="nota">
              Marca como colchón la meta que hace de fondo de emergencia: es la que mide cuántos
              meses de vida tienen cubiertos.
            </p>
          </div>
        </header>

        <div className="tablaScroll">
          <table className="datos">
            <thead>
              <tr>
                <th>Meta</th>
                <th>De quién</th>
                <th className="r">Objetivo</th>
                <th className="r">Acumulado</th>
                <th className="r">Aporte/mes</th>
                <th>Colchón</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {metas.length === 0 && (
                <tr>
                  <td colSpan={7}>
                    <p className="vacio">Todavía no hay metas.</p>
                  </td>
                </tr>
              )}
              {metas.map((m) => (
                <tr key={m.id}>
                  <td>
                    <input
                      aria-label="Nombre de la meta"
                      defaultValue={m.nombre}
                      onBlur={(e) =>
                        e.target.value !== m.nombre &&
                        void editar("metas", m.id, { nombre: e.target.value })
                      }
                    />
                  </td>
                  <td>
                    <SelectorPersona
                      valor={m.usuario_id}
                      etiqueta="De quién es la meta"
                      onCambio={(v) => void editar("metas", m.id, { usuario_id: v })}
                    />
                  </td>
                  <td className="r">
                    <CampoMoneda
                      valor={Number(m.objetivo)}
                      etiqueta="Objetivo"
                      onCambio={(v) => void editar("metas", m.id, { objetivo: v })}
                    />
                  </td>
                  <td className="r">
                    <CampoMoneda
                      valor={Number(m.acumulado)}
                      etiqueta="Acumulado"
                      onCambio={(v) => void editar("metas", m.id, { acumulado: v })}
                    />
                  </td>
                  <td className="r">
                    <CampoMoneda
                      valor={Number(m.aporte)}
                      etiqueta="Aporte mensual"
                      onCambio={(v) => void editar("metas", m.id, { aporte: v })}
                    />
                  </td>
                  <td>
                    <input
                      type="checkbox"
                      aria-label="Es el fondo de emergencia"
                      checked={m.es_emergencia}
                      onChange={(e) =>
                        void editar("metas", m.id, { es_emergencia: e.target.checked })
                      }
                      style={{ width: "auto", accentColor: "var(--a)" }}
                    />
                  </td>
                  <td>
                    <button
                      className="borrar"
                      aria-label={`Eliminar ${m.nombre}`}
                      onClick={() => void borrar("metas", m.id)}
                    >
                      ×
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={4}>Total aportado al mes</td>
                <td className="r tot">{$(f.aportes)}</td>
                <td />
                <td />
              </tr>
            </tfoot>
          </table>
        </div>

        <button
          className="agregar"
          onClick={() =>
            void crear("metas", {
              usuario_id: null,
              nombre: "",
              objetivo: 0,
              acumulado: 0,
              aporte: 0,
              es_emergencia: false,
              orden: metas.length + 1,
            })
          }
        >
          + Agregar meta
        </button>
      </section>
    </>
  );
}
