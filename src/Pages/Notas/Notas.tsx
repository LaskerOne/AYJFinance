import { useMemo } from "react";
import { useHogar } from "@/contexts/HogarContext";
import { MESES } from "@/lib/formato";
import css from "./Notas.module.css";

function cuando(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const hoy = new Date();
  const mismoDia =
    d.getDate() === hoy.getDate() &&
    d.getMonth() === hoy.getMonth() &&
    d.getFullYear() === hoy.getFullYear();
  const hora = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  if (mismoDia) return `hoy a las ${hora}`;
  return `${d.getDate()} de ${MESES[d.getMonth()]}, ${hora}`;
}

export function Notas() {
  const { notas, crear, editar, borrar, nombreDe, idA } = useHogar();

  // Fijadas arriba; dentro de cada grupo, lo último tocado primero.
  const ordenadas = useMemo(
    () =>
      [...notas].sort((a, b) => {
        if (a.fijada !== b.fijada) return a.fijada ? -1 : 1;
        return a.actualizada_en < b.actualizada_en ? 1 : -1;
      }),
    [notas],
  );

  return (
    <section className="panel">
      <header>
        <div>
          <h2>Notas</h2>
          <p className="nota">
            Apuntes, proyecciones, acuerdos, pendientes. Lo que no cabe en una tabla de cifras pero
            sostiene las decisiones que hay detrás. Los dos ven lo mismo, al instante.
          </p>
        </div>
        <button
          className="pill primaria"
          onClick={() =>
            void crear("notas", { titulo: "", cuerpo: "", fijada: false, autor: idA })
          }
        >
          Nueva nota
        </button>
      </header>

      {ordenadas.length === 0 ? (
        <p className="vacio">
          Sin notas todavía. Sirven para cosas como «subir el aporte al fondo cuando salga la
          prima», «revisar la tasa de la Amex en marzo» o el cálculo que hicieron un domingo y no
          quieren repetir.
        </p>
      ) : (
        <div className={css.lista}>
          {ordenadas.map((n) => (
            <article key={n.id} className={`${css.nota} ${n.fijada ? css.fijada : ""}`}>
              <div className={css.cabeza}>
                <input
                  className={css.titulo}
                  aria-label="Título de la nota"
                  defaultValue={n.titulo}
                  placeholder="Sin título"
                  maxLength={120}
                  onBlur={(e) =>
                    e.target.value !== n.titulo &&
                    void editar("notas", n.id, { titulo: e.target.value })
                  }
                />
                <div className={css.acciones}>
                  <button
                    className={css.iconoBoton}
                    aria-pressed={n.fijada}
                    title={n.fijada ? "Quitar de arriba" : "Fijar arriba"}
                    aria-label={n.fijada ? "Quitar de arriba" : "Fijar arriba"}
                    onClick={() => void editar("notas", n.id, { fijada: !n.fijada })}
                  >
                    <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
                      <path
                        d="M9.5 1.5 14.5 6.5l-1.8.6-1.1 3.2-1.9-1.9-4 4-.7-.7 4-4-1.9-1.9 3.2-1.1z"
                        fill={n.fijada ? "currentColor" : "none"}
                        stroke="currentColor"
                        strokeWidth="1.2"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </button>
                  <button
                    className="borrar"
                    aria-label={`Eliminar ${n.titulo || "la nota"}`}
                    onClick={() => void borrar("notas", n.id)}
                  >
                    ×
                  </button>
                </div>
              </div>

              <textarea
                className={css.cuerpo}
                aria-label="Contenido de la nota"
                defaultValue={n.cuerpo}
                placeholder="Escribe aquí…"
                rows={Math.min(18, Math.max(4, n.cuerpo.split("\n").length + 1))}
                onBlur={(e) =>
                  e.target.value !== n.cuerpo &&
                  void editar("notas", n.id, { cuerpo: e.target.value })
                }
              />

              <p className={css.pie}>
                {n.autor && n.autor !== idA ? `${nombreDe(n.autor)} · ` : ""}
                editada {cuando(n.actualizada_en)}
              </p>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
