import { useHogar } from "@/contexts/HogarContext";
import { useMoneda } from "@/hooks/useMoneda";
import { enMeses } from "@/lib/formato";
import { horizonteDeMetas, type Horizonte } from "@/lib/patrimonio";
import css from "../Patrimonio.module.css";

const GUIA: Record<Horizonte, { titulo: string; plazo: string; donde: string; por: string }> = {
  corto: {
    titulo: "Corto plazo",
    plazo: "Se usa en menos de un año, o es el colchón",
    donde: "Cuentas de ahorro de alto rendimiento o fondos de inversión colectiva a la vista.",
    por: "Lo que importa es que esté disponible el día que se necesite. Rendir un poco menos es el precio de no tener que vender en mal momento.",
  },
  medio: {
    titulo: "Mediano plazo",
    plazo: "De uno a cinco años",
    donde: "Renta fija: CDT (mejor en escalera) o fondos conservadores.",
    por: "Hay tiempo para ganar algo de rendimiento, pero no tanto como para aguantar una caída fuerte de la bolsa justo antes de usar la plata.",
  },
  largo: {
    titulo: "Largo plazo",
    plazo: "Más de cinco años",
    donde: "Crecimiento: fondos de acciones o ETF diversificados, pensión voluntaria.",
    por: "Con tiempo, las caídas se recuperan y el rendimiento de las acciones suele ganarle con holgura a la inflación.",
  },
};

/**
 * Cuándo se va a usar la plata decide dónde guardarla, más que cuánto
 * rinde. Cada meta cae en un plazo según lo que le falta y su aporte, y cada
 * plazo explica qué tipo de producto le corresponde y por qué. Tipos de
 * producto, nunca entidades: eso le toca a un asesor.
 */
export function PorHorizonte() {
  const { metas } = useHogar();
  const { $ } = useMoneda();
  const conHorizonte = horizonteDeMetas(metas);

  return (
    <section className="panel">
      <header>
        <div>
          <h2>Dónde guardar la plata de cada meta</h2>
          <p className="nota">
            No es lo mismo ahorrar para las vacaciones de diciembre que para la cuota inicial de
            una casa. Cada meta cae en un plazo según lo que le falta y lo que le aportan.
          </p>
        </div>
      </header>

      <div className={css.horizontes}>
        {(Object.keys(GUIA) as Horizonte[]).map((h) => {
          const g = GUIA[h];
          const aqui = conHorizonte.filter((m) => m.horizonte === h);
          return (
            <article key={h} className={`bordeViajero ${css.horizonte}`}>
              <span className="eyebrow">{g.plazo}</span>
              <h3 className={css.horizonteTitulo}>{g.titulo}</h3>
              <p className={css.donde}>{g.donde}</p>
              <p className={css.por}>{g.por}</p>
              <div className={css.metasHorizonte}>
                {aqui.length === 0 ? (
                  <span className={css.tipo}>Ninguna meta en este plazo</span>
                ) : (
                  aqui.map(({ meta, meses }) => (
                    <span key={meta.id} className={css.metaChip}>
                      <b>{meta.nombre || "Sin nombre"}</b>
                      <span className="num">
                        {$(Math.max(0, Number(meta.objetivo) - Number(meta.acumulado)))} ·{" "}
                        {meses === 0 ? "cumplida" : Number.isFinite(meses) ? enMeses(meses) : "sin aporte"}
                      </span>
                    </span>
                  ))
                )}
              </div>
            </article>
          );
        })}
      </div>
      <p className={css.pie}>
        Guía educativa por tipo de producto, no una recomendación de inversión. Antes de elegir una
        entidad o un fondo concreto, revisen sus costos y su perfil de riesgo, idealmente con un
        asesor financiero vigilado por la Superintendencia Financiera.
      </p>
    </section>
  );
}
