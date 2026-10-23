import { useState, type CSSProperties } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { useSesion } from "@/contexts/SesionContext";
import { useHogar } from "@/contexts/HogarContext";
import { Cargando } from "@/components/ui/Cargando";
import { SelectorTema } from "@/components/ui/SelectorTema";
import { Icono, type NombreIcono } from "@/components/ui/Icono";
import { useMoneda } from "@/hooks/useMoneda";
import { ContadorOraculo } from "./ContadorOraculo";
import { Saludo } from "./Saludo";
import { MONEDAS, moneda as fmtMoneda } from "@/lib/formato";
import css from "./Layout.module.css";

type Seccion = { ruta: string; texto: string; icono: NombreIcono; exacta?: boolean; contador?: boolean };

/** Las secciones agrupadas por para qué sirven, en el orden en que se usan. */
const GRUPOS: { titulo: string; secciones: Seccion[] }[] = [
  {
    titulo: "Día a día",
    secciones: [
      { ruta: "/", texto: "Resumen", icono: "resumen", exacta: true },
      { ruta: "/movimientos", texto: "Movimientos", icono: "movimientos" },
      { ruta: "/habitos", texto: "Hábitos", icono: "habitos" },
      { ruta: "/reunion", texto: "Reunión del mes", icono: "reunion" },
    ],
  },
  {
    titulo: "Planear",
    secciones: [
      { ruta: "/presupuesto", texto: "Presupuesto", icono: "presupuesto" },
      { ruta: "/deudas", texto: "Deudas", icono: "deudas" },
      { ruta: "/metas", texto: "Metas", icono: "metas" },
      { ruta: "/proyeccion", texto: "Proyección", icono: "proyeccion" },
    ],
  },
  {
    titulo: "Crecer",
    secciones: [
      { ruta: "/ruta", texto: "Ruta financiera", icono: "ruta" },
      { ruta: "/patrimonio", texto: "Patrimonio", icono: "patrimonio" },
      { ruta: "/credito", texto: "Laboratorio de crédito", icono: "credito" },
      { ruta: "/sugerencias", texto: "Oráculo", icono: "sugerencias", contador: true },
    ],
  },
  {
    titulo: "Registro",
    secciones: [
      { ruta: "/historico", texto: "Histórico", icono: "historico" },
      { ruta: "/importar", texto: "Importar", icono: "importar" },
      { ruta: "/ajustes", texto: "Ajustes", icono: "ajustes" },
    ],
  },
];

/** Posición de cada sección en el panal, contando de arriba abajo: marca el
 *  turno de cada celda en la oleada de luz que lo recorre. */
const TURNO = new Map(GRUPOS.flatMap((g) => g.secciones).map((s, i) => [s.ruta, i]));

/** Si el menú quedó minimizado se recuerda en este navegador. */
const CLAVE_MINI = "menuMinimizado";
function leerMini(): boolean {
  try {
    return localStorage.getItem(CLAVE_MINI) === "1";
  } catch {
    return false;
  }
}

/** Cuando el hogar mira en USD, dice con qué tasa se está convirtiendo. */
function IndicadorTasa() {
  const { elegido, convierte, tasa } = useMoneda();
  if (elegido !== "USD") return null;
  return (
    <span className={css.tasa} title="Tasa del día, de open.er-api.com">
      {convierte && tasa
        ? `1 US$ ≈ ${fmtMoneda(tasa, "COP")}`
        : "Sin tasa aún · mostrando COP"}
    </span>
  );
}

export function Layout() {
  const { salir, correo } = useSesion();
  const { pathname } = useLocation();
  const [mini, setMini] = useState(leerMini);
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

  const alternarMenu = () =>
    setMini((antes) => {
      const ahora = !antes;
      try {
        localStorage.setItem(CLAVE_MINI, ahora ? "1" : "0");
      } catch {
        // Sin almacenamiento el menú igual cambia; solo no se recuerda.
      }
      return ahora;
    });

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
    <div className={css.app}>
      <aside className={`${css.lateral} ${mini ? css.mini : ""}`}>
        <button
          type="button"
          className={css.alternar}
          onClick={alternarMenu}
          aria-expanded={!mini}
          aria-label={mini ? "Mostrar el menú" : "Ocultar el menú"}
          title={mini ? "Mostrar el menú" : "Ocultar el menú"}
        >
          <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M12.5 4.5 7 10l5.5 5.5" />
          </svg>
        </button>
        <div className={css.marca} title={hogar?.nombre ?? "Cuentas de Dos"}>
          <span className={css.logo} aria-hidden="true">
            <span>CD</span>
          </span>
          <div className={css.marcaTexto}>
            <h1 className={css.titulo}>{hogar?.nombre ?? "Cuentas de Dos"}</h1>
            {perfiles.length < 2 && <p className={css.sub}>Invita a tu pareja desde Ajustes</p>}
          </div>
        </div>

        <nav className={css.nav} aria-label="Secciones">
          {GRUPOS.map((g) => (
            <div key={g.titulo} className={css.grupo} role="group" aria-label={g.titulo}>
              <span className={css.grupoTitulo} aria-hidden="true">
                {g.titulo}
              </span>
              {g.secciones.map((s) => (
                <NavLink
                  key={s.ruta}
                  to={s.ruta}
                  end={s.exacta}
                  className={({ isActive }) => `${css.celda} ${isActive ? css.activo : ""}`}
                  style={{ "--i": TURNO.get(s.ruta) } as CSSProperties}
                >
                  <span className={css.hex} aria-hidden="true">
                    <span className={css.icono}>
                      <Icono nombre={s.icono} tamano={18} />
                    </span>
                  </span>
                  <span className={css.etiqueta}>
                    <small className={css.etiquetaGrupo} aria-hidden="true">
                      {g.titulo}
                    </small>
                    {s.texto}
                  </span>
                  {s.contador && <ContadorOraculo />}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        <div className={css.pieLateral}>
          <span
            className={`${css.vivo} ${enVivo ? css.vivoOn : ""}`}
            title={enVivo ? "Cambios en vivo" : "Sin conexión en vivo"}
          >
            <span className={css.punto} />
            <span className={css.vivoTexto}>{enVivo ? "Sincronizado en vivo" : "Sin conexión en vivo"}</span>
          </span>
        </div>
      </aside>

      <div className={css.principal}>
        <header className={css.topbar}>
          <Saludo />
          <div className={css.controles}>
            <IndicadorTasa />
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

            <SelectorTema />

            <button className="pill ghost" onClick={() => void salir()} title={correo}>
              Salir
            </button>
          </div>
        </header>

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

        {/* La clave por ruta remonta el contenido al navegar, y con él
            vuelve a correr la cascada de entrada: esa es la transición. */}
        <main className={css.contenido} key={pathname}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
