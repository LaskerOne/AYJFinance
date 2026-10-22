import { MESES } from "@/lib/formato";
import type { CierreMensual, Decision, Movimiento } from "@/models/dominio";

/**
 * La carta del mes: lo que pasó en un mes cerrado, contado en prosa.
 *
 * Sale de las cifras congeladas del cierre (y del cierre anterior para
 * comparar), de los gastos extraordinarios y de las decisiones del mes. No
 * opina sin datos: cada frase se apoya en un número.
 */

export interface EntradaCarta {
  hogar: string;
  cierre: CierreMensual;
  anterior: CierreMensual | null;
  movimientos: Movimiento[];
  decisiones: Decision[];
  /** Lo más importante que el oráculo ve hoy, para cerrar la carta. */
  consejo: string | null;
  etiqueta: (c: string) => string;
  $: (n: number) => string;
}

export interface Carta {
  titulo: string;
  parrafos: string[];
}

const mesDe = (periodo: string) => MESES[Number(periodo.slice(5, 7)) - 1];

export function escribirCarta(e: EntradaCarta): Carta {
  const { cierre: c, anterior: a, $ } = e;
  const mes = mesDe(c.periodo);
  const siguiente = MESES[Number(c.periodo.slice(5, 7)) % 12];
  const salidas = Number(c.gastos) + Number(c.cuotas);
  const ahorro = Number(c.ahorro);
  const parrafos: string[] = [];

  // 1 · El balance.
  let balance = `${mes.charAt(0).toUpperCase() + mes.slice(1)} cerró con ${$(Number(c.ingresos))} de ingresos y ${$(salidas)} de salidas entre gastos y cuotas: `;
  balance += ahorro >= 0 ? `les quedaron ${$(ahorro)}.` : `faltaron ${$(-ahorro)}, que salieron de ahorros o de deuda.`;
  if (a) {
    const antes = Number(a.ahorro);
    const diferencia = ahorro - antes;
    if (Math.abs(diferencia) >= 1000) {
      balance += ` Es ${diferencia > 0 ? "mejor" : "peor"} que ${mesDe(a.periodo)}, cuando ${antes >= 0 ? `quedaron ${$(antes)}` : `faltaron ${$(-antes)}`}.`;
    }
  }
  parrafos.push(balance);

  // 2 · En qué se fue.
  const cats = Object.entries(c.por_categoria ?? {}).map(([k, v]) => [k, Number(v)] as const).filter(([, v]) => v > 0);
  const totalCats = cats.reduce((s, [, v]) => s + v, 0);
  if (cats.length > 0 && totalCats > 0) {
    const [top, valorTop] = [...cats].sort((x, y) => y[1] - x[1])[0];
    let gasto = `Lo que más pesó fue ${e.etiqueta(top).toLowerCase()}: ${$(valorTop)}, el ${Math.round((valorTop / totalCats) * 100)} % del gasto.`;
    if (a) {
      const previo = a.por_categoria ?? {};
      const cambios = cats
        .map(([k, v]) => ({ k, v, antes: Number((previo as Record<string, number>)[k] ?? 0) }))
        .filter((x) => x.antes > 0)
        .map((x) => ({ ...x, delta: x.v - x.antes }))
        .sort((x, y) => Math.abs(y.delta) - Math.abs(x.delta));
      const mayor = cambios[0];
      if (mayor && Math.abs(mayor.delta) >= 50_000) {
        gasto += ` La que más cambió frente a ${mesDe(a.periodo)} fue ${e.etiqueta(mayor.k).toLowerCase()}: ${mayor.delta > 0 ? "subió" : "bajó"} de ${$(mayor.antes)} a ${$(mayor.v)}.`;
      }
    }
    const extra = e.movimientos.filter((m) => m.clase === "gasto" && m.extraordinario);
    if (extra.length > 0) {
      const total = extra.reduce((s, m) => s + Number(m.monto), 0);
      const mayorExtra = [...extra].sort((x, y) => Number(y.monto) - Number(x.monto))[0];
      gasto += ` Ahí entran ${extra.length === 1 ? "un gasto extraordinario" : `${extra.length} gastos extraordinarios`} por ${$(total)}${extra.length > 1 ? `, el mayor «${mayorExtra.concepto}»` : `: «${mayorExtra.concepto}»`}.`;
    }
    parrafos.push(gasto);
  }

  // 3 · Deuda y patrimonio.
  const deuda = Number(c.deuda_total);
  let patrimonio = "";
  if (a) {
    const cambio = deuda - Number(a.deuda_total);
    patrimonio =
      cambio < -1000
        ? `La deuda bajó ${$(-cambio)}: quedó en ${$(deuda)}.`
        : cambio > 1000
          ? `La deuda subió ${$(cambio)}: quedó en ${$(deuda)}. Vale la pena revisar por qué.`
          : `La deuda se mantuvo en ${$(deuda)}.`;
  } else if (deuda > 0) {
    patrimonio = `Cerraron el mes debiendo ${$(deuda)}.`;
  }
  if (Number(c.activos_total ?? 0) > 0) {
    const neto = Number(c.activos_total) - deuda;
    const netoAntes = a && Number(a.activos_total ?? 0) > 0 ? Number(a.activos_total) - Number(a.deuda_total) : null;
    patrimonio += ` Su patrimonio neto quedó en ${$(neto)}${netoAntes !== null ? `, ${neto >= netoAntes ? `${$(neto - netoAntes)} más` : `${$(netoAntes - neto)} menos`} que el mes anterior` : ""}.`;
  }
  if (c.puntaje !== null && c.puntaje !== undefined) {
    const p = Number(c.puntaje);
    const pAntes = a?.puntaje !== null && a?.puntaje !== undefined ? Number(a.puntaje) : null;
    patrimonio += ` El puntaje de salud cerró en ${p} de 100${pAntes !== null && pAntes !== p ? ` (${p > pAntes ? "+" : "−"}${Math.abs(p - pAntes)})` : ""}.`;
  }
  if (patrimonio) parrafos.push(patrimonio.trim());

  // 4 · Lo que acordaron.
  if (e.decisiones.length > 0) {
    const cumplidas = e.decisiones.filter((d) => d.cumplida);
    const pendiente = e.decisiones.find((d) => !d.cumplida);
    let acuerdos =
      cumplidas.length === e.decisiones.length
        ? `Cumplieron todo lo que acordaron: ${e.decisiones.length} ${e.decisiones.length === 1 ? "decisión" : "decisiones"}. Eso es lo que más cuenta.`
        : `De ${e.decisiones.length} ${e.decisiones.length === 1 ? "decisión" : "decisiones"} cumplieron ${cumplidas.length}.`;
    if (pendiente && cumplidas.length < e.decisiones.length) acuerdos += ` Quedó pendiente «${pendiente.texto}».`;
    parrafos.push(acuerdos);
  }

  // 5 · Lo que sigue.
  if (e.consejo) parrafos.push(`Para ${siguiente}, lo más importante: ${e.consejo.charAt(0).toLowerCase() + e.consejo.slice(1)}.`);

  return { titulo: `La carta de ${mes}`, parrafos };
}
