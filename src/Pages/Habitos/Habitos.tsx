import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { BarrasRanking } from "@/components/charts/BarrasRanking";
import { Cifra } from "@/components/ui/Cifra";
import { Estado } from "@/components/ui/Etiqueta";
import { FilaKpi } from "@/components/ui/Kpi";
import { useHogar } from "@/contexts/HogarContext";
import { useFinanzas } from "@/hooks/useFinanzas";
import { useHormigas } from "@/hooks/useHormigas";
import { useMoneda } from "@/hooks/useMoneda";
import { mesSiguiente } from "@/lib/contable";
import { simularDeudas } from "@/lib/deudas";
import { pagosQueSeRepiten, tendenciaHormiga } from "@/lib/habitos";
import { aNumero, enMeses, hoyISO, nombrePeriodo, porcentaje } from "@/lib/formato";
import css from "./Habitos.module.css";

function mesAnterior(mes: string): string {
  const [a, m] = mes.split("-").map(Number);
  return m === 1 ? `${a - 1}-12` : `${a}-${String(m - 1).padStart(2, "0")}`;
}

/**
 * Los hábitos que no se ven en un mes cualquiera: las compras pequeñas que
 * sumadas pesan, y los pagos que se repiten solos. Las hormigas se miran mes
 * a mes, con el total real de cada uno; la tendencia larga vive en Histórico.
 */
export function Habitos() {
  const { movimientos, deudas, hogar } = useHogar();
  const f = useFinanzas();
  const { $ } = useMoneda();
  const { umbral, setUmbral, serie } = useHormigas();

  const hoy = hoyISO();
  const mesHoy = hoy.slice(0, 7);
  const primerMes = serie[0]?.mes ?? mesHoy;
  const [mes, setMes] = useState(mesHoy);
  const [recorte, setRecorte] = useState(50);

  const h = serie.find((x) => x.mes === mes) ?? { mes, compras: 0, total: 0, grupos: [] };
  const repetidos = useMemo(() => pagosQueSeRepiten(movimientos), [movimientos]);

  // El mes en curso va a medias: para el recorte y el año se usa a dónde
  // llegaría al ritmo de hoy, no lo que lleva. Un mes terminado es su total.
  const enCurso = mes === mesHoy;
  const [anio, numMes] = mes.split("-").map(Number);
  const diasDelMes = new Date(anio, numMes, 0).getDate();
  const diaHoy = Number(hoy.slice(8, 10));
  const proyectado = enCurso ? (h.total / diaHoy) * diasDelMes : h.total;
  const tendencia = tendenciaHormiga(serie, mes, proyectado);

  const libera = (proyectado * recorte) / 100;
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
          <div className={css.navegaMes}>
            <button
              className="pill"
              onClick={() => setMes(mesAnterior(mes))}
              aria-label="Mes anterior"
              disabled={mes <= primerMes}
            >
              ←
            </button>
            <span className={css.mesActual}>{nombrePeriodo(`${mes}-01`)}</span>
            <button
              className="pill"
              onClick={() => setMes(mesSiguiente(mes))}
              aria-label="Mes siguiente"
              disabled={mes >= mesHoy}
            >
              →
            </button>
          </div>
          <span className="eyebrow">Gastos hormiga del mes</span>
          <span className="heroNumero heroPos">
            <Cifra valor={h.total} formato={$} />
          </span>
          <span className="heroDetalle">
            {h.compras} {h.compras === 1 ? "compra" : "compras"} de hasta {$(umbral)}
            {enCurso ? ` en lo que va del mes (día ${diaHoy} de ${diasDelMes}).` : " en todo el mes."}
          </span>
          <div className="heroChips">
            {tendencia && (
              <Estado
                tono={
                  tendencia.tendencia === "sube" ? "warn" : tendencia.tendencia === "baja" ? "ok" : "neutro"
                }
              >
                {tendencia.cambio >= 0 ? "↑" : "↓"} {porcentaje(Math.abs(tendencia.cambio))}{" "}
                {enCurso ? "proyectado contra" : "contra"} los meses anteriores
              </Estado>
            )}
            {enCurso && h.total > 0 && (
              <Estado tono="neutro">A este ritmo cierra en {$(proyectado)}</Estado>
            )}
            {proyectado > 0 && <Estado tono="neutro">{$(proyectado * 12)} al año</Estado>}
            {f.gastos > 0 && proyectado > 0 && (
              <Estado tono={proyectado / f.gastos > 0.15 ? "warn" : "ok"}>
                {porcentaje(proyectado / f.gastos)} del gasto presupuestado
              </Estado>
            )}
          </div>
        </div>
        <div className="heroGrafico">
          <span className="eyebrow">En qué se fue, de mayor a menor</span>
          {/* El oráculo etiqueta cada compra por lo que es: todas las formas
              de comer por fuera caen en un solo grupo aunque el concepto y
              el monto cambien. */}
          {h.grupos.length > 0 ? (
            <BarrasRanking
              filas={h.grupos.slice(0, 7).map((g) => ({
                nombre: `${g.nombre} ×${g.veces}`,
                valor: g.total,
              }))}
              total={h.total}
              etiqueta={`Gastos hormiga por concepto en ${nombrePeriodo(`${mes}-01`)}`}
            />
          ) : (
            <p className="vacio">Sin compras pequeñas registradas este mes con este umbral.</p>
          )}
          <p className={css.pieHero}>
            La tendencia, mes contra mes, está en <Link to="/historico">Histórico</Link>.
          </p>
        </div>
      </section>

      <section className="panel">
        <header>
          <div>
            <h2>¿Qué cuenta como gasto pequeño?</h2>
            <p className="nota">
              Cada hogar tiene su medida. Muevan el límite y la cuenta de arriba se recalcula. El
              oráculo agrupa las compras por lo que son (comidas, antojos, transporte…), y lo que
              registran desde la lista de pagos del mes no entra aquí: eso es gasto planeado, no
              un hábito.
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

      {proyectado > 0 && (
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
