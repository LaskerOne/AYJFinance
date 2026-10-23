import { useLocation } from "react-router-dom";
import { useHogar } from "@/contexts/HogarContext";
import { useFinanzas } from "@/hooks/useFinanzas";
import { useMoneda } from "@/hooks/useMoneda";
import css from "./Layout.module.css";

function saludoDeLaHora(hora: number): string {
  if (hora < 12) return "Buenos días";
  if (hora < 19) return "Buenas tardes";
  return "Buenas noches";
}

function fechaLarga(d: Date): string {
  const texto = d.toLocaleDateString("es-CO", { weekday: "long", day: "numeric", month: "long" }).replace(",", "");
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

/**
 * El encabezado de la pareja: los dos, la fecha y cuánto les queda libre.
 * Reemplaza el molde de «etiqueta + título» de las herramientas de oficina por
 * algo que diga de quién es esta app. En el Resumen no repite lo libre,
 * porque ahí es la cifra grande.
 */
export function Saludo() {
  const { idA, idB, nombreDe } = useHogar();
  const { disponible } = useFinanzas();
  const { $ } = useMoneda();
  const { pathname } = useLocation();

  const ahora = new Date();
  const nombres = [idA, idB].filter((id): id is string => id !== null).map(nombreDe);

  return (
    <div className={css.saludo}>
      <span className={css.duo} aria-hidden="true">
        {nombres.map((n, i) => (
          <span key={n + i} className={css.avatar} data-lado={i === 0 ? "a" : "b"}>
            {n.charAt(0).toUpperCase()}
          </span>
        ))}
      </span>
      <div className={css.saludoTexto}>
        <p className={css.saludoTitulo}>
          {saludoDeLaHora(ahora.getHours())}, {nombres.join(" y ")}
        </p>
        <p className={css.saludoSub}>
          {fechaLarga(ahora)}
          {pathname !== "/" && (
            <>
              {" · "}
              {disponible >= 0 ? "les quedan " : "van "}
              <b className={disponible >= 0 ? css.libre : css.faltante}>{$(Math.abs(disponible))}</b>
              {disponible >= 0 ? " libres este mes" : " por encima este mes"}
            </>
          )}
        </p>
      </div>
    </div>
  );
}
