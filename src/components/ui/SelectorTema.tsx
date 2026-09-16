import { useTema, type Tema } from "@/hooks/useTema";
import css from "./SelectorTema.module.css";

const OPCIONES: Array<{ valor: Tema; titulo: string; icono: JSX.Element }> = [
  {
    valor: "sistema",
    titulo: "Seguir al sistema",
    icono: (
      <svg viewBox="0 0 16 16" width="15" height="15" aria-hidden="true">
        <circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" strokeWidth="1.5" />
        <path d="M8 2a6 6 0 0 0 0 12z" fill="currentColor" />
      </svg>
    ),
  },
  {
    valor: "claro",
    titulo: "Tema claro",
    icono: (
      <svg viewBox="0 0 16 16" width="15" height="15" aria-hidden="true">
        <circle cx="8" cy="8" r="3.2" fill="currentColor" />
        <g stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
          <path d="M8 1v1.6M8 13.4V15M15 8h-1.6M2.6 8H1M12.9 3.1l-1.1 1.1M4.2 11.8l-1.1 1.1M12.9 12.9l-1.1-1.1M4.2 4.2L3.1 3.1" />
        </g>
      </svg>
    ),
  },
  {
    valor: "oscuro",
    titulo: "Tema oscuro",
    icono: (
      <svg viewBox="0 0 16 16" width="15" height="15" aria-hidden="true">
        <path
          d="M13.4 10.2A5.6 5.6 0 0 1 6 2.7a5.8 5.8 0 1 0 7.4 7.5z"
          fill="currentColor"
        />
      </svg>
    ),
  },
];

/** Claro, oscuro o lo que diga el sistema. La preferencia vive en este
 *  navegador: cada uno la elige sin afectar a la otra persona. */
export function SelectorTema() {
  const { tema, setTema } = useTema();

  return (
    <div className={css.grupo} role="group" aria-label="Tema de la aplicación">
      {OPCIONES.map((o) => (
        <button
          key={o.valor}
          type="button"
          className={css.boton}
          aria-pressed={tema === o.valor}
          aria-label={o.titulo}
          title={o.titulo}
          onClick={() => setTema(o.valor)}
        >
          {o.icono}
        </button>
      ))}
    </div>
  );
}
