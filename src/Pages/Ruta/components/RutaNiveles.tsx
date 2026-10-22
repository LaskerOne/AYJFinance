import type { Nivel } from "@/lib/salud";
import css from "../Ruta.module.css";

/**
 * Seis niveles en orden. Los logrados quedan atrás con su chulo, el actual
 * brilla con lo que falta y el siguiente paso, y los que vienen se ven
 * tenues: lo importante es saber cuál es el próximo, no hacerlo todo ya.
 */
export function RutaNiveles({ niveles, actual }: { niveles: Nivel[]; actual: number }) {
  return (
    <ol className={css.ruta}>
      {niveles.map((nv) => {
        const estado = nv.logrado ? "logrado" : nv.n === actual ? "actual" : "futuro";
        return (
          <li key={nv.n} className={css.nivel} data-estado={estado} style={{ ["--i" as string]: String(nv.n) }}>
            <span className={css.nivelNumero} aria-hidden="true">
              {nv.logrado ? "✓" : nv.n}
            </span>
            <div className={css.nivelCuerpo}>
              <div className={css.nivelCabeza}>
                <h3 className={css.nivelTitulo}>{nv.titulo}</h3>
                <span className={css.nivelEtiqueta}>
                  {estado === "logrado" ? "Logrado" : estado === "actual" ? "Están aquí" : "Después"}
                </span>
              </div>
              <p className={css.nivelEstado}>{nv.estado}</p>
              {!nv.logrado && (
                <div className="barra" style={{ height: 8 }} aria-hidden="true">
                  <div className="fill" style={{ width: `${nv.progreso * 100}%`, background: "var(--a)" }} />
                </div>
              )}
              {estado === "actual" && (
                <>
                  <p className={css.nivelPorque}>{nv.porque}</p>
                  <p className={css.nivelSiguiente}>
                    <b>Siguiente paso:</b> {nv.siguiente}
                  </p>
                </>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
