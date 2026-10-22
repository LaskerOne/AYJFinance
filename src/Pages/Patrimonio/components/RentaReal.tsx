import { Estado } from "@/components/ui/Etiqueta";
import { useHogar } from "@/contexts/HogarContext";
import { useMoneda } from "@/hooks/useMoneda";
import { aNumero, fechaCorta } from "@/lib/formato";
import { rentabilidad, vencimientos } from "@/lib/patrimonio";
import { rentabilidadObjetivo } from "@/lib/sugerencias";
import { TIPOS_ACTIVO } from "@/models/dominio";
import css from "../Patrimonio.module.css";

const FUENTE_IPC =
  "https://www.dane.gov.co/index.php/estadisticas-por-tema/precios-y-costos/indice-de-precios-al-consumidor-ipc";

const pct = (n: number) => `${n.toFixed(2).replace(".", ",")} %`;

/**
 * La rentabilidad en tres capas: la que anuncian, la que queda tras
 * impuestos (retención y 4×1000) y la que queda tras la inflación. Y la
 * comparación con la deuda más cara: si una inversión rinde menos que lo
 * que cobra esa deuda, abonarle a la deuda es la mejor "inversión".
 */
export function RentaReal({ inflacion, supuesta }: { inflacion: number; supuesta: boolean }) {
  const { activos, deudas, cambiarHogar } = useHogar();
  const { $ } = useMoneda();
  const liston = rentabilidadObjetivo(deudas);
  const conTasa = activos.filter((a) => a.tasa_ea !== null && TIPOS_ACTIVO[a.tipo].grupo !== "bienes");
  const proximos = vencimientos(activos, inflacion).filter((v) => v.dias >= 0);

  return (
    <section className="panel">
      <header>
        <div>
          <h2>Cuánto rinden de verdad</h2>
          <p className="nota">
            Primero la tasa que anuncian; luego lo que queda tras la retención en la fuente y el
            4×1000; y al final lo que queda tras la inflación, que es lo que de verdad hace
            crecer lo que pueden comprar.
          </p>
        </div>
      </header>

      <div className={css.inflacion}>
        <label className={css.campoLab}>
          <span className="eyebrow">Inflación de referencia (% anual)</span>
          <input
            className="campo n"
            inputMode="decimal"
            defaultValue={supuesta ? "" : String(inflacion).replace(".", ",")}
            placeholder={String(inflacion).replace(".", ",")}
            onBlur={(e) => {
              const v = aNumero(e.target.value);
              if (v > 0 && v !== inflacion) void cambiarHogar({ inflacion_ref: v });
            }}
          />
        </label>
        <p className={css.nota}>
          La inflación de los últimos 12 meses la publica el DANE:{" "}
          <a href={FUENTE_IPC} target="_blank" rel="noreferrer">
            consúltenla aquí
          </a>
          .{" "}
          {supuesta ? (
            <Estado tono="warn">Usando {pct(inflacion)} como supuesto</Estado>
          ) : (
            <Estado tono="ok">Guardada</Estado>
          )}
        </p>
      </div>

      {conTasa.length === 0 ? (
        <p className="vacio">
          Cuando registren una cuenta o inversión con su rentabilidad, aquí verán cuánto rinde de
          verdad.
        </p>
      ) : (
        <div className="tablaScroll">
          <table className="datos" style={{ minWidth: 720 }}>
            <thead>
              <tr>
                <th>Activo</th>
                <th className="r">Anunciada</th>
                <th className="r">Tras impuestos</th>
                <th className="r">Tras inflación</th>
                <th>Frente a su deuda más cara</th>
              </tr>
            </thead>
            <tbody>
              {conTasa.map((a) => {
                const r = rentabilidad(a, inflacion)!;
                const grupo = TIPOS_ACTIVO[a.tipo].grupo;
                return (
                  <tr key={a.id}>
                    <td style={{ padding: "9px 8px" }}>
                      <b>{a.nombre || TIPOS_ACTIVO[a.tipo].nombre}</b>
                      <span className={css.tipo}> · {TIPOS_ACTIVO[a.tipo].nombre}</span>
                    </td>
                    <td className="r num">{pct(r.nominal)}</td>
                    <td className="r num">{pct(r.neta)}</td>
                    <td className="r num" style={{ fontWeight: 700, color: r.real < 0 ? "var(--crit-ink)" : "var(--a-ink)" }}>
                      {pct(r.real)}
                    </td>
                    <td>
                      {liston <= 0 ? (
                        <span className={css.tipo}>Sin deudas</span>
                      ) : grupo === "retiro" ? (
                        <span className={css.tipo}>Plata de largo plazo</span>
                      ) : r.neta >= liston ? (
                        <Estado tono="ok">Rinde más que la deuda</Estado>
                      ) : grupo === "liquido" ? (
                        <Estado tono="neutro">Rinde menos, pero es su liquidez</Estado>
                      ) : (
                        <Estado tono="warn">
                          Abonar a la deuda rinde {pct(liston - r.neta)} más
                        </Estado>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {proximos.length > 0 && (
        <div className={css.vencimientos}>
          <span className="eyebrow">Próximos vencimientos</span>
          {proximos.map((v) => (
            <p key={v.activo.id}>
              <b>{fechaCorta(v.fecha)}</b> · {v.activo.nombre || TIPOS_ACTIVO[v.activo.tipo].nombre}: llegaría a
              unos <b className="num">{$(v.valorFinal)}</b> {v.dias <= 30 ? <Estado tono="warn">Este mes: decidan qué hacer</Estado> : `en ${v.dias} días`}
            </p>
          ))}
          {proximos.length > 1 && new Set(proximos.map((v) => v.fecha.slice(0, 7))).size === 1 && (
            <p className={css.nota}>
              Todos vencen el mismo mes. Una <b>escalera de CDT</b> (dividir en varios con
              vencimientos escalonados) da plata disponible más seguido y reparte el riesgo de tasa.
            </p>
          )}
        </div>
      )}

      <p className={css.pie}>
        Aproximación de uso general: retención del 7 % sobre rendimientos de cuentas, CDT y fondos,
        y un 4×1000 al año al retirar (las cuentas de ahorro marcadas como exentas no lo pagan).
        La retención es un anticipo del impuesto de renta y su efecto final depende de cada
        declaración. No es asesoría tributaria.
      </p>
    </section>
  );
}
