import { BarraProgreso } from "@/components/charts/BarraProgreso";
import { useMoneda } from "@/hooks/useMoneda";
import { porcentaje } from "@/lib/formato";
import { COLOR_CATEGORIA, type Categoria } from "@/models/dominio";
import css from "../Movimientos.module.css";

export interface LineaComparativa {
  categoria: Categoria;
  presupuesto: number;
  ejecutado: number;
}

/**
 * Presupuestado contra ejecutado, categoría por categoría.
 * La marca al 100 % es el presupuesto; la barra que la pasa está en rojo,
 * porque ahí es donde de verdad hay que mirar.
 */
export function ComparativaPresupuesto({ lineas }: { lineas: LineaComparativa[] }) {
  const { $ } = useMoneda();

  if (lineas.length === 0) {
    return <p className="vacio">Registra movimientos del mes para comparar contra el presupuesto.</p>;
  }

  return (
    <div className={css.comparativa}>
      {lineas.map((l) => {
        const avance = l.presupuesto > 0 ? l.ejecutado / l.presupuesto : l.ejecutado > 0 ? 1.5 : 0;
        const excedido = l.presupuesto > 0 && l.ejecutado > l.presupuesto;
        const diferencia = l.ejecutado - l.presupuesto;

        return (
          <div key={l.categoria} className={css.filaComparativa}>
            <span className={css.catNombre}>
              <span
                className={css.puntoCat}
                style={{ background: `var(${COLOR_CATEGORIA[l.categoria]})` }}
              />
              {l.categoria}
            </span>

            <BarraProgreso
              fraccion={Math.min(avance, 1)}
              color={excedido ? "--crit" : avance > 0.85 ? "--warn" : "--ok"}
              marca={l.presupuesto > 0 ? 1 : undefined}
              tituloMarca="Presupuesto"
              alto={10}
              etiqueta={`${l.categoria}: ${$(l.ejecutado)} de ${$(l.presupuesto)}`}
            />

            <span className={css.cifrasComparativa}>
              <b className="num">{$(l.ejecutado)}</b>
              <span className="num"> / {$(l.presupuesto)}</span>
            </span>

            <span
              className={`${css.desviacion} ${excedido ? css.malo : css.bueno}`}
              title={
                l.presupuesto > 0
                  ? `${porcentaje(l.ejecutado / l.presupuesto)} del presupuesto`
                  : "Sin presupuesto asignado"
              }
            >
              {diferencia >= 0 ? "+" : "−"}
              {$(Math.abs(diferencia)).replace("−", "")}
            </span>
          </div>
        );
      })}
    </div>
  );
}
