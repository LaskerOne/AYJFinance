import { useMemo, useState } from "react";
import { Estado } from "@/components/ui/Etiqueta";
import { FilaKpi } from "@/components/ui/Kpi";
import { LineaTiempo, type Serie } from "@/components/charts/LineaTiempo";
import { useHogar } from "@/contexts/HogarContext";
import { useFinanzas } from "@/hooks/useFinanzas";
import { useMoneda } from "@/hooks/useMoneda";
import { enMeses, porcentaje, aNumero } from "@/lib/formato";
import { simularDeudas } from "@/lib/deudas";
import { generarSugerencias, rentabilidadObjetivo } from "@/lib/sugerencias";
import css from "./Sugerencias.module.css";

export function Sugerencias() {
  const { deudas, metas, hogar } = useHogar();
  const { $ } = useMoneda();
  const f = useFinanzas();
  const estrategia = hogar?.estrategia_deuda ?? "avalancha";

  const [ensayo, setEnsayo] = useState<number>(0);

  const sugerencias = useMemo(
    () =>
      generarSugerencias({
        finanzas: f,
        deudas,
        metas,
        estrategia,
        fmt: { moneda: $, meses: enMeses, pct: (n) => porcentaje(n) },
      }),
    [f, deudas, metas, estrategia, $],
  );

  const objetivo = rentabilidadObjetivo(deudas);
  const hayDeuda = deudas.some((d) => Number(d.saldo) > 0);

  const { actual, conEnsayo } = useMemo(
    () => ({
      actual: simularDeudas(deudas, Number(hogar?.abono_extra ?? 0), estrategia, true),
      conEnsayo: simularDeudas(deudas, Number(hogar?.abono_extra ?? 0) + ensayo, estrategia, true),
    }),
    [deudas, hogar?.abono_extra, estrategia, ensayo],
  );

  const series: Serie[] = [
    { nombre: "Plan actual", puntos: actual.serie, color: "--ink-3", punteada: true },
    { nombre: "Con el abono de ensayo", puntos: conEnsayo.serie, color: "--a" },
  ];

  const topeEnsayo = Math.max(100_000, Math.round(Math.max(f.libre, f.ingreso * 0.2) / 10_000) * 10_000);

  return (
    <>
      <section className="panel">
        <header>
          <div>
            <h2>Qué conviene hacer con su plata</h2>
            <p className="nota">
              Recomendaciones calculadas sobre sus propias cifras, ordenadas por lo que más pesa.
              Cada una dice cuánto cambia el resultado en meses y en pesos.
            </p>
          </div>
        </header>

        {sugerencias.length === 0 ? (
          <p className="vacio">
            Con sus números actuales no hay nada urgente que ajustar. Cuando cambien ingresos,
            gastos o deudas, esta página se recalcula sola.
          </p>
        ) : (
          <div className={css.lista}>
            {sugerencias.map((s) => (
              <article key={s.id} className={css.tarjeta} data-tono={s.tono}>
                <div className={css.cabeza}>
                  <h3 className={css.titulo}>{s.titulo}</h3>
                  {s.impacto && <Estado tono={s.tono}>{s.impacto}</Estado>}
                </div>
                <p className={css.cuerpo}>{s.cuerpo}</p>
                {s.comoSeCalcula && <p className={css.calculo}>{s.comoSeCalcula}</p>}
              </article>
            ))}
          </div>
        )}
      </section>

      {hayDeuda && (
        <section className="panel">
          <header>
            <div>
              <h2>El listón de su ahorro</h2>
              <p className="nota">
                Cuánto tendría que rendir una alternativa para que convenga más que abonar a la
                deuda.
              </p>
            </div>
          </header>

          <div className={css.liston}>
            <span className={css.listonNumero}>{porcentaje(objetivo / 100)}</span>
            <span className={css.listonTexto}>efectivo anual</span>
          </div>

          <p className={css.listonNota}>
            Es la tasa de su deuda más cara. Abonar a esa deuda produce ese rendimiento{" "}
            <b>garantizado y libre de impuestos</b>: no hay riesgo de mercado ni retención, porque
            no es una ganancia sino un costo que dejan de pagar. Cualquier producto de ahorro que
            rinda menos les deja en desventaja mientras esa deuda siga viva.
          </p>

          <p className={css.descargo}>
            Esta aplicación no recomienda productos ni entidades: hace la cuenta con sus datos.
            Comparar alternativas concretas de inversión es una conversación con un asesor
            licenciado, que pueda mirar su perfil de riesgo, su horizonte y su situación
            tributaria.
          </p>
        </section>
      )}

      {hayDeuda && (
        <section className="panel">
          <header>
            <div>
              <h2>Ensayar un abono</h2>
              <p className="nota">
                Mueva la barra para ver qué pasaría si destinaran más dinero a las deudas. No
                cambia nada de su presupuesto: es solo una simulación.
              </p>
            </div>
          </header>

          <div className={css.deslizador}>
            <label htmlFor="ensayo">
              Abono adicional al mes
              <input
                id="ensayo"
                type="range"
                min={0}
                max={topeEnsayo}
                step={Math.max(10_000, Math.round(topeEnsayo / 100 / 10_000) * 10_000)}
                value={ensayo}
                onChange={(e) => setEnsayo(aNumero(e.target.value))}
              />
            </label>
            <span className={css.valorEnsayo}>{$(ensayo)}</span>
          </div>

          <FilaKpi
            columnas={3}
            datos={[
              {
                etiqueta: "Salida de deudas",
                valor: conEnsayo.estancado ? "Nunca" : enMeses(conEnsayo.meses),
                detalle: actual.estancado
                  ? "El plan actual no baja el saldo"
                  : `Hoy: ${enMeses(actual.meses)}`,
                tono: "positivo",
                destacado: true,
              },
              {
                etiqueta: "Meses que se ganan",
                valor:
                  actual.estancado || conEnsayo.estancado
                    ? "—"
                    : enMeses(Math.max(0, actual.meses - conEnsayo.meses)),
                detalle: ensayo === 0 ? "Mueva la barra para comparar" : "Frente al plan de hoy",
              },
              {
                etiqueta: "Intereses que se evitan",
                valor:
                  actual.estancado || conEnsayo.estancado
                    ? "—"
                    : $(Math.max(0, actual.intereses - conEnsayo.intereses)),
                detalle: "En todo el recorrido",
                tono: "positivo",
              },
            ]}
          />

          <div className={css.grafico}>
            <LineaTiempo
              series={series}
              etiqueta="Saldo de deuda con y sin el abono de ensayo"
              alto={190}
            />
          </div>

          <div className={css.leyenda}>
            <span>
              <span className={css.trazoPunteado} /> Plan actual
            </span>
            <span>
              <span className={css.trazoSolido} /> Con el abono de ensayo
            </span>
          </div>

          {ensayo > 0 && ensayo > f.libre && (
            <p className={css.aviso}>
              Ojo: {$(ensayo)} es más de lo que les queda libre al mes ({$(Math.max(0, f.libre))}).
              Para sostenerlo tendrían que recortar gastos o bajar el aporte a alguna meta.
            </p>
          )}
        </section>
      )}
    </>
  );
}
