import { useMemo, useState } from "react";
import { LineaTiempo, type Serie } from "@/components/charts/LineaTiempo";
import { FilaKpi } from "@/components/ui/Kpi";
import { Estado, Etiqueta } from "@/components/ui/Etiqueta";
import { CampoMoneda } from "@/components/ui/CampoMoneda";
import { SelectorPersona } from "@/components/ui/SelectorPersona";
import { useHogar } from "@/contexts/HogarContext";
import { useMoneda } from "@/hooks/useMoneda";
import { useFinanzas } from "@/hooks/useFinanzas";
import { simularDeudas, ordenarPorEstrategia, tasaMensual } from "@/lib/deudas";
import { aNumero, dentroDe, enMeses } from "@/lib/formato";
import css from "./Deudas.module.css";

export function Deudas() {
  const { deudas, hogar, cambiarHogar, crear, editar, borrar, nombreDe, ladoDe } = useHogar();
  const { $ } = useMoneda();
  const f = useFinanzas();

  const estrategia = hogar?.estrategia_deuda ?? "avalancha";
  const [abono, setAbono] = useState<number>(Number(hogar?.abono_extra ?? 0));

  const tope = Math.max(
    500_000,
    Math.round(((f.disponible > 0 ? f.disponible : 500_000) * 1.5) / 10_000) * 10_000,
    abono,
  );

  const otra = estrategia === "avalancha" ? "bola" : "avalancha";

  const { base, plan, planOtra } = useMemo(
    () => ({
      base: simularDeudas(deudas, 0, estrategia, false),
      plan: simularDeudas(deudas, abono, estrategia, true),
      // La misma simulación con la otra estrategia, para poder decir en
      // pantalla qué se gana o se pierde al cambiar de opción.
      planOtra: simularDeudas(deudas, abono, otra, true),
    }),
    [deudas, abono, estrategia, otra],
  );

  const pendientes = deudas.filter((d) => Number(d.saldo) > 0);
  const ordenadas = ordenarPorEstrategia(deudas, estrategia);

  // Con frecuencia la deuda más cara es además la más pequeña —las tarjetas
  // de crédito son el caso típico—, y entonces ambas estrategias producen el
  // mismo orden. Decirlo evita que parezca que el selector no hace nada.
  const ordenAlterno = ordenarPorEstrategia(deudas, otra);
  const mismoOrden =
    ordenadas.length === ordenAlterno.length &&
    ordenadas.every((d, i) => d.id === ordenAlterno[i]?.id);

  const primera = ordenadas[0];
  const primeraOtra = ordenAlterno[0];

  const series: Serie[] = [
    { nombre: "Solo las cuotas", puntos: base.serie, color: "--ink-3", punteada: true },
    { nombre: "Con abono extra", puntos: plan.serie, color: "--a" },
  ];

  const ahorroIntereses = base.intereses - plan.intereses;
  const mesesMenos = base.meses - plan.meses;

  return (
    <>
      <section className="panel">
        <header>
          <div>
            <h2>Plan de salida de deudas</h2>
            <p className="nota">
              Las tasas van en % efectivo anual (E.A.) y se convierten a mes vencido para simular
              mes a mes.
            </p>
          </div>
          <div className="segmentado" role="group" aria-label="Estrategia">
            <button
              type="button"
              aria-pressed={estrategia === "avalancha"}
              onClick={() => void cambiarHogar({ estrategia_deuda: "avalancha" })}
            >
              Avalancha · mayor tasa
            </button>
            <button
              type="button"
              aria-pressed={estrategia === "bola"}
              onClick={() => void cambiarHogar({ estrategia_deuda: "bola" })}
            >
              Bola de nieve · menor saldo
            </button>
          </div>
        </header>

        {pendientes.length > 0 && (
          <div className={css.explicacion}>
            <p>
              {estrategia === "avalancha" ? (
                <>
                  <b>Avalancha.</b> Todo lo que sobra cada mes —el abono extra, más las cuotas que
                  se liberan cuando una deuda se acaba— se lanza contra la deuda de{" "}
                  <b>mayor tasa</b>. Es la que menos intereses paga en total: matemáticamente
                  siempre gana.
                  {primera && (
                    <>
                      {" "}
                      En su caso es <b>{primera.nombre || "la primera de la lista"}</b>, al{" "}
                      <b>{String(Number(primera.tasa_ea)).replace(".", ",")} % E.A.</b>
                    </>
                  )}
                </>
              ) : (
                <>
                  <b>Bola de nieve.</b> El excedente se lanza contra la deuda de{" "}
                  <b>menor saldo</b>, para irlas eliminando de a una lo más rápido posible. Paga
                  algo más de intereses, pero cada deuda que desaparece es una victoria visible —
                  y eso sostiene el hábito.
                  {primera && (
                    <>
                      {" "}
                      En su caso es <b>{primera.nombre || "la primera de la lista"}</b>, con{" "}
                      <b>{$(Number(primera.saldo))}</b> pendientes
                      {Number(primera.cuota) > 0 && (
                        <>
                          {" "}
                          — unos <b>{enMeses(Math.ceil(Number(primera.saldo) / (Number(primera.cuota) + abono)))}</b> si
                          le echan todo encima
                        </>
                      )}
                    </>
                  )}
                </>
              )}
            </p>
            <p className={css.comparacion}>
              {base.estancado || plan.estancado || planOtra.estancado ? (
                <>Con las cuotas actuales no se puede comparar: el saldo no baja.</>
              ) : plan.meses === planOtra.meses &&
                Math.abs(plan.intereses - planOtra.intereses) < 1000 ? (
                <>
                  Con sus números, las dos estrategias dan prácticamente lo mismo. Elijan la que
                  más ánimo les dé.
                </>
              ) : (
                <>
                  Con sus números, <b>{estrategia === "avalancha" ? "avalancha" : "bola de nieve"}</b>{" "}
                  termina en <b>{enMeses(plan.meses)}</b> pagando{" "}
                  <b>{$(plan.intereses)}</b> de intereses. Con{" "}
                  {otra === "avalancha" ? "avalancha" : "bola de nieve"} serían{" "}
                  <b>{enMeses(planOtra.meses)}</b> y <b>{$(planOtra.intereses)}</b> —{" "}
                  {plan.intereses <= planOtra.intereses
                    ? `${$(planOtra.intereses - plan.intereses)} más.`
                    : `${$(plan.intereses - planOtra.intereses)} menos.`}
                </>
              )}
            </p>
            <p className={css.pistaOrden}>
              {mismoOrden ? (
                <>
                  Con estas deudas las dos estrategias coinciden en el orden —la más cara resulta
                  ser también la más pequeña—, así que la lista de abajo no cambia al alternar:{" "}
                  <b>{primera?.nombre || "la primera"}</b> encabeza las dos.
                </>
              ) : (
                <>
                  Las dos estrategias no coinciden: con{" "}
                  {estrategia === "avalancha" ? "avalancha" : "bola de nieve"} va primero{" "}
                  <b>{primera?.nombre || "la primera"}</b>, y con la otra iría{" "}
                  <b>{primeraOtra?.nombre || "otra"}</b>. La número <b>1</b> de la lista es a la
                  que hay que echarle todo lo que sobre.
                </>
              )}
            </p>
          </div>
        )}

        {pendientes.length === 0 ? (
          <p className="vacio">
            {deudas.length === 0 ? (
              <>Sin deudas registradas. Si tienen alguna, agrégala abajo.</>
            ) : (
              <>
                <Estado tono="ok">Sin saldos pendientes</Estado>
                <br />
                Todas las deudas están en cero. Esas cuotas ya pueden irse a las metas.
              </>
            )}
          </p>
        ) : (
          <>
            <div className={css.deslizador}>
              <label htmlFor="abono">
                Abono extra al mes
                <input
                  id="abono"
                  type="range"
                  min={0}
                  max={tope}
                  step={Math.max(1000, Math.round(tope / 200 / 1000) * 1000)}
                  value={abono}
                  onChange={(e) => setAbono(aNumero(e.target.value))}
                  onMouseUp={() => void cambiarHogar({ abono_extra: abono })}
                  onTouchEnd={() => void cambiarHogar({ abono_extra: abono })}
                  onKeyUp={() => void cambiarHogar({ abono_extra: abono })}
                />
              </label>
              <span className={css.valorAbono}>{$(abono)}</span>
            </div>

            <FilaKpi
              columnas={3}
              datos={[
                {
                  etiqueta: "Solo con las cuotas",
                  valor: base.estancado ? "Nunca" : enMeses(base.meses),
                  detalle: base.estancado
                    ? "Las cuotas no alcanzan a bajar el saldo"
                    : `Intereses: ${$(base.intereses)}`,
                },
                {
                  etiqueta: "Con el abono extra",
                  valor: plan.estancado ? "Nunca" : enMeses(plan.meses),
                  detalle: plan.estancado
                    ? "Sube el abono para romper la bola de intereses"
                    : `Libres en ${dentroDe(plan.meses)}`,
                  tono: plan.estancado ? "negativo" : "positivo",
                  destacado: true,
                },
                {
                  etiqueta: "Intereses que se ahorran",
                  valor:
                    base.estancado || plan.estancado ? "—" : $(Math.max(0, ahorroIntereses)),
                  detalle:
                    base.estancado || plan.estancado
                      ? "Sin comparación posible"
                      : mesesMenos > 0
                        ? `${enMeses(mesesMenos)} menos de deuda`
                        : "Sube el abono para ganar meses",
                  tono: "positivo",
                },
              ]}
            />

            <div className={css.grafico}>
              <LineaTiempo series={series} etiqueta="Saldo total de deuda mes a mes" alto={200} />
            </div>

            <div className={css.leyendaLinea}>
              <span className={css.itemLinea}>
                <span className={css.trazoPunteado} />
                Solo las cuotas
              </span>
              <span className={css.itemLinea}>
                <span className={css.trazoSolido} />
                Con abono extra y reinversión de cuotas
              </span>
            </div>

            <div className={css.lista}>
              {ordenadas.map((d, i) => {
                const im = tasaMensual(d.tasa_ea);
                const interesMes = Number(d.saldo) * im;
                const cubre = Number(d.cuota) > interesMes;
                return (
                  <div key={d.id} className={`${css.item} ${i === 0 ? css.foco : ""}`}>
                    <span className={css.orden}>{i + 1}</span>
                    <span>
                      <span className={css.nombre}>
                        {d.nombre || "Sin nombre"}
                        <Etiqueta lado={ladoDe(d.usuario_id)} texto={nombreDe(d.usuario_id)} />
                        {i === 0 && <Estado tono="ok">Atacar primero</Estado>}
                        {!cubre && <Estado tono="crit">La cuota no cubre intereses</Estado>}
                      </span>
                      <span className={css.meta}>
                        <span className="num">
                          {String(Number(d.tasa_ea)).replace(".", ",")} % E.A.
                        </span>{" "}
                        · equivale a{" "}
                        <span className="num">{(im * 100).toFixed(2).replace(".", ",")} % mes</span>{" "}
                        · cuota <span className="num">{$(Number(d.cuota))}</span> · intereses de
                        este mes <span className="num">{$(interesMes)}</span>
                      </span>
                    </span>
                    <span className={css.saldo}>{$(Number(d.saldo))}</span>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </section>

      <section className="panel">
        <header>
          <div>
            <h2>Las deudas</h2>
            <p className="nota">Saldo y cuota actuales. La tasa va en efectivo anual.</p>
          </div>
        </header>

        <div className="tablaScroll">
          <table className="datos">
            <thead>
              <tr>
                <th>Deuda</th>
                <th>A nombre de</th>
                <th className="r">Saldo</th>
                <th className="r">Tasa % E.A.</th>
                <th className="r">Cuota/mes</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {deudas.length === 0 && (
                <tr>
                  <td colSpan={6}>
                    <p className="vacio">Sin deudas. Ojalá siga así.</p>
                  </td>
                </tr>
              )}
              {deudas.map((d) => (
                <tr key={d.id}>
                  <td>
                    <input
                      aria-label="Nombre de la deuda"
                      defaultValue={d.nombre}
                      onBlur={(e) =>
                        e.target.value !== d.nombre &&
                        void editar("deudas", d.id, { nombre: e.target.value })
                      }
                    />
                  </td>
                  <td>
                    <SelectorPersona
                      valor={d.usuario_id}
                      etiqueta="A nombre de quién"
                      onCambio={(v) => void editar("deudas", d.id, { usuario_id: v })}
                    />
                  </td>
                  <td className="r">
                    <CampoMoneda
                      valor={Number(d.saldo)}
                      etiqueta="Saldo"
                      onCambio={(v) => void editar("deudas", d.id, { saldo: v })}
                    />
                  </td>
                  <td className="r">
                    <input
                      className="n"
                      inputMode="decimal"
                      aria-label="Tasa efectiva anual"
                      defaultValue={String(Number(d.tasa_ea)).replace(".", ",")}
                      onBlur={(e) => {
                        const v = aNumero(e.target.value);
                        if (v !== Number(d.tasa_ea)) void editar("deudas", d.id, { tasa_ea: v });
                      }}
                    />
                  </td>
                  <td className="r">
                    <CampoMoneda
                      valor={Number(d.cuota)}
                      etiqueta="Cuota mensual"
                      onCambio={(v) => void editar("deudas", d.id, { cuota: v })}
                    />
                  </td>
                  <td>
                    <button
                      className="borrar"
                      aria-label={`Eliminar ${d.nombre}`}
                      onClick={() => void borrar("deudas", d.id)}
                    >
                      ×
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={4}>Total en cuotas</td>
                <td className="r tot">{$(f.cuotas)}</td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>

        <button
          className="agregar"
          onClick={() =>
            void crear("deudas", {
              usuario_id: null,
              nombre: "",
              saldo: 0,
              tasa_ea: 0,
              cuota: 0,
              orden: deudas.length + 1,
            })
          }
        >
          + Agregar deuda
        </button>
      </section>
    </>
  );
}
