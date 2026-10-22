import { useMemo } from "react";
import { Estado } from "@/components/ui/Etiqueta";
import { useHogar } from "@/contexts/HogarContext";
import { useMoneda } from "@/hooks/useMoneda";
import { useSalud } from "@/hooks/useSalud";
import { nivelActual, rutaDeMadurez, textoPuntaje } from "@/lib/salud";
import { AnilloPuntaje } from "./components/AnilloPuntaje";
import { RutaNiveles } from "./components/RutaNiveles";
import { Lecciones } from "./components/Lecciones";
import css from "./Ruta.module.css";

/**
 * La ruta de madurez financiera: un puntaje para ver el conjunto, seis
 * niveles para saber cuál es el siguiente paso, y lecciones cortas donde el
 * ejemplo son sus propias cifras.
 */
export function Ruta() {
  const { deudas, activos, metas, hogar, cierres } = useHogar();
  const { $ } = useMoneda();
  const { f, resumen, puntaje } = useSalud();
  const inflacion = hogar?.inflacion_ref ? Number(hogar.inflacion_ref) : 5;

  const niveles = useMemo(
    () => rutaDeMadurez({ f, p: resumen, deudas, activos, metas, $ }),
    [f, resumen, deudas, activos, metas, $],
  );
  const actual = nivelActual(niveles);
  const estado = textoPuntaje(puntaje.total);

  const ultimoCierre = [...cierres]
    .filter((c) => c.puntaje !== null && c.puntaje !== undefined)
    .sort((a, b) => (a.periodo < b.periodo ? 1 : -1))[0];
  const cambio = ultimoCierre ? puntaje.total - Number(ultimoCierre.puntaje) : null;

  return (
    <>
      <section className="panel hero heroGrid">
        <div className={css.puntaje}>
          <AnilloPuntaje total={puntaje.total} />
          <div className="heroCifras">
            <span className="eyebrow">Salud financiera</span>
            <Estado tono={estado.tono}>{estado.texto}</Estado>
            <span className="heroDetalle">
              {actual <= niveles.length
                ? `Están en el nivel ${actual} de ${niveles.length}: ${niveles[actual - 1].titulo.toLowerCase()}.`
                : "Completaron los seis niveles de la ruta."}
            </span>
            {cambio !== null && (
              <span className="heroDetalle">
                {cambio === 0
                  ? "Igual que en el último cierre."
                  : `${cambio > 0 ? "+" : "−"}${Math.abs(cambio)} puntos desde el último cierre.`}
              </span>
            )}
          </div>
        </div>
        <div className="heroGrafico">
          <span className="eyebrow">De dónde salen los puntos</span>
          <ul className={css.partes}>
            {puntaje.partes.map((p, i) => (
              <li key={p.nombre} style={{ ["--i" as string]: String(i) }} title={p.detalle}>
                <span className={css.parteNombre}>{p.nombre}</span>
                <span className="barra" style={{ height: 9 }}>
                  <span className="fill" style={{ display: "block", width: `${(p.puntos / 20) * 100}%`, background: "var(--a)" }} />
                </span>
                <span className={`num ${css.partePuntos}`}>{Math.round(p.puntos)}/20</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="panel">
        <header>
          <div>
            <h2>La ruta</h2>
            <p className="nota">
              Seis niveles en el orden en que conviene recorrerlos. No hay que hacerlo todo a la
              vez: basta con saber cuál es el siguiente paso.
            </p>
          </div>
        </header>
        <RutaNiveles niveles={niveles} actual={actual} />
      </section>

      <section className="panel">
        <header>
          <div>
            <h2>Para entender mejor</h2>
            <p className="nota">
              Ideas cortas donde el ejemplo son ustedes. Las marcadas «para su nivel» son las que
              más sirven ahora.
            </p>
          </div>
        </header>
        <Lecciones f={f} actual={actual} inflacion={inflacion} />
      </section>
    </>
  );
}
