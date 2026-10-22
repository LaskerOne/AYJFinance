import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Estado } from "@/components/ui/Etiqueta";
import { useHogar } from "@/contexts/HogarContext";
import { guardarDescartados, leerDescartados, mesLocal, useOraculo } from "@/hooks/useOraculo";
import { intercalar, type Mensaje } from "@/lib/oraculo";
import { AccionConsejo } from "./AccionConsejo";
import { Preguntar } from "./Preguntar";
import { Decisiones } from "@/Pages/Reunion/components/Decisiones";
import { Teseracto } from "./Teseracto";
import css from "../Sugerencias.module.css";

type Filtro = "todo" | "consejo" | "tip";

const CLAVE_VISTOS = "cuentas-de-dos:oraculo-vistos";

function leerSet(clave: string): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(clave) ?? "[]") as string[]);
  } catch {
    return new Set();
  }
}
function guardarSet(clave: string, valor: Set<string>) {
  try {
    localStorage.setItem(clave, JSON.stringify([...valor]));
  } catch {
    // Sin almacenamiento la memoria dura solo esta visita.
  }
}


/**
 * El oráculo: lee todo lo registrado, piensa y entrega de a un mensaje por
 * clic. Los consejos (borde naranja) dicen qué hacer y se pueden adoptar como
 * decisión del mes; los tips (borde violeta) enseñan algo útil para su
 * situación. Recuerda en este navegador qué tips ya vieron y qué consejos
 * descartaron este mes, para no repetirse.
 */
export function Oraculo() {
  const { decisiones, crear } = useHogar();
  const analisis = useOraculo();
  const mes = mesLocal();

  const [vistos, setVistos] = useState(() => leerSet(CLAVE_VISTOS));
  const [descartados, setDescartados] = useState(() => leerDescartados(mes));
  const [filtro, setFiltro] = useState<Filtro>("todo");
  const [indice, setIndice] = useState(0);
  const [pensando, setPensando] = useState(false);
  const temporizador = useRef<number>();
  useEffect(() => () => window.clearTimeout(temporizador.current), []);

  const adoptados = new Set(decisiones.filter((d) => d.periodo.startsWith(mes) && d.origen).map((d) => d.origen));
  const consejos = analisis.consejos.filter((c) => !descartados.has(c.id));
  // Los tips no vistos van primero; los vistos siguen disponibles al final.
  const tips = [...analisis.tips].sort((a, b) => Number(vistos.has(a.id)) - Number(vistos.has(b.id)));
  const feed = filtro === "consejo" ? consejos : filtro === "tip" ? tips : intercalar(consejos, tips);
  const actual: Mensaje | null = feed.length > 0 ? feed[indice % feed.length] : null;

  const siguiente = () => {
    setPensando(true);
    window.clearTimeout(temporizador.current);
    temporizador.current = window.setTimeout(() => {
      setIndice((i) => i + 1);
      setPensando(false);
    }, 650);
  };

  const marcarVisto = (id: string) => {
    const nuevo = new Set(vistos).add(id);
    setVistos(nuevo);
    guardarSet(CLAVE_VISTOS, nuevo);
    siguiente();
  };
  const descartar = (id: string) => {
    const nuevo = new Set(descartados).add(id);
    setDescartados(nuevo);
    guardarDescartados(nuevo, mes);
  };
  const recuperarDescartados = () => {
    setDescartados(new Set());
    guardarDescartados(new Set(), mes);
  };
  const adoptar = (m: Mensaje) =>
    crear("decisiones", {
      periodo: `${mes}-01`,
      texto: m.titulo,
      responsable: null,
      cumplida: false,
      origen: m.id,
      orden: decisiones.filter((d) => d.periodo.startsWith(mes)).length + 1,
    });

  const delMes = decisiones.filter((d) => d.periodo.startsWith(mes));
  const l = analisis.lectura;

  const Tarjeta = ({ m, compacta = false }: { m: Mensaje; compacta?: boolean }) => (
    <article className={`${css.mensaje} ${compacta ? css.compacta : ""}`} data-tipo={m.tipo}>
      <div className={css.mensajeCabeza}>
        <span className={css.insignia} data-tipo={m.tipo}>
          {m.tipo === "consejo" ? "Consejo" : "Para aprender"}
        </span>
        <span className={css.fuente}>{m.fuente}</span>
        {m.impacto && m.tipo === "consejo" && <Estado tono={m.tono}>{m.impacto}</Estado>}
      </div>
      <h3 className={css.titulo}>{m.titulo}</h3>
      <p className={css.cuerpo}>{m.cuerpo}</p>
      {!compacta && m.comoSeCalcula && <p className={css.calculo}>{m.comoSeCalcula}</p>}
      {m.tipo === "consejo" && m.accion && <AccionConsejo accion={m.accion} />}
      <div className={css.acciones}>
        {m.tipo === "consejo" &&
          (adoptados.has(m.id) ? (
            <span className={css.adoptado}>✓ Adoptado como decisión</span>
          ) : (
            <button className="pill primaria" onClick={() => void adoptar(m)}>
              Adoptar como decisión
            </button>
          ))}
        {m.ir && (
          <Link className="pill" to={m.ir.ruta}>
            {m.ir.texto} →
          </Link>
        )}
        {m.tipo === "tip" && !compacta && (
          <button className="pill ghost" onClick={() => marcarVisto(m.id)}>
            {vistos.has(m.id) ? "Ya lo había visto" : "Entendido"}
          </button>
        )}
        {m.tipo === "consejo" && !adoptados.has(m.id) && (
          <button className="pill ghost" onClick={() => descartar(m.id)}>
            Ya lo tengo en cuenta
          </button>
        )}
      </div>
    </article>
  );

  return (
    <>
      <section className="panel hero">
        <header>
          <div>
            <h2>El oráculo de la casa</h2>
            <p className="nota">
              Lee todo lo que tienen registrado y les dice qué conviene hacer y qué vale la pena
              entender. Tóquenle el teseracto: piensa y trae lo siguiente.
            </p>
          </div>
          <div className="segmentado" role="group" aria-label="Qué mostrar">
            {(
              [
                ["todo", "Todo"],
                ["consejo", `Consejos · ${consejos.length}`],
                ["tip", `Para aprender · ${tips.length}`],
              ] as const
            ).map(([valor, texto]) => (
              <button
                key={valor}
                type="button"
                aria-pressed={filtro === valor}
                onClick={() => {
                  setFiltro(valor);
                  setIndice(0);
                }}
              >
                {texto}
              </button>
            ))}
          </div>
        </header>

        <div className={css.oraculo}>
          <div className={css.oraculoIzq}>
            <Teseracto onClic={siguiente} etiqueta="Mostrar el siguiente mensaje" />
            <p className={css.lectura} aria-live="polite">
              {pensando ? (
                <span className={css.pensando}>Pensando</span>
              ) : (
                <>
                  Leí {l.movimientos} movimientos{l.meses > 1 ? ` de ${l.meses} meses` : ""}, {l.deudas}{" "}
                  {l.deudas === 1 ? "deuda" : "deudas"}, {l.metas} {l.metas === 1 ? "meta" : "metas"} y {l.activos}{" "}
                  {l.activos === 1 ? "activo" : "activos"}.
                </>
              )}
            </p>
          </div>

          <div className={css.consejoCaja}>
            {actual ? (
              <div key={`${actual.id}-${indice}`} className={pensando ? css.saliendo : css.consejoVivo}>
                <span className="eyebrow">
                  {(indice % feed.length) + 1} de {feed.length}
                </span>
                <Tarjeta m={actual} />
              </div>
            ) : (
              <p className="vacio">
                {filtro === "consejo"
                  ? "No hay consejos pendientes este mes. Buen trabajo."
                  : "Nada que mostrar por ahora. Cuando registren más datos, tendré algo que decir."}
              </p>
            )}
            {descartados.size > 0 && (
              <button className={css.enlaceTexto} onClick={recuperarDescartados}>
                {descartados.size} {descartados.size === 1 ? "consejo descartado" : "consejos descartados"} este
                mes · volver a mostrarlos
              </button>
            )}
          </div>
        </div>
      </section>

      <Preguntar />

      <section className="panel">
        <header>
          <div>
            <h2>Su plan del mes</h2>
            <p className="nota">
              Lo que adoptaron del oráculo y lo que acordaron en la reunión. Márquenlo cuando lo
              cumplan.
            </p>
          </div>
          <Link className="pill" to="/reunion">
            Ir a la reunión →
          </Link>
        </header>
        {delMes.length === 0 ? (
          <p className="vacio">
            Todavía no hay nada en el plan de este mes. Adopten un consejo y aparecerá aquí.
          </p>
        ) : (
          <Decisiones lista={delMes} />
        )}
      </section>

      <details className={`panel ${css.todas}`}>
        <summary className={css.todasCabeza}>
          <span className={css.todasFlecha} aria-hidden="true">
            ▸
          </span>
          Todo lo que encontré · {consejos.length} consejos y {tips.length} ideas para aprender
        </summary>
        <div className={css.columnas}>
          <div className={css.columna}>
            <span className="eyebrow">Consejos</span>
            {consejos.map((m) => (
              <Tarjeta key={m.id} m={m} compacta />
            ))}
          </div>
          <div className={css.columna}>
            <span className="eyebrow">Para aprender</span>
            {tips.map((m) => (
              <Tarjeta key={m.id} m={m} compacta />
            ))}
          </div>
        </div>
      </details>
    </>
  );
}
