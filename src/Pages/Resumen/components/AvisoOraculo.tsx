import { Link } from "react-router-dom";
import { useUrgentes } from "@/components/layout/ContadorOraculo";
import css from "../Resumen.module.css";

/**
 * El oráculo levanta la mano en el Resumen cuando tiene algo urgente sin
 * atender. Una sola línea: lo más importante y cuántas cosas más hay.
 */
export function AvisoOraculo() {
  const urgentes = useUrgentes();
  if (urgentes.length === 0) return null;
  const primero = urgentes[0];
  return (
    <Link to="/sugerencias" className={css.avisoOraculo} data-tono={primero.tono}>
      <span className={css.avisoQuien}>El oráculo</span>
      <span className={css.avisoTexto}>
        {primero.titulo}
        {urgentes.length > 1 && <span className={css.avisoMas}> · y {urgentes.length - 1} más</span>}
      </span>
      <span className={css.avisoIr} aria-hidden="true">
        →
      </span>
    </Link>
  );
}
