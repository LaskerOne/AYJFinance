interface Props {
  fraccion: number;
  color?: string;
  /** Posición 0–1 de la marca de objetivo, si aplica. */
  marca?: number;
  tituloMarca?: string;
  alto?: number;
  etiqueta: string;
}

/** Barra de avance con marca de objetivo opcional. */
export function BarraProgreso({
  fraccion,
  color = "--a",
  marca,
  tituloMarca,
  alto = 12,
  etiqueta,
}: Props) {
  const ancho = Math.max(0, Math.min(1, fraccion)) * 100;
  return (
    <div
      className="barra"
      style={{ height: `${alto}px` }}
      role="progressbar"
      aria-label={etiqueta}
      aria-valuenow={Math.round(fraccion * 100)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div className="fill" style={{ width: `${ancho.toFixed(2)}%`, background: `var(${color})` }} />
      {marca !== undefined && (
        <span className="marca" style={{ left: `${(marca * 100).toFixed(1)}%` }} title={tituloMarca} />
      )}
    </div>
  );
}
