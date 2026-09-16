import { useCallback, useRef, useState, type MouseEvent, type ReactNode } from "react";
import css from "./charts.module.css";

interface Tip {
  x: number;
  y: number;
  titulo: string;
  detalle: string;
}

/**
 * Capa de hover compartida por todos los gráficos.
 * Un gráfico en pantalla que no responde al puntero desperdicia la mitad de
 * lo que puede contar, así que esto va por defecto, no como extra.
 */
export function useTooltip() {
  const contenedor = useRef<HTMLDivElement>(null);
  const [tip, setTip] = useState<Tip | null>(null);

  const mostrar = useCallback((e: MouseEvent, titulo: string, detalle: string) => {
    const caja = contenedor.current?.getBoundingClientRect();
    if (!caja) return;
    setTip({ x: e.clientX - caja.left, y: e.clientY - caja.top, titulo, detalle });
  }, []);

  const ocultar = useCallback(() => setTip(null), []);

  const nodo: ReactNode = tip ? (
    <div className={css.tip} style={{ left: `${tip.x}px`, top: `${tip.y}px` }} role="tooltip">
      <span className={css.tipTitulo}>{tip.titulo}</span>
      <span className={css.tipDetalle}>{tip.detalle}</span>
    </div>
  ) : null;

  return { contenedor, mostrar, ocultar, nodo };
}
