import { NavLink, Outlet } from "react-router-dom";
import { useSesion } from "@/contexts/SesionContext";
import { useHogar } from "@/contexts/HogarContext";
import { Cargando } from "@/components/ui/Cargando";
import { MONEDAS } from "@/lib/formato";
import css from "./Layout.module.css";

const SECCIONES = [
  { ruta: "/", texto: "Resumen", exacta: true },
  { ruta: "/movimientos", texto: "Movimientos" },
  { ruta: "/presupuesto", texto: "Presupuesto" },
  { ruta: "/deudas", texto: "Deudas" },
  { ruta: "/metas", texto: "Metas" },
  { ruta: "/historico", texto: "Histórico" },
  { ruta: "/importar", texto: "Importar" },
  { ruta: "/ajustes", texto: "Ajustes" },
];

export function Layout() {
  const { salir, correo } = useSesion();
  const {
    hogar,
    cargando,
    error,
    errorEscritura,
    descartarErrorEscritura,
    enVivo,
    cambiarHogar,
    perfiles,
  } = useHogar();

  if (cargando) return <Cargando mensaje="Abriendo su hogar" />;

  if (error) {
    return (
      <div className={css.errorCaja}>
        <div className="panel">
          <h2>No se pudo abrir el hogar</h2>
          <p className="nota" style={{ marginTop: 8 }}>{error}</p>
          <button className="pill" style={{ marginTop: 16 }} onClick={() => void salir()}>
            Cerrar sesión y reintentar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={css.marco}>
      <header className={css.barra}>
        <div className={css.marca}>
          <span className={css.logo} aria-hidden="true">CD</span>
          <div>
            <h1 className={css.titulo}>{hogar?.nombre ?? "Cuentas de Dos"}</h1>
            <p className={css.sub}>
              {perfiles.length > 1
                ? perfiles.map((p) => p.nombre || p.correo.split("@")[0]).join(" y ")
                : "Invita a tu pareja desde Ajustes"}
            </p>
          </div>
        </div>

        <div className={css.acciones}>
          <span className={`${css.vivo} ${enVivo ? css.vivoOn : ""}`} title={enVivo ? "Cambios en vivo" : "Sin conexión en vivo"}>
            <span className={css.punto} />
            {enVivo ? "En vivo" : "Sin conexión"}
          </span>

          <select
            className="pill"
            aria-label="Moneda"
            value={hogar?.moneda ?? "COP"}
            onChange={(e) => void cambiarHogar({ moneda: e.target.value })}
          >
            {MONEDAS.map((m) => (
              <option key={m.codigo} value={m.codigo}>
                {m.etiqueta}
              </option>
            ))}
          </select>

          <button className="pill ghost" onClick={() => void salir()} title={correo}>
            Salir
          </button>
        </div>
      </header>

      <nav className={css.nav} aria-label="Secciones">
        {SECCIONES.map((s) => (
          <NavLink
            key={s.ruta}
            to={s.ruta}
            end={s.exacta}
            className={({ isActive }) => `${css.enlace} ${isActive ? css.activo : ""}`}
          >
            {s.texto}
          </NavLink>
        ))}
      </nav>

      {errorEscritura && (
        <div className={css.avisoError} role="alert">
          <div>
            <strong>No se pudo guardar el cambio.</strong>
            <p className={css.detalleError}>{errorEscritura}</p>
          </div>
          <button className="pill" onClick={descartarErrorEscritura}>
            Entendido
          </button>
        </div>
      )}

      <main className={css.contenido}>
        <Outlet />
      </main>
    </div>
  );
}
