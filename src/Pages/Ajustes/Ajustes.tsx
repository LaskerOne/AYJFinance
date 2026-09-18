import { useEffect, useState, type FormEvent } from "react";
import { Estado } from "@/components/ui/Etiqueta";
import { useHogar } from "@/contexts/HogarContext";
import { useSesion } from "@/contexts/SesionContext";
import {
  cancelarInvitacion,
  invitacionesDe,
  invitar,
  renombrarPerfil,
} from "@/services/hogar.service";
import { mensajeDeError } from "@/services/supabase";
import { MONEDAS } from "@/lib/formato";
import { useCategorias } from "@/hooks/useCategorias";
import { COLOR_CATEGORIA } from "@/models/dominio";
import type { Invitacion } from "@/models/dominio";
import css from "./Ajustes.module.css";

export function Ajustes() {
  const { hogar, perfiles, idA, cambiarHogar, reglas, borrar } = useHogar();
  const { usuario, correo, salir } = useSesion();
  const { opciones, renombrar, restaurar, hayRenombradas } = useCategorias();

  const [invitaciones, setInvitaciones] = useState<Invitacion[]>([]);
  const [correoInvitado, setCorreoInvitado] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [error, setError] = useState("");

  const yo = perfiles.find((p) => p.id === idA);
  const pareja = perfiles.find((p) => p.id !== idA);

  useEffect(() => {
    if (!hogar) return;
    void invitacionesDe(hogar.id).then(setInvitaciones).catch(() => setInvitaciones([]));
  }, [hogar, perfiles]);

  const enviarInvitacion = async (e: FormEvent) => {
    e.preventDefault();
    if (!hogar || !usuario) return;
    setError("");
    setMensaje("");
    try {
      await invitar(hogar.id, correoInvitado, usuario.id);
      setInvitaciones(await invitacionesDe(hogar.id));
      setMensaje(
        `Listo. Dile a ${correoInvitado.trim()} que entre a esta misma dirección y pida su enlace con ese correo: caerá directo en este hogar.`,
      );
      setCorreoInvitado("");
    } catch (err) {
      setError(mensajeDeError(err));
    }
  };

  return (
    <>
      <section className="panel">
        <header>
          <div>
            <h2>El hogar</h2>
            <p className="nota">Cómo se llama y en qué moneda llevan las cuentas.</p>
          </div>
        </header>

        <div className={css.rejilla}>
          <label className={css.campo}>
            <span className="eyebrow">Nombre del hogar</span>
            <input
              className="campo"
              defaultValue={hogar?.nombre ?? ""}
              onBlur={(e) => {
                if (e.target.value.trim() && e.target.value !== hogar?.nombre) {
                  void cambiarHogar({ nombre: e.target.value.trim() });
                }
              }}
            />
          </label>

          <label className={css.campo}>
            <span className="eyebrow">Moneda</span>
            <select
              className="campo"
              value={hogar?.moneda ?? "COP"}
              onChange={(e) => void cambiarHogar({ moneda: e.target.value })}
            >
              {MONEDAS.map((m) => (
                <option key={m.codigo} value={m.codigo}>
                  {m.etiqueta}
                </option>
              ))}
            </select>
          </label>

          <label className={css.campo}>
            <span className="eyebrow">Tu nombre</span>
            <input
              className="campo"
              defaultValue={yo?.nombre ?? ""}
              placeholder={correo.split("@")[0]}
              onBlur={(e) => {
                if (usuario && e.target.value.trim() && e.target.value !== yo?.nombre) {
                  void renombrarPerfil(usuario.id, e.target.value.trim());
                }
              }}
            />
          </label>
        </div>
      </section>

      <section className="panel">
        <header>
          <div>
            <h2>Quiénes entran</h2>
            <p className="nota">
              Este tablero está pensado para dos. Quien entre ve y edita todo: no hay cuentas
              separadas ni secretos.
            </p>
          </div>
        </header>

        <div className={css.miembros}>
          <div className={css.miembro} data-lado="a">
            <span className={css.avatar}>{(yo?.nombre || correo)[0]?.toUpperCase()}</span>
            <span>
              <span className={css.nombreMiembro}>{yo?.nombre || correo.split("@")[0]}</span>
              <span className={css.correoMiembro}>{correo}</span>
            </span>
            <Estado tono="ok">Tú</Estado>
          </div>

          {pareja ? (
            <div className={css.miembro} data-lado="b">
              <span className={css.avatar}>{(pareja.nombre || pareja.correo)[0]?.toUpperCase()}</span>
              <span>
                <span className={css.nombreMiembro}>
                  {pareja.nombre || pareja.correo.split("@")[0]}
                </span>
                <span className={css.correoMiembro}>{pareja.correo}</span>
              </span>
              <Estado tono="ok">Conectada</Estado>
            </div>
          ) : (
            <form className={css.invitar} onSubmit={(e) => void enviarInvitacion(e)}>
              <label className={css.campo}>
                <span className="eyebrow">Correo de tu pareja</span>
                <input
                  className="campo"
                  type="email"
                  required
                  placeholder="supareja@ejemplo.com"
                  value={correoInvitado}
                  onChange={(e) => setCorreoInvitado(e.target.value)}
                />
              </label>
              <button type="submit" className="pill primaria" disabled={correoInvitado.length < 5}>
                Autorizar acceso
              </button>
            </form>
          )}
        </div>

        {mensaje && <p className={css.exito}>{mensaje}</p>}
        {error && <p className={css.error}>{error}</p>}

        {invitaciones.length > 0 && !pareja && (
          <div className={css.pendientes}>
            <span className="eyebrow">Invitaciones activas</span>
            {invitaciones.map((i) => (
              <div key={i.id} className={css.pendiente}>
                <span className="num">{i.correo}</span>
                <button
                  className="pill ghost"
                  onClick={() =>
                    void cancelarInvitacion(i.id).then(async () => {
                      if (hogar) setInvitaciones(await invitacionesDe(hogar.id));
                    })
                  }
                >
                  Revocar
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="panel">
        <header>
          <div>
            <h2>Nombres de las categorías</h2>
            <p className="nota">
              Llámenlas como las llaman ustedes. Cambiar el nombre no mueve ningún gasto: lo que
              queda guardado por dentro es siempre la misma categoría, así que nada se pierde.
            </p>
          </div>
          {hayRenombradas && (
            <button className="pill ghost" onClick={() => void restaurar()}>
              Volver a los nombres originales
            </button>
          )}
        </header>

        <div className={css.categorias}>
          {opciones.map((o) => (
            <label key={o.clave} className={css.categoria}>
              <span
                className={css.puntoCategoria}
                style={{ background: `var(${COLOR_CATEGORIA[o.clave]})` }}
                aria-hidden="true"
              />
              <span className={css.claveCategoria}>{o.clave}</span>
              <input
                className="campo"
                aria-label={`Nombre visible de ${o.clave}`}
                defaultValue={o.nombre === o.clave ? "" : o.nombre}
                placeholder={o.clave}
                maxLength={40}
                key={`${o.clave}-${o.nombre}`}
                onBlur={(e) => {
                  if (e.target.value.trim() !== (o.nombre === o.clave ? "" : o.nombre)) {
                    void renombrar(o.clave, e.target.value);
                  }
                }}
              />
            </label>
          ))}
        </div>

        <p className={css.pistaCategorias}>
          El color de cada una es fijo: son nueve tonos verificados para que se distingan entre sí
          también con daltonismo y sobre fondo claro u oscuro. Deja el campo en blanco para volver
          al nombre de fábrica.
        </p>
      </section>

      {reglas.length > 0 && (
        <section className="panel">
          <header>
            <div>
              <h2>Reglas de categorización</h2>
              <p className="nota">
                Aprendidas de tus correcciones al importar extractos. Bórralas si alguna quedó mal.
              </p>
            </div>
          </header>

          <div className="tablaScroll">
            <table className="datos">
              <thead>
                <tr>
                  <th>Cuando el concepto contiene</th>
                  <th>Se clasifica como</th>
                  <th className="r">Aplicada</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {reglas.map((r) => (
                  <tr key={r.id}>
                    <td className="num">{r.patron}</td>
                    <td>{r.categoria}</td>
                    <td className="r num">{r.veces}</td>
                    <td>
                      <button
                        className="borrar"
                        aria-label={`Eliminar regla ${r.patron}`}
                        onClick={() => void borrar("reglas_categoria", r.id)}
                      >
                        ×
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section className="panel">
        <header>
          <div>
            <h2>Tu sesión</h2>
            <p className="nota">
              Entraste con {correo}. No hay contraseña que cambiar: cada acceso usa un enlace nuevo.
            </p>
          </div>
        </header>
        <button className="pill" onClick={() => void salir()}>
          Cerrar sesión
        </button>
      </section>
    </>
  );
}
