import type { Movimiento } from "@/models/dominio";

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

/** "Helados y fresas" y "Helados" caen en el mismo grupo: "helados". */
function grupoDe(concepto: string): string {
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

const esGastoCorriente = (m: Movimiento) => m.clase === "gasto" && !m.extraordinario;

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
