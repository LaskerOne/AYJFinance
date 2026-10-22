import { useMemo, useState } from "react";
import { BarrasRanking } from "@/components/charts/BarrasRanking";
import { Cifra } from "@/components/ui/Cifra";
import { Estado } from "@/components/ui/Etiqueta";
import { FilaKpi } from "@/components/ui/Kpi";
import { useHogar } from "@/contexts/HogarContext";
import { useFinanzas } from "@/hooks/useFinanzas";
import { useMoneda } from "@/hooks/useMoneda";
import { simularDeudas } from "@/lib/deudas";
import { gastosHormiga, pagosQueSeRepiten } from "@/lib/habitos";
import { aNumero, enMeses, porcentaje } from "@/lib/formato";
import css from "./Habitos.module.css";

const CLAVE_UMBRAL = "cuentas-de-dos:umbral-hormiga";
const UMBRAL_INICIAL = 50_000;

function leerUmbral(): number {
  try {
    const v = Number(localStorage.getItem(CLAVE_UMBRAL));
    return v >= 10_000 && v <= 200_000 ? v : UMBRAL_INICIAL;
  } catch {
    return UMBRAL_INICIAL;
  }
}

/**
 * Los hábitos que no se ven en un mes cualquiera: las compras pequeñas que
 * sumadas pesan, y los pagos que se repiten solos. Todo se calcula con los
 * movimientos reales y se traduce a un año, que es donde se nota.
 */
export function Habitos() {
  const { movimientos, deudas, hogar } = useHogar();
  const f = useFinanzas();
  const { $ } = useMoneda();

  const [umbral, setUmbralEstado] = useState(leerUmbral);
  const [recorte, setRecorte] = useState(50);

  const setUmbral = (v: number) => {
    setUmbralEstado(v);
    try {
      localStorage.setItem(CLAVE_UMBRAL, String(v));
    } catch {
      // Sin almacenamiento el umbral igual aplica durante esta visita.
    }
  };

  const h = useMemo(() => gastosHormiga(movimientos, umbral), [movimientos, umbral]);
  const repetidos = useMemo(() => pagosQueSeRepiten(movimientos), [movimientos]);

  const libera = (h.mensual * recorte) / 100;
  const estrategia = hogar?.estrategia_deuda ?? "avalancha";
  const abonoActual = Number(hogar?.abono_extra ?? 0);
  const hayDeuda = deudas.some((d) => Number(d.saldo) > 0);

  const { actual, conRecorte } = useMemo(
    () => ({
      actual: simularDeudas(deudas, abonoActual, estrategia, true),
      conRecorte: simularDeudas(deudas, abonoActual + libera, estrategia, true),
    }),
    [deudas, abonoActual, libera, estrategia],
  );
  const comparable = hayDeuda && !actual.estancado && !conRecorte.estancado;
  const mesesGanados = comparable ? Math.max(0, actual.meses - conRecorte.meses) : 0;
  const interesesEvitados = comparable ? Math.max(0, actual.intereses - conRecorte.intereses) : 0;

  const totalRepetidos = repetidos.reduce((s, r) => s + r.mensual, 0);

  return (
    <>
      <section className="panel hero heroGrid">
        <div className="heroCifras">
          <span className="eyebrow">Gastos hormiga · al mes</span>
          <span className="heroNumero heroPos">
            <Cifra valor={h.mensual} formato={$} />
          </span>
          <span className="heroDetalle">
            {h.compras} compras de hasta {$(umbral)} en los últimos {h.dias} días, llevadas a un
            mes promedio.
          </span>
          <div className="heroChips">
            <Estado tono="neutro">{$(h.anual)} al año</Estado>
            {f.deudaTotal > 0 && h.anual > 0 && (
              <Estado tono="neutro">= {porcentaje(h.anual / f.deudaTotal)} de su deuda</Estado>
            )}
            {f.gastos > 0 && h.mensual > 0 && (
              <Estado tono={h.mensual / f.gastos > 0.15 ? "warn" : "ok"}>
                {porcentaje(h.mensual / f.gastos)} del gasto presupuestado
              </Estado>
            )}
          </div>
        </div>
        <div className="heroGrafico">
          <span className="eyebrow">En qué se va, de mayor a menor</span>
          {h.grupos.length > 0 ? (
            <BarrasRanking
              filas={h.grupos.slice(0, 7).map((g) => ({
                nombre: `${g.nombre} ×${g.veces}`,
                valor: g.mensual,
              }))}
              total={h.mensual}
              etiqueta="Gastos hormiga por concepto, promedio mensual"
            />
          ) : (
            <p className="vacio">
              Sin compras pequeñas registradas en los últimos tres meses con este umbral.
            </p>
          )}
        </div>
      </section>

      <section className="panel">
        <header>
          <div>
            <h2>¿Qué cuenta como gasto pequeño?</h2>
            <p className="nota">
              Cada hogar tiene su medida. Muevan el límite y la cuenta de arriba se recalcula.
            </p>
          </div>
        </header>
        <div className={css.deslizador}>
          <input
            type="range"
            aria-label="Monto máximo de un gasto hormiga"
            min={10_000}
            max={200_000}
            step={5_000}
            value={umbral}
            onChange={(e) => setUmbral(aNumero(e.target.value))}
            style={{ ["--lleno" as string]: `${((umbral - 10_000) / 190_000) * 100}%` }}
          />
          <span className={css.valor}>hasta {$(umbral)}</span>
        </div>
      </section>

      {h.mensual > 0 && (
        <section className="panel">
          <header>
            <div>
              <h2>Si recortan una parte</h2>
              <p className="nota">
                No se trata de no darse gustos: una compra de {$(Math.min(umbral, 20_000))} no
                pesa, pero repetida todo el año sí. Elijan cuánto recortar y miren a dónde
                llegaría esa plata.
              </p>
            </div>
          </header>

          <div className={css.deslizador}>
            <input
              type="range"
              aria-label="Porcentaje de gastos hormiga a recortar"
              min={0}
              max={100}
              step={5}
              value={recorte}
              onChange={(e) => setRecorte(aNumero(e.target.value))}
              style={{ ["--lleno" as string]: `${recorte}%` }}
            />
            <span className={css.valor}>recortar el {recorte} %</span>
          </div>

          <FilaKpi
            columnas={3}
            datos={
              hayDeuda
                ? [
                    {
                      etiqueta: "Se liberan al mes",
                      valor: <Cifra valor={libera} formato={$} />,
                      detalle: `${$(libera * 12)} al año`,
                    },
                    {
                      etiqueta: "Libres de deudas antes",
                      valor: comparable ? enMeses(mesesGanados) : "—",
                      detalle: comparable
                        ? `Si se abonan a la deuda: ${enMeses(conRecorte.meses)} en vez de ${enMeses(actual.meses)}`
                        : "El plan actual no baja el saldo",
                      tono: "positivo",
                    },
                    {
                      etiqueta: "Intereses que no pagan",
                      valor: comparable ? <Cifra valor={interesesEvitados} formato={$} /> : "—",
                      detalle: "En todo el recorrido del plan",
                      tono: "positivo",
                    },
                  ]
                : [
                    {
                      etiqueta: "Se liberan al mes",
                      valor: <Cifra valor={libera} formato={$} />,
                      detalle: `${$(libera * 12)} al año`,
                    },
                    {
                      etiqueta: "Meses de colchón por año",
                      valor:
                        f.costoVida > 0
                          ? `${((libera * 12) / f.costoVida).toFixed(1).replace(".", ",")}`
                          : "—",
                      detalle: "Si se van al fondo de emergencia",
                      tono: "positivo",
                    },
                    {
                      etiqueta: "En cinco años",
                      valor: <Cifra valor={libera * 60} formato={$} />,
                      detalle: "Sin contar rendimientos",
                    },
                  ]
            }
          />
        </section>
      )}

      <section className="panel">
        <header>
          <div>
            <h2>Pagos que se repiten</h2>
            <p className="nota">
              El mismo concepto, en dos o más meses, por montos parecidos: suscripciones, planes y
              mensualidades. Se renuevan solos, así que vale la pena revisar si todos siguen
              valiendo lo que cuestan.
            </p>
          </div>
          {totalRepetidos > 0 && (
            <span className="eyebrow">
              {$(totalRepetidos)} al mes · {$(totalRepetidos * 12)} al año
            </span>
          )}
        </header>

        {repetidos.length === 0 ? (
          <p className="vacio">
            Todavía no hay pagos repetidos: aparecen cuando el mismo concepto se registra en al
            menos dos meses.
          </p>
        ) : (
          <div className="tablaScroll">
            <table className="datos" style={{ minWidth: 480 }}>
              <thead>
                <tr>
                  <th>Concepto</th>
                  <th className="r">Meses vistos</th>
                  <th className="r">Al mes</th>
                  <th className="r">Al año</th>
                </tr>
              </thead>
              <tbody>
                {repetidos.map((r) => (
                  <tr key={r.concepto}>
                    <td style={{ padding: "9px 8px" }}>{r.concepto}</td>
                    <td className="r num">{r.meses}</td>
                    <td className="r num">{$(r.mensual)}</td>
                    <td className="r num" style={{ color: "var(--a-ink)", fontWeight: 600 }}>
                      {$(r.anual)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
