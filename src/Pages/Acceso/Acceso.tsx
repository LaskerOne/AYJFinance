import { useState, type FormEvent } from "react";
import { Navigate } from "react-router-dom";
import { useSesion } from "@/contexts/SesionContext";
import { mensajeDeError } from "@/services/supabase";
import { Cargando } from "@/components/ui/Cargando";
import css from "./Acceso.module.css";

type Estado = "formulario" | "enviando" | "enviado";

export function Acceso() {
  const { usuario, cargando, enviarEnlace } = useSesion();
  const [correo, setCorreo] = useState("");
  const [estado, setEstado] = useState<Estado>("formulario");
  const [error, setError] = useState("");

  if (cargando) return <Cargando mensaje="Verificando tu sesión" />;
  if (usuario) return <Navigate to="/" replace />;

  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setEstado("enviando");
    try {
      await enviarEnlace(correo);
      setEstado("enviado");
    } catch (err) {
      setError(mensajeDeError(err));
      setEstado("formulario");
    }
  };

  return (
    <div className={css.pantalla}>
      <div className={css.tarjeta}>
        <span className={css.logo} aria-hidden="true">CD</span>
        <h1 className={css.titulo}>Cuentas de Dos</h1>
        <p className={css.lema}>
          Las finanzas de la casa, en un solo tablero que los dos ven al mismo tiempo.
        </p>

        {estado === "enviado" ? (
          <div className={css.confirmacion}>
            <p className={css.exito}>Te enviamos un enlace a {correo}</p>
            <p className={css.ayuda}>
              Ábrelo desde este mismo dispositivo y entras directo, sin contraseña. El enlace
              vence en una hora y solo sirve una vez.
            </p>
            <button
              type="button"
              className="pill ghost"
              onClick={() => {
                setEstado("formulario");
                setError("");
              }}
            >
              Usar otro correo
            </button>
          </div>
        ) : (
          <form onSubmit={(e) => void enviar(e)} className={css.formulario}>
            <label className={css.etiqueta} htmlFor="correo">
              Tu correo
            </label>
            <input
              id="correo"
              className="campo"
              type="email"
              required
              autoComplete="email"
              placeholder="tucorreo@ejemplo.com"
              value={correo}
              onChange={(e) => setCorreo(e.target.value)}
              disabled={estado === "enviando"}
            />

            {error && <p className={css.error}>{error}</p>}

            <button
              type="submit"
              className="pill primaria"
              disabled={estado === "enviando" || correo.trim().length < 5}
            >
              {estado === "enviando" ? "Enviando…" : "Enviarme el enlace"}
            </button>

            <p className={css.ayuda}>
              No hay contraseñas. Te llega un enlace al correo y con eso entras. Si tu pareja ya
              te invitó, usa el mismo correo al que llegó la invitación y caerás directo en el
              hogar de los dos.
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
