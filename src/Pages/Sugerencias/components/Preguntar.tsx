import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { useHogar } from "@/contexts/HogarContext";
import { useMoneda } from "@/hooks/useMoneda";
import { useCategorias } from "@/hooks/useCategorias";
import { useSalud } from "@/hooks/useSalud";
import { enMeses } from "@/lib/formato";
import { EJEMPLOS, responder, type Respuesta } from "@/lib/preguntas";
import { nivelActual, rutaDeMadurez } from "@/lib/salud";
import css from "../Sugerencias.module.css";

interface Turno {
  id: number;
  pregunta: string;
  respuesta: Respuesta | null;
}

/**
 * Preguntarle al oráculo con sus palabras. Responde con cálculos sobre sus
 * datos y, cuando aplica, abre la herramienta con los valores ya puestos.
 * La conversación vive solo en esta pantalla: no se guarda.
 */
export function Preguntar() {
  const { movimientos, gastos, deudas, metas, activos, hogar } = useHogar();
  const { $ } = useMoneda();
  const { etiqueta } = useCategorias();
  const { f, resumen, puntaje } = useSalud();
  const [texto, setTexto] = useState("");
  const [turnos, setTurnos] = useState<Turno[]>([]);
  const siguienteId = useRef(0);
  const fin = useRef<HTMLDivElement>(null);
  const temporizadores = useRef<number[]>([]);
  useEffect(() => () => temporizadores.current.forEach((t) => window.clearTimeout(t)), []);

  const nivel = useMemo(() => {
    const niveles = rutaDeMadurez({ f, p: resumen, deudas, activos, metas, $ });
    const n = nivelActual(niveles);
    return n <= niveles.length ? niveles[n - 1].titulo : null;
  }, [f, resumen, deudas, activos, metas, $]);

  const preguntar = (pregunta: string) => {
    const limpia = pregunta.trim();
    if (!limpia) return;
    const id = siguienteId.current++;
    setTurnos((t) => [...t.slice(-5), { id, pregunta: limpia, respuesta: null }]);
    setTexto("");
    // Un momento de "pensar": el cálculo es instantáneo, pero la pausa deja
    // ver que la respuesta es para esa pregunta.
    temporizadores.current.push(
      window.setTimeout(() => {
        const respuesta = responder(limpia, { f, movimientos, gastos, deudas, hogar, resumen, puntaje, nivel, etiqueta, $, meses: enMeses });
        setTurnos((t) => t.map((x) => (x.id === id ? { ...x, respuesta } : x)));
      }, 600),
    );
  };

  useEffect(() => {
    fin.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [turnos]);

  const enviar = (e: FormEvent) => {
    e.preventDefault();
    preguntar(texto);
  };

  return (
    <section className="panel">
      <header>
        <div>
          <h2>Pregúntenle al oráculo</h2>
          <p className="nota">
            Con sus palabras: si pueden gastar algo, cuánto llevan, cuándo salen de deudas, qué pasa
            si abonan, cuánto ahorrar para algo. Responde con sus números.
          </p>
        </div>
      </header>

      {turnos.length > 0 && (
        <div className={css.conversacion}>
          {turnos.map((t) => (
            <div key={t.id} className={css.turno}>
              <p className={css.pregunta}>{t.pregunta}</p>
              {t.respuesta === null ? (
                <p className={`${css.lectura} ${css.pensando}`}>Pensando</p>
              ) : (
                <article className={`${css.mensaje} ${css.respuesta}`} data-tipo={t.respuesta.entendida ? "consejo" : "tip"}>
                  <h3 className={css.titulo}>{t.respuesta.titulo}</h3>
                  {t.respuesta.lineas.map((l, i) => (
                    <p key={i} className={css.cuerpo}>
                      {l}
                    </p>
                  ))}
                  {!t.respuesta.entendida && (
                    <div className={css.ejemplos}>
                      {EJEMPLOS.map((ej) => (
                        <button key={ej} type="button" className={css.ejemplo} onClick={() => preguntar(ej)}>
                          {ej}
                        </button>
                      ))}
                    </div>
                  )}
                  {t.respuesta.ir && (
                    <div className={css.acciones}>
                      <Link className="pill" to={t.respuesta.ir.ruta}>
                        {t.respuesta.ir.texto} →
                      </Link>
                    </div>
                  )}
                </article>
              )}
            </div>
          ))}
          <div ref={fin} />
        </div>
      )}

      <form className={css.preguntaForm} onSubmit={enviar}>
        <input
          className="campo"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="Ej. ¿Podemos gastar 800 mil en un viaje?"
          aria-label="Pregunta para el oráculo"
        />
        <button type="submit" className="pill primaria" disabled={!texto.trim()}>
          Preguntar
        </button>
      </form>

      {turnos.length === 0 && (
        <div className={css.ejemplos}>
          {EJEMPLOS.map((ej) => (
            <button key={ej} type="button" className={css.ejemplo} onClick={() => preguntar(ej)}>
              {ej}
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
