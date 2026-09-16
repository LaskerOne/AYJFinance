import type { Deuda, EstrategiaDeuda } from "@/models/dominio";

/** Convierte una tasa efectiva anual a su equivalente mes vencido. */
export function tasaMensual(efectivaAnual: number): number {
  return Math.pow(1 + Number(efectivaAnual) / 100, 1 / 12) - 1;
}

interface DeudaSim {
  saldo: number;
  cuota: number;
  im: number;
}

export interface Simulacion {
  /** Meses hasta quedar en cero. */
  meses: number;
  /** Intereses pagados en todo el recorrido. */
  intereses: number;
  /** Saldo total al cierre de cada mes, empezando por hoy. */
  serie: number[];
  /** True si las cuotas no alcanzan a cubrir los intereses. */
  estancado: boolean;
  sinDeudas: boolean;
}

function prioritaria(items: DeudaSim[], estrategia: EstrategiaDeuda): DeudaSim | null {
  const vivas = items.filter((d) => d.saldo > 0.5);
  if (vivas.length === 0) return null;
  return vivas.reduce((mejor, d) => {
    if (estrategia === "bola") return d.saldo < mejor.saldo ? d : mejor;
    return d.im > mejor.im ? d : mejor;
  }, vivas[0]);
}

const TOPE_MESES = 600;

/**
 * Amortiza mes a mes: cobra intereses, aplica cada cuota y vuelca el
 * excedente (abono extra + cuotas que se liberan) sobre la deuda prioritaria.
 * Con `extra = 0` y sin reinversión describe el plan de "solo pagar cuotas".
 */
export function simularDeudas(
  deudas: Deuda[],
  extra: number,
  estrategia: EstrategiaDeuda,
  reinvertir: boolean,
): Simulacion {
  const items: DeudaSim[] = deudas
    .map((d) => ({ saldo: Number(d.saldo), cuota: Number(d.cuota), im: tasaMensual(d.tasa_ea) }))
    .filter((d) => d.saldo > 0.5);

  const total0 = items.reduce((s, d) => s + d.saldo, 0);
  if (items.length === 0) {
    return { meses: 0, intereses: 0, serie: [0], estancado: false, sinDeudas: true };
  }

  const presupuesto = items.reduce((s, d) => s + d.cuota, 0) + extra;
  const serie = [total0];
  let intereses = 0;
  let mes = 0;
  let estancado = false;
  let anterior = total0;

  while (items.some((d) => d.saldo > 0.5) && mes < TOPE_MESES) {
    mes += 1;
    let usado = 0;

    for (const d of items) {
      if (d.saldo <= 0.5) continue;
      const interes = d.saldo * d.im;
      intereses += interes;
      d.saldo += interes;
      const pago = Math.min(d.cuota, d.saldo);
      d.saldo -= pago;
      usado += pago;
    }

    if (reinvertir) {
      let sobra = Math.max(0, presupuesto - usado);
      let vueltas = 0;
      while (sobra > 0.5 && vueltas < 50) {
        vueltas += 1;
        const objetivo = prioritaria(items, estrategia);
        if (!objetivo) break;
        const pago = Math.min(sobra, objetivo.saldo);
        objetivo.saldo -= pago;
        sobra -= pago;
      }
    }

    const total = items.reduce((s, d) => s + Math.max(0, d.saldo), 0);
    serie.push(total);

    // Si el saldo no baja, la cuota no cubre ni los intereses.
    if (total >= anterior - 0.5) {
      estancado = true;
      break;
    }
    anterior = total;
  }

  return {
    meses: mes,
    intereses,
    serie,
    estancado: estancado || mes >= TOPE_MESES,
    sinDeudas: false,
  };
}

/** Ordena las deudas según la estrategia elegida: primera = a la que atacar. */
export function ordenarPorEstrategia(deudas: Deuda[], estrategia: EstrategiaDeuda): Deuda[] {
  return [...deudas]
    .filter((d) => Number(d.saldo) > 0)
    .sort((a, b) =>
      estrategia === "bola"
        ? Number(a.saldo) - Number(b.saldo)
        : tasaMensual(b.tasa_ea) - tasaMensual(a.tasa_ea),
    );
}
