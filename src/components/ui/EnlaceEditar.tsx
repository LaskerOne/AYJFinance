import { Link } from "react-router-dom";
import css from "./EnlaceEditar.module.css";

/**
 * Señal para los bloques de solo lectura: dice a dónde ir a cambiar los
 * números que se están mostrando. Sin esto, una tabla de cifras invita a
 * hacer clic encima y no responde, que es la peor forma de decir "aquí no".
 */
export function EnlaceEditar({ a, texto }: { a: string; texto: string }) {
  return (
    <Link to={a} className={css.enlace}>
      {texto}
      <span aria-hidden="true" className={css.flecha}>
        →
      </span>
    </Link>
  );
}
