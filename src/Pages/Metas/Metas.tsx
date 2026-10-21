import { useMemo } from "react";
import { TuboMeta } from "./components/TuboMeta";
import { AreaGlow } from "@/components/charts/AreaGlow";
import { Cifra } from "@/components/ui/Cifra";
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

  const acumuladoTotal = metas.reduce((s, m) => s + Number(m.acumulado), 0);
  const objetivoTotal = metas.reduce((s, m) => s + Number(m.objetivo), 0);
  const cumplidas = metas.filter(
    (m) => Number(m.objetivo) > 0 && Number(m.acumulado) >= Number(m.objetivo),
  ).length;

  // Cómo crece el ahorro total al ritmo actual: desde hoy hasta alcanzar el
  // objetivo (con un par de meses de aire), tope de 36 para que se lea.
  const proyeccion = useMemo(() => {
    const falta = Math.max(0, objetivoTotal - acumuladoTotal);
    const horizonte =
      f.aportes > 0 ? Math.min(36, Math.max(6, Math.ceil(falta / f.aportes) + 2)) : 12;
    return Array.from({ length: horizonte + 1 }, (_, i) => acumuladoTotal + f.aportes * i);
  }, [acumuladoTotal, objetivoTotal, f.aportes]);

  return (
    <>
      {metas.length > 0 && (
        <section className="panel hero heroGrid">
          <div className="heroCifras">
            <span className="eyebrow">Ahorrado entre todas las metas</span>
            <span className="heroNumero heroPos">
              <Cifra valor={acumuladoTotal} formato={$} />
            </span>
            <span className="heroDetalle">
              De {$(objetivoTotal)} entre {metas.length}{" "}
              {metas.length === 1 ? "meta" : "metas"}.
            </span>
            <div className="heroChips">
              {f.aportes > 0 ? (
                <Estado tono="ok">Aportan {$(f.aportes)} al mes</Estado>
              ) : (
                <Estado tono="warn">Sin aportes mensuales</Estado>
              )}
              {cumplidas > 0 && (
                <Estado tono="neutro">
                  {cumplidas} de {metas.length} cumplidas
                </Estado>
              )}
            </div>
          </div>
          <div className="heroGrafico">
            <span className="eyebrow">Así crece al ritmo actual</span>
            <AreaGlow
              puntos={proyeccion}
              etiqueta="Proyección del ahorro total contra el objetivo"
              etiquetaX={(i) => (i === 0 ? "hoy" : `+${i} m`)}
              referencia={objetivoTotal}
              etiquetaReferencia="objetivo"
              color="--a-ink"
              alto={185}
            />
          </div>
        </section>
      )}

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
          <div className={css.tubos}>
            {/* Primero las que ya tienen plata adentro, de más a menos; las vacías
                al final. La tabla de edición conserva su orden propio. */}
            {[...metas]
              .sort((a, b) => Number(b.acumulado) - Number(a.acumulado))
              .map((m, i) => {
              const objetivo = Number(m.objetivo);
              const acumulado = Number(m.acumulado);
              const aporte = Number(m.aporte);
              const avance = objetivo > 0 ? Math.min(1, acumulado / objetivo) : 0;
              const falta = Math.max(0, objetivo - acumulado);
              const meses = aporte > 0 ? Math.ceil(falta / aporte) : Infinity;
              const lista = falta <= 0;

              return (
                <article
                  key={m.id}
                  className={css.tubo}
                  style={{ ["--i" as string]: String(i) }}
                  aria-label={`${m.nombre}: ${porcentaje(avance)} completo`}
                >
                  <span className={css.tuboNombre}>
                    {m.nombre || "Sin nombre"}
                    {m.es_emergencia && <Estado tono="ok">Colchón</Estado>}
                  </span>

                  <TuboMeta fraccion={avance} cumplida={lista} />
                  <span className={css.tuboPct}>{porcentaje(avance)}</span>

                  <span className={css.tuboCifras}>
                    <b>{$(acumulado)}</b> de {$(objetivo)}
                  </span>
                  <Etiqueta lado={ladoDe(m.usuario_id)} texto={nombreDe(m.usuario_id)} />

                  <span className={css.tuboPie}>
                    {lista ? (
                      <Estado tono="ok">Meta cumplida</Estado>
                    ) : Number.isFinite(meses) ? (
                      <>
                        Faltan <b className="num">{$(falta)}</b> · {enMeses(meses)} al ritmo
                        actual · ≈ {dentroDe(meses)}
                      </>
                    ) : (
                      <>
                        Faltan <b className="num">{$(falta)}</b> ·{" "}
                        <Estado tono="warn">Sin aporte mensual</Estado>
                      </>
                    )}
                  </span>
                </article>
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
