import type { GastoPresupuesto, Movimiento } from "@/models/dominio";
import { gastoMensual } from "@/lib/calculos";
import { caeEn, esPuntual } from "@/lib/proyeccion";

/**
 * Los fijos del mes: qué gastos fijos del presupuesto tocan en un mes dado,
 * cuáles ya están registrados como movimiento y cuáles parecen haberse
 * digitado a mano sin el vínculo. Es la base del panel que los registra con
 * un clic.
 */

export interface FijoDelMes {
  gasto: GastoPresupuesto;
  /** Lo que se paga ese mes: el ciclo entero si es periódico con mes de pago,
   *  o el equivalente mensual (dos quincenas, por ejemplo). */
  monto: number;
  /** Fecha propuesta para el movimiento (YYYY-MM-DD). */
  fecha: string;
  /** El movimiento que lo registró, si ya está. */
  registrado: Movimiento | null;
  /** Un movimiento sin vínculo que parece ser este pago: mismo mes, misma
   *  categoría y concepto o monto parecidos. Evita duplicar lo que ya
   *  digitaron a mano antes de existir la lista. */
  parecido: Movimiento | null;
}

export interface FijosDelMes {
  fijos: FijoDelMes[];
  /** Fijos periódicos (bimestral, anual…) sin mes de pago: no se sabe en qué
   *  mes tocan, así que no entran a la lista. */
  sinMes: number;
}

/** Últimos días de cada mes: un día de pago 31 cae el 30 o el 28. */
function fechaDelMes(periodo: string, dia: number): string {
  const [a, m] = periodo.split("-").map(Number);
  const ultimo = new Date(a, m, 0).getDate();
  return `${periodo}-${String(Math.min(dia, ultimo)).padStart(2, "0")}`;
}

/** Minúsculas sin tildes ni signos: "Energía (EPM)" → "energia epm". */
function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function seParecen(g: GastoPresupuesto, monto: number, m: Movimiento): boolean {
  if (m.clase !== "gasto" || m.categoria !== g.categoria) return false;
  const a = normalizar(g.concepto);
  const b = normalizar(m.concepto);
  const mismoConcepto = a.length >= 3 && b.length >= 3 && (a.includes(b) || b.includes(a));
  const mismoMonto = monto > 0 && Math.abs(Number(m.monto) - monto) <= monto * 0.01;
  return mismoConcepto || mismoMonto;
}

/**
 * @param periodo Mes a revisar, "YYYY-MM".
 * @param hoy Fecha de hoy "YYYY-MM-DD": en el mes en curso, un fijo sin día
 *            de pago se propone con la fecha de hoy; en otro mes, el día 1.
 */
export function fijosDelMes(
  gastos: GastoPresupuesto[],
  movimientos: Movimiento[],
  periodo: string,
  hoy: string,
): FijosDelMes {
  const mes = Number(periodo.slice(5, 7));
  const delMes = movimientos.filter((m) => m.fecha.startsWith(periodo));
  const fijos = gastos.filter((g) => g.tipo === "fijo" && Number(g.monto) > 0);

  const sinMes = fijos.filter(
    (g) => g.frecuencia !== "mensual" && g.frecuencia !== "quincenal" && !g.mes_pago,
  ).length;

  const tocan = fijos.filter(
    (g) => g.frecuencia === "mensual" || g.frecuencia === "quincenal" || caeEn(g, mes),
  );

  // Un movimiento a mano solo puede «parecerse» a un fijo: el primero que lo
  // reclama se lo queda, para no sugerir el mismo pago dos veces.
  const reclamados = new Set<string>();

  const lista = tocan.map((g): FijoDelMes => {
    const monto = esPuntual(g) ? Number(g.monto) : gastoMensual(g);
    const registrado = delMes.find((m) => m.gasto_id === g.id) ?? null;
    let parecido: Movimiento | null = null;
    if (!registrado) {
      parecido =
        delMes.find((m) => !m.gasto_id && !reclamados.has(m.id) && seParecen(g, monto, m)) ?? null;
      if (parecido) reclamados.add(parecido.id);
    }
    const dia = g.dia_pago ?? (hoy.startsWith(periodo) ? Number(hoy.slice(8, 10)) : 1);
    return { gasto: g, monto, fecha: fechaDelMes(periodo, dia), registrado, parecido };
  });

  // Por fecha de pago; los ya registrados al final, que ya no piden nada.
  lista.sort(
    (x, y) =>
      Number(Boolean(x.registrado)) - Number(Boolean(y.registrado)) ||
      x.fecha.localeCompare(y.fecha) ||
      x.gasto.orden - y.gasto.orden,
  );

  return { fijos: lista, sinMes };
}
