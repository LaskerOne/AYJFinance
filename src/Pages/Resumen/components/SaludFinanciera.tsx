import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { Estado } from "@/components/ui/Etiqueta";
import { Medidor, type Zona } from "@/components/ui/Medidor";
import { useHogar } from "@/contexts/HogarContext";
import { useMoneda } from "@/hooks/useMoneda";
import { mesEnQueBajaDe } from "@/lib/deudas";
import { useSalud } from "@/hooks/useSalud";
import { textoPuntaje } from "@/lib/salud";
import { enMeses, porcentaje } from "@/lib/formato";
import type { Finanzas } from "@/lib/calculos";
import { ReglaCincuenta } from "./ReglaCincuenta";
import css from "../Resumen.module.css";

type Tono = "ok" | "warn" | "crit";

const TEXTO_TONO: Record<Tono, string> = { ok: "Sano", warn: "Con cuidado", crit: "En alerta" };

function tonoDe(valor: number, zonas: Zona[]): Tono {
  return (zonas.find((z) => valor <= z.hasta) ?? zonas[zonas.length - 1]).tono;
}

function Indicador({
  nombre,
  valor,
  texto,
  tono,
  medidor,
  explica,
  mueve,
}: {
  nombre: string;
  valor: number;
  texto: string;
  tono: Tono;
  medidor: { min: number; max: number; zonas: Zona[] };
  explica: ReactNode;
  mueve: ReactNode;
}) {
  return (
    <article className={`bordeViajero ${css.indicador}`}>
      <div className={css.indCabeza}>
        <span className="eyebrow">{nombre}</span>
        <Estado tono={tono}>{TEXTO_TONO[tono]}</Estado>
      </div>
      <span className={css.indValor}>{texto}</span>
      <Medidor valor={valor} {...medidor} etiqueta={`${nombre}: ${texto}`} />
      <p className={css.indExplica}>{explica}</p>
      <p className={css.indMueve}>{mueve}</p>
    </article>
  );
}

/**
 * Cuatro números que dicen más que la regla 50/30/20 sobre cómo está el
 * hogar: cuánto del ingreso se va en deudas, cuánto queda para ahorrar,
 * cuántos meses aguanta el colchón y qué tan expuestos están a perder un
 * ingreso. Cada uno trae qué significa con sus cifras y qué lo movería.
 */
export function SaludFinanciera({ finanzas: f }: { finanzas: Finanzas }) {
  const { deudas, idA, idB, nombreDe } = useHogar();
  const { $ } = useMoneda();
  const { puntaje } = useSalud();
  const estadoPuntaje = textoPuntaje(puntaje.total);

  // 1 · Endeudamiento: cuotas sobre ingreso.
  const dti = f.ingreso > 0 ? f.cuotas / f.ingreso : 0;
  const zonasDti: Zona[] = [
    { hasta: 0.3, tono: "ok" },
    { hasta: 0.4, tono: "warn" },
    { hasta: 1, tono: "crit" },
  ];
  const baja40 = mesEnQueBajaDe(deudas, f.ingreso, 0.4);
  const baja30 = mesEnQueBajaDe(deudas, f.ingreso, 0.3);
  const sobre40 = Math.max(0, f.cuotas - 0.4 * f.ingreso);

  // 2 · Capacidad de ahorro: lo que queda después de gastos y cuotas.
  const zonasAhorro: Zona[] = [
    { hasta: 0.1, tono: "crit" },
    { hasta: 0.2, tono: "warn" },
    { hasta: 1, tono: "ok" },
  ];
  const faltaPara20 = Math.max(0, 0.2 * f.ingreso - f.disponible);

  // 3 · Colchón: meses de vida que cubre el fondo de emergencia.
  const zonasColchon: Zona[] = [
    { hasta: 3, tono: "crit" },
    { hasta: 6, tono: "warn" },
    { hasta: 99, tono: "ok" },
  ];
  const sinFondo = f.fondoObjetivo <= 0 && f.fondo <= 0;
  const falta6 = Math.max(0, f.costoVida * 6 - f.fondo);
  const mesesParaSeis = f.fondoAporte > 0 ? Math.ceil(falta6 / f.fondoAporte) : Infinity;

  // 4 · Dependencia de un ingreso: qué tan expuestos están si falta el mayor.
  const principalEsA = f.participacionA >= f.participacionB;
  const participacion = principalEsA ? f.participacionA : f.participacionB;
  const principal = nombreDe(principalEsA ? idA : idB);
  const restante = principalEsA ? f.ingreso - f.ingresoA : f.ingreso - f.ingresoB;
  const cubreSinPrincipal = f.costoVida > 0 ? restante / f.costoVida : 0;
  const hueco = Math.max(0, f.costoVida - restante);
  const aguantan = hueco > 0 ? f.fondo / hueco : Infinity;
  // Concentrar el ingreso no es un error, es un riesgo: por eso no pasa de
  // "con cuidado" y su respuesta es el colchón, no ganar menos.
  const zonasDependencia: Zona[] = [
    { hasta: 0.6, tono: "ok" },
    { hasta: 1, tono: "warn" },
  ];

  return (
    <section className="panel">
      <header>
        <div>
          <h2>Salud financiera</h2>
          <p className="nota">
            Cuatro medidas de cómo está el hogar, cada una con lo que significa en sus cifras y
            lo que la movería.
          </p>
        </div>
        <Link to="/ruta" className={css.puntajeEnlace} title="Ver la ruta financiera">
          <Estado tono={estadoPuntaje.tono}>
            Puntaje {puntaje.total} / 100 · {estadoPuntaje.texto}
          </Estado>
        </Link>
      </header>

      <div className={css.indicadores}>
        <Indicador
          nombre="Endeudamiento"
          valor={dti}
          texto={porcentaje(dti)}
          tono={tonoDe(dti, zonasDti)}
          medidor={{ min: 0, max: 0.7, zonas: zonasDti }}
          explica={
            <>
              De cada $100 que entran, ${Math.round(dti * 100)} se van en cuotas. Los bancos
              suelen mirar con cuidado lo que pasa del 30–40 %: por encima, un crédito nuevo sale
              más caro o lo niegan.
            </>
          }
          mueve={
            dti <= 0.3 ? (
              <>Están en zona sana. Mantener las cuotas por debajo del 30 % da margen ante imprevistos.</>
            ) : (
              <>
                {sobre40 > 0 && (
                  <>
                    Para bajar al 40 % las cuotas tendrían que ser <b>{$(sobre40)}</b> menores.{" "}
                  </>
                )}
                {baja40 && baja40.mes > 0 && baja40.deuda ? (
                  <>
                    Solo pagando cuotas, bajan del 40 % en <b>{enMeses(baja40.mes)}</b>, cuando
                    termine «{baja40.deuda.nombre || "una deuda"}»
                    {baja30 && baja30.mes > 0 ? <>, y del 30 % en <b>{enMeses(baja30.mes)}</b></> : null}
                    .
                  </>
                ) : baja30 && baja30.mes > 0 ? (
                  <>
                    Solo pagando cuotas, bajan del 30 % en <b>{enMeses(baja30.mes)}</b>.
                  </>
                ) : !baja40 ? (
                  <>Alguna cuota no alcanza a cubrir sus intereses: revisen el plan en Deudas.</>
                ) : null}{" "}
                <Link to="/deudas">Ver el plan de deudas</Link>
              </>
            )
          }
        />

        <Indicador
          nombre="Capacidad de ahorro"
          valor={f.tasaAhorro}
          texto={porcentaje(f.tasaAhorro)}
          tono={tonoDe(f.tasaAhorro, zonasAhorro)}
          medidor={{ min: 0, max: 0.4, zonas: zonasAhorro }}
          explica={
            <>
              Después de gastos y cuotas quedan <b>{$(Math.max(0, f.disponible))}</b> de{" "}
              {$(f.ingreso)}. La referencia clásica es guardar al menos el 20 %.
            </>
          }
          mueve={
            faltaPara20 > 0 ? (
              <>
                Llegar al 20 % pide <b>{$(faltaPara20)}</b> más al mes: sale de recortar gastos o
                de las cuotas que se liberan al terminar cada deuda.
              </>
            ) : (
              <>Ya pasan el 20 %. Lo importante ahora es que ese margen llegue a metas con fecha.</>
            )
          }
        />

        <Indicador
          nombre="Colchón de emergencia"
          valor={f.mesesColchon}
          texto={`${f.mesesColchon.toFixed(1).replace(".", ",")} meses`}
          tono={tonoDe(f.mesesColchon, zonasColchon)}
          medidor={{ min: 0, max: 9, zonas: zonasColchon }}
          explica={
            sinFondo ? (
              <>
                Ninguna meta está marcada como fondo de emergencia todavía.{" "}
                <Link to="/metas">Márquenla en Metas</Link>.
              </>
            ) : (
              <>
                Vivir un mes les cuesta <b>{$(f.costoVida)}</b> entre gastos y cuotas; el fondo
                tiene {$(f.fondo)}. Lo recomendado es tener de 3 a 6 meses.
              </>
            )
          }
          mueve={
            f.mesesColchon >= 6 ? (
              <>Ya cubren seis meses: el excedente rinde más en las otras metas.</>
            ) : Number.isFinite(mesesParaSeis) ? (
              <>
                Para seis meses faltan <b>{$(falta6)}</b>: unos {enMeses(mesesParaSeis)} al ritmo
                actual del fondo.
              </>
            ) : (
              <>
                Para seis meses faltan <b>{$(falta6)}</b>. Asígnenle un aporte mensual al fondo.
              </>
            )
          }
        />

        <Indicador
          nombre="Dependencia de un ingreso"
          valor={participacion}
          texto={porcentaje(participacion)}
          tono={tonoDe(participacion, zonasDependencia)}
          medidor={{ min: 0.5, max: 1, zonas: zonasDependencia }}
          explica={
            <>
              El {porcentaje(participacion)} de lo que entra es de {principal}. Si ese ingreso
              faltara, lo demás cubriría el <b>{porcentaje(Math.max(0, cubreSinPrincipal))}</b>{" "}
              del costo de vida.
            </>
          }
          mueve={
            hueco <= 0 ? (
              <>Aun sin el ingreso mayor alcanzarían a cubrir lo básico. Buena posición.</>
            ) : (
              <>
                Con el colchón actual aguantarían{" "}
                <b>{Number.isFinite(aguantan) ? enMeses(Math.floor(aguantan)) : "—"}</b> sin ese
                ingreso. La protección aquí no es ganar menos: es el colchón.
              </>
            )
          }
        />
      </div>

      <details className={css.regla}>
        <summary className={css.reglaCabeza}>
          <span className={css.reglaFlecha} aria-hidden="true">
            ▸
          </span>
          Ver la regla 50 / 30 / 20
        </summary>
        <p className="nota" style={{ margin: "10px 0 14px" }}>
          Una guía general: necesidades hasta 50 %, gustos hasta 30 %, ahorro desde 20 %. Sirve
          de referencia, pero con deudas altas siempre sale en rojo; por eso aquí manda lo de
          arriba.
        </p>
        <ReglaCincuenta finanzas={f} />
      </details>
    </section>
  );
}
