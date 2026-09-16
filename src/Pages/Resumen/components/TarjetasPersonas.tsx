import { Link } from "react-router-dom";
import { useHogar } from "@/contexts/HogarContext";
import { useMoneda } from "@/hooks/useMoneda";
import { porcentajeEntero } from "@/lib/formato";
import type { Finanzas } from "@/lib/calculos";
import css from "../Resumen.module.css";

function inicial(nombre: string): string {
  return (nombre.trim()[0] ?? "?").toUpperCase();
}

/** Las dos personas del hogar, con su ingreso y su peso en el total.
 *  Cuando todavía hay una sola, el hueco invita en vez de quedar vacío. */
export function TarjetasPersonas({ finanzas }: { finanzas: Finanzas }) {
  const { perfiles, idA, nombreDe } = useHogar();
  const { $ } = useMoneda();

  const yo = perfiles.find((p) => p.id === idA);
  const pareja = perfiles.find((p) => p.id !== idA);

  const tarjeta = (
    lado: "a" | "b",
    nombre: string,
    ingreso: number,
    participacion: number,
  ) => (
    <div className={css.persona} data-lado={lado}>
      <span className={css.avatar} aria-hidden="true">{inicial(nombre)}</span>
      <span className={css.datosPersona}>
        <span className={css.nombrePersona}>{nombre}</span>
        <span className={css.ingresoPersona}>
          Ingreso mensual <b className="num">{$(ingreso)}</b>
        </span>
      </span>
      <span className={css.pesoPersona}>
        <span className="eyebrow">del ingreso</span>
        <span className={css.pesoValor}>{porcentajeEntero(participacion)}</span>
      </span>
    </div>
  );

  return (
    <section className={css.pareja}>
      {tarjeta("a", yo ? nombreDe(yo.id) : "Tú", finanzas.ingresoA, finanzas.participacionA)}

      {pareja ? (
        tarjeta("b", nombreDe(pareja.id), finanzas.ingresoB, finanzas.participacionB)
      ) : (
        <Link to="/ajustes" className={css.invitacion}>
          <span className={css.avatarVacio} aria-hidden="true">+</span>
          <span>
            <span className={css.nombrePersona}>Invita a tu pareja</span>
            <span className={css.ingresoPersona}>
              Con su correo entra al mismo tablero y todo se sincroniza en vivo.
            </span>
          </span>
        </Link>
      )}
    </section>
  );
}
