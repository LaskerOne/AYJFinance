import { useMemo, useRef, useState, type ChangeEvent } from "react";
import { Estado } from "@/components/ui/Etiqueta";
import { FilaKpi } from "@/components/ui/Kpi";
import { useHogar } from "@/contexts/HogarContext";
import { useMoneda } from "@/hooks/useMoneda";
import { leerCSV, patronDe, type FilaImportada } from "@/services/csv.service";
import { aprenderRegla } from "@/services/coleccion.service";
import { mensajeDeError } from "@/services/supabase";
import { fechaCorta } from "@/lib/formato";
import { CATEGORIAS, type Categoria } from "@/models/dominio";
import css from "./Importar.module.css";

type Fase = "inicio" | "revision" | "guardando" | "listo";

export function Importar() {
  const { movimientos, reglas, crearVarias, hogar, idA } = useHogar();
  const { $ } = useMoneda();

  const entrada = useRef<HTMLInputElement>(null);
  const [fase, setFase] = useState<Fase>("inicio");
  const [filas, setFilas] = useState<FilaImportada[]>([]);
  const [columnas, setColumnas] = useState({ fecha: "", concepto: "", monto: "" });
  const [descartadas, setDescartadas] = useState(0);
  const [error, setError] = useState("");
  const [importadas, setImportadas] = useState(0);
  const [correcciones, setCorrecciones] = useState<Map<string, Categoria>>(new Map());

  const huellas = useMemo(
    () => new Set(movimientos.map((m) => m.huella).filter((h): h is string => Boolean(h))),
    [movimientos],
  );

  const alElegirArchivo = async (e: ChangeEvent<HTMLInputElement>) => {
    const archivo = e.target.files?.[0];
    if (!archivo) return;
    setError("");

    try {
      const texto = await archivo.text();
      const resultado = leerCSV(texto, reglas, huellas);

      if (resultado.filas.length === 0) {
        setError(
          "No se reconoció ningún movimiento. Revisa que el archivo tenga una columna de fecha y otra de valor, y que sea CSV y no Excel.",
        );
        return;
      }

      setFilas(resultado.filas);
      setColumnas(resultado.columnas);
      setDescartadas(resultado.descartadas);
      setCorrecciones(new Map());
      setFase("revision");
    } catch (err) {
      setError(mensajeDeError(err));
    }
  };

  const cambiarCategoria = (huella: string, categoria: Categoria) => {
    setFilas((prev) =>
      prev.map((f) => (f.huella === huella ? { ...f, categoria, porRegla: false } : f)),
    );
    setCorrecciones((prev) => new Map(prev).set(huella, categoria));
  };

  const alternar = (huella: string) => {
    setFilas((prev) =>
      prev.map((f) => (f.huella === huella ? { ...f, incluir: !f.incluir } : f)),
    );
  };

  const seleccionadas = filas.filter((f) => f.incluir);
  const totalGastos = seleccionadas
    .filter((f) => f.clase === "gasto")
    .reduce((s, f) => s + f.monto, 0);
  const totalIngresos = seleccionadas
    .filter((f) => f.clase === "ingreso")
    .reduce((s, f) => s + f.monto, 0);

  const guardar = async () => {
    if (!hogar || seleccionadas.length === 0) return;
    setFase("guardando");
    setError("");

    try {
      const total = await crearVarias(
        "movimientos",
        seleccionadas.map((f) => ({
          fecha: f.fecha,
          concepto: f.concepto,
          categoria: f.categoria,
          monto: f.monto,
          clase: f.clase,
          pagado_por: idA,
          compartido: true,
          origen: "importado",
          huella: f.huella,
        })),
      );

      // Cada corrección tuya se vuelve una regla: el próximo extracto llega
      // mejor clasificado sin que tengas que repetir el trabajo.
      await Promise.all(
        [...correcciones.entries()].map(([huella, categoria]) => {
          const fila = filas.find((f) => f.huella === huella);
          if (!fila) return Promise.resolve();
          const patron = patronDe(fila.concepto);
          return patron ? aprenderRegla(hogar.id, patron, categoria) : Promise.resolve();
        }),
      );

      setImportadas(total);
      setFase("listo");
    } catch (err) {
      setError(mensajeDeError(err));
      setFase("revision");
    }
  };

  const reiniciar = () => {
    setFilas([]);
    setCorrecciones(new Map());
    setFase("inicio");
    if (entrada.current) entrada.current.value = "";
  };

  return (
    <section className="panel">
      <header>
        <div>
          <h2>Importar extracto del banco</h2>
          <p className="nota">
            Descarga el CSV de tu banco o tarjeta y súbelo aquí. Se detecta solo el separador, el
            formato de fecha y si el gasto viene en negativo o en columna aparte.
          </p>
        </div>
        {fase === "revision" && (
          <button className="pill ghost" onClick={reiniciar}>
            Cambiar archivo
          </button>
        )}
      </header>

      {error && <p className={css.error}>{error}</p>}

      {fase === "inicio" && (
        <>
          <label className={css.zona}>
            <input
              ref={entrada}
              type="file"
              accept=".csv,text/csv,text/plain"
              onChange={(e) => void alElegirArchivo(e)}
            />
            <span className={css.zonaIcono} aria-hidden="true">↑</span>
            <span className={css.zonaTitulo}>Elegir archivo CSV</span>
            <span className={css.zonaAyuda}>
              Nada sale de tu navegador hasta que confirmes: el archivo se lee aquí mismo y solo se
              guardan las filas que apruebes.
            </span>
          </label>

          <div className={css.consejos}>
            <h3 className={css.subtitulo}>Cómo sacar el archivo</h3>
            <ul>
              <li>
                <b>Bancolombia:</b> Sucursal Virtual → Consultas → Movimientos → Exportar a Excel, y
                guárdalo como CSV.
              </li>
              <li>
                <b>Davivienda y BBVA:</b> Movimientos → Descargar → formato CSV o Excel.
              </li>
              <li>
                <b>Nequi y Daviplata:</b> exportan PDF; toca digitar o pasarlos a CSV primero.
              </li>
              <li>
                Si tu banco solo da Excel, ábrelo y usa <i>Guardar como → CSV (delimitado por
                comas)</i>.
              </li>
            </ul>
          </div>
        </>
      )}

      {(fase === "revision" || fase === "guardando") && (
        <>
          <div className={css.deteccion}>
            <Estado tono="ok">Archivo reconocido</Estado>
            <span>
              Fecha: <b>{columnas.fecha}</b> · Concepto: <b>{columnas.concepto}</b> · Valor:{" "}
              <b>{columnas.monto}</b>
              {descartadas > 0 && ` · ${descartadas} líneas ignoradas (encabezados o totales)`}
            </span>
          </div>

          <FilaKpi
            columnas={4}
            datos={[
              { etiqueta: "Filas leídas", valor: String(filas.length) },
              {
                etiqueta: "Se van a importar",
                valor: String(seleccionadas.length),
                detalle: `${filas.filter((f) => f.duplicada).length} ya estaban registradas`,
                destacado: true,
              },
              { etiqueta: "Gastos", valor: $(totalGastos) },
              { etiqueta: "Ingresos", valor: $(totalIngresos) },
            ]}
          />

          <p className={css.aviso}>
            Revisa las categorías antes de guardar. Cada corrección que hagas se recuerda: el
            próximo extracto llegará mejor clasificado.
          </p>

          <div className="tablaScroll">
            <table className="datos">
              <thead>
                <tr>
                  <th style={{ width: 40 }}>Incluir</th>
                  <th>Fecha</th>
                  <th>Concepto</th>
                  <th>Categoría</th>
                  <th className="r">Monto</th>
                </tr>
              </thead>
              <tbody>
                {filas.map((f) => (
                  <tr key={f.huella} className={f.incluir ? "" : css.excluida}>
                    <td>
                      <input
                        type="checkbox"
                        checked={f.incluir}
                        aria-label={`Incluir ${f.concepto}`}
                        onChange={() => alternar(f.huella)}
                        style={{ width: "auto", accentColor: "var(--a)" }}
                      />
                    </td>
                    <td style={{ whiteSpace: "nowrap", fontSize: 12.5, color: "var(--ink-2)" }}>
                      {fechaCorta(f.fecha)}
                    </td>
                    <td>
                      <span className={css.concepto}>{f.concepto}</span>
                      {f.duplicada && <Estado tono="warn">Ya registrado</Estado>}
                      {f.porRegla && <Estado tono="neutro">Por tu regla</Estado>}
                    </td>
                    <td>
                      <select
                        aria-label={`Categoría de ${f.concepto}`}
                        value={f.categoria}
                        onChange={(e) => cambiarCategoria(f.huella, e.target.value as Categoria)}
                      >
                        {CATEGORIAS.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="r num" style={{ whiteSpace: "nowrap" }}>
                      {f.clase === "ingreso" ? "+" : "−"}
                      {$(f.monto).replace("−", "")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className={css.acciones}>
            <button
              className="pill primaria"
              onClick={() => void guardar()}
              disabled={fase === "guardando" || seleccionadas.length === 0}
            >
              {fase === "guardando"
                ? "Guardando…"
                : `Importar ${seleccionadas.length} movimientos`}
            </button>
            <button className="pill ghost" onClick={reiniciar} disabled={fase === "guardando"}>
              Cancelar
            </button>
          </div>
        </>
      )}

      {fase === "listo" && (
        <div className={css.exito}>
          <Estado tono="ok">Listo</Estado>
          <p className={css.exitoTexto}>
            Se importaron <b>{importadas}</b> movimientos
            {correcciones.size > 0 && (
              <>
                {" "}
                y se aprendieron <b>{correcciones.size}</b> reglas de categoría
              </>
            )}
            .
          </p>
          <p className="nota">
            Ya aparecen en Movimientos, comparados contra el presupuesto del mes.
          </p>
          <button className="pill" onClick={reiniciar}>
            Importar otro archivo
          </button>
        </div>
      )}
    </section>
  );
}
