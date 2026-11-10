import type { Movimiento } from "@/models/dominio";
import { etiquetaDe } from "@/lib/etiquetas";
import { mesContable, mesSiguiente } from "@/lib/contable";

/**
 * Hábitos de gasto a partir de los movimientos reales.
 *
 * Gastos hormiga: compras pequeñas y frecuentes que por separado no se
 * sienten. Se miran los últimos tres meses calendario (incluido el actual,
 * aunque vaya a medias) y se llevan a un promedio mensual dividiendo por los
 * días realmente cubiertos, para que un mes incompleto no los subestime.
 *
 * Pagos que se repiten: el mismo concepto pagado en dos o más meses distintos
 * por montos parecidos. Suelen ser suscripciones, planes y mensualidades.
 */

const VACIAS = new Set(["pago", "compra", "pse", "de", "del", "la", "el", "los", "las", "en", "por", "con", "y"]);

export function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Primero la etiqueta del oráculo ("Comidas por fuera" agrupa almuerzos,
 *  hamburguesas y domicilios aunque el concepto cambie); si ninguna encaja,
 *  la primera palabra con sustancia: "Helados y fresas" → "helados". */
function grupoDe(concepto: string): string {
  const etiqueta = etiquetaDe(concepto);
  if (etiqueta) return etiqueta;
  const palabras = normalizar(concepto).split(" ");
  return palabras.find((p) => p.length >= 3 && !/^\d+$/.test(p) && !VACIAS.has(p)) ?? "otros";
}

/** Fecha local en YYYY-MM-DD (toISOString usaría UTC y en la noche colombiana ya sería mañana). */
function isoLocal(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function capitalizar(t: string): string {
  return t.charAt(0).toUpperCase() + t.slice(1);
}

// Lo registrado desde la lista de pagos del mes (fijos y extras) es gasto
// planeado, no un hábito: no cuenta ni en hormigas ni en repetidos.
const esGastoCorriente = (m: Movimiento) =>
  m.clase === "gasto" && !m.extraordinario && !m.gasto_id && !m.pendiente_id;

export interface GrupoHormiga {
  nombre: string;
  veces: number;
  total: number;
  mensual: number;
}

export interface Hormiga {
  compras: number;
  total: number;
  mensual: number;
  anual: number;
  dias: number;
  grupos: GrupoHormiga[];
}

export function gastosHormiga(movimientos: Movimiento[], umbral: number, hoy = new Date()): Hormiga {
  const inicio = new Date(hoy.getFullYear(), hoy.getMonth() - 2, 1);
  const inicioIso = isoLocal(inicio);
  const hoyIso = isoLocal(hoy);

  const ventana = movimientos.filter(
    (m) => esGastoCorriente(m) && m.fecha >= inicioIso && m.fecha <= hoyIso,
  );
  // Si los registros empiezan después del inicio de la ventana, se cuenta
  // desde el primero: no hay que promediar contra días sin datos.
  const primero = ventana.reduce((min, m) => (m.fecha < min ? m.fecha : min), hoyIso);
  const desde = new Date(`${primero > inicioIso ? primero : inicioIso}T00:00:00`);
  const hoyMedianoche = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
  const dias = Math.max(1, Math.round((hoyMedianoche.getTime() - desde.getTime()) / 86_400_000) + 1);
  const factor = 30.44 / dias;

  // Un pago fijo que se repite cada mes (el plan del celular) no es un gasto
  // hormiga aunque sea pequeño: va en su propia lista.
  const fijos = new Set(pagosQueSeRepiten(movimientos).map((r) => normalizar(r.concepto)));
  const pequenas = ventana.filter(
    (m) => Number(m.monto) <= umbral && !fijos.has(normalizar(m.concepto)),
  );
  const porGrupo = new Map<string, { veces: number; total: number }>();
  for (const m of pequenas) {
    const g = grupoDe(m.concepto);
    const acc = porGrupo.get(g) ?? { veces: 0, total: 0 };
    acc.veces += 1;
    acc.total += Number(m.monto);
    porGrupo.set(g, acc);
  }

  const total = pequenas.reduce((s, m) => s + Number(m.monto), 0);
  const mensual = total * factor;
  return {
    compras: pequenas.length,
    total,
    mensual,
    anual: mensual * 12,
    dias,
    grupos: [...porGrupo.entries()]
      .map(([nombre, v]) => ({ nombre: capitalizar(nombre), ...v, mensual: v.total * factor }))
      .sort((a, b) => b.total - a.total),
  };
}

// --- mes a mes -------------------------------------------------------------
// El promedio de tres meses sirve para dimensionar, pero esconde lo que pasó:
// un mes malo se diluye entre dos buenos. Mes a mes, cada compra cuenta en el
// mes contable donde cayó, con su total real y sin proyecciones, y la serie
// completa es la que deja ver si la costumbre va subiendo o bajando.

export interface GrupoHormigaMes {
  nombre: string;
  veces: number;
  total: number;
}

export interface HormigaMes {
  /** "YYYY-MM" contable. */
  mes: string;
  compras: number;
  total: number;
  grupos: GrupoHormigaMes[];
}

/** Las compras hormiga de cada mes con movimientos, del más viejo al más nuevo.
 *  Los meses intermedios sin compras pequeñas aparecen en cero: un mes limpio
 *  también es dato de la tendencia. */
export function hormigasPorMes(
  movimientos: Movimiento[],
  umbral: number,
  corte: number | null | undefined,
): HormigaMes[] {
  const fijos = new Set(pagosQueSeRepiten(movimientos).map((r) => normalizar(r.concepto)));
  const porMes = new Map<string, Map<string, GrupoHormigaMes>>();
  const meses = new Set<string>();

  for (const m of movimientos) {
    if (!esGastoCorriente(m)) continue;
    const mes = mesContable(m, corte);
    meses.add(mes);
    if (Number(m.monto) > umbral || fijos.has(normalizar(m.concepto))) continue;
    const grupos = porMes.get(mes) ?? new Map<string, GrupoHormigaMes>();
    const nombre = capitalizar(grupoDe(m.concepto));
    const g = grupos.get(nombre) ?? { nombre, veces: 0, total: 0 };
    g.veces += 1;
    g.total += Number(m.monto);
    grupos.set(nombre, g);
    porMes.set(mes, grupos);
  }
  if (meses.size === 0) return [];

  const ordenados = [...meses].sort();
  const salida: HormigaMes[] = [];
  for (let mes = ordenados[0]; mes <= ordenados[ordenados.length - 1]; mes = mesSiguiente(mes)) {
    const grupos = [...(porMes.get(mes)?.values() ?? [])].sort((a, b) => b.total - a.total);
    salida.push({
      mes,
      compras: grupos.reduce((s, g) => s + g.veces, 0),
      total: grupos.reduce((s, g) => s + g.total, 0),
      grupos,
    });
  }
  return salida;
}

export type Tendencia = "baja" | "sube" | "estable";

/** Cómo viene el mes contra el promedio de los anteriores (hasta tres).
 *  ±10 % se considera estable: unas cuantas compras de diferencia no son
 *  una tendencia. Un mes a medias se compara con `totalDelMes` (su
 *  proyección al cierre), no con lo que lleva: si no, siempre "bajaría".
 *  Null si no hay meses previos con qué comparar. */
export function tendenciaHormiga(
  serie: HormigaMes[],
  mes: string,
  totalDelMes?: number,
): { tendencia: Tendencia; promedioAnterior: number; cambio: number } | null {
  const i = serie.findIndex((h) => h.mes === mes);
  if (i <= 0) return null;
  const previos = serie.slice(Math.max(0, i - 3), i);
  const promedioAnterior = previos.reduce((s, h) => s + h.total, 0) / previos.length;
  if (promedioAnterior <= 0) return null;
  const cambio = ((totalDelMes ?? serie[i].total) - promedioAnterior) / promedioAnterior;
  const tendencia: Tendencia = cambio > 0.1 ? "sube" : cambio < -0.1 ? "baja" : "estable";
  return { tendencia, promedioAnterior, cambio };
}

export interface PagoRepetido {
  concepto: string;
  meses: number;
  mensual: number;
  anual: number;
}

export function pagosQueSeRepiten(movimientos: Movimiento[]): PagoRepetido[] {
  const porConcepto = new Map<string, { nombre: string; porMes: Map<string, number> }>();
  for (const m of movimientos) {
    if (!esGastoCorriente(m)) continue;
    const clave = normalizar(m.concepto);
    if (!clave) continue;
    const acc = porConcepto.get(clave) ?? { nombre: m.concepto.trim(), porMes: new Map() };
    const mes = m.fecha.slice(0, 7);
    acc.porMes.set(mes, (acc.porMes.get(mes) ?? 0) + Number(m.monto));
    porConcepto.set(clave, acc);
  }

  const salida: PagoRepetido[] = [];
  for (const { nombre, porMes } of porConcepto.values()) {
    if (porMes.size < 2) continue;
    const montos = [...porMes.values()].sort((a, b) => a - b);
    const mediana = montos[Math.floor(montos.length / 2)];
    // Montos parecidos (±20 %): una cuota fija, no una compra que se repitió de casualidad.
    if (!montos.every((v) => Math.abs(v - mediana) <= mediana * 0.2)) continue;
    const mensual = montos.reduce((s, v) => s + v, 0) / montos.length;
    salida.push({ concepto: nombre, meses: porMes.size, mensual, anual: mensual * 12 });
  }
  return salida.sort((a, b) => b.mensual - a.mensual);
}
