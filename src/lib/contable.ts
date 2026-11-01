import type { Movimiento } from "@/models/dominio";

/**
 * El mes contable: a qué mes se atribuye un movimiento.
 *
 * El hogar cobra el 15 y el 29/30, y el pago de fin de mes en realidad paga
 * la primera quincena del mes siguiente. Con el corte de ingresos del hogar
 * (p. ej. 29), todo ingreso con fecha en o después de ese día cuenta para el
 * mes siguiente; `cuenta_para` es la excepción manual por movimiento y manda
 * sobre la regla. La fecha nunca cambia: el extracto del banco sigue
 * cuadrando. Espejo exacto de mes_contable() en la migración 0016.
 */

export function mesSiguiente(mes: string): string {
  const [a, m] = mes.split("-").map(Number);
  return m === 12 ? `${a + 1}-01` : `${a}-${String(m + 1).padStart(2, "0")}`;
}

type Atribuible = Pick<Movimiento, "fecha" | "clase"> & Pick<Partial<Movimiento>, "cuenta_para">;

/** "YYYY-MM" al que cuenta el movimiento. */
export function mesContable(m: Atribuible, corte: number | null | undefined): string {
  if (m.cuenta_para) return m.cuenta_para.slice(0, 7);
  if (m.clase === "ingreso" && corte) {
    // Si el mes no llega al día del corte (febrero con corte 29), el corte
    // es su último día: el pago de fin de mes igual se hace, solo que antes.
    const [a, mn] = m.fecha.split("-").map(Number);
    const efectivo = Math.min(corte, new Date(a, mn, 0).getDate());
    if (Number(m.fecha.slice(8, 10)) >= efectivo) return mesSiguiente(m.fecha.slice(0, 7));
  }
  return m.fecha.slice(0, 7);
}

/** True si la regla o una excepción manual lo movieron de su mes calendario. */
export function atribuidoAOtroMes(m: Atribuible, corte: number | null | undefined): boolean {
  return mesContable(m, corte) !== m.fecha.slice(0, 7);
}
