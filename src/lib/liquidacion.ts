import type { Movimiento, Reparto } from "@/models/dominio";

/**
 * Quién le debe a quién por el bote común en un mes.
 *
 * Cada gasto marcado como compartido lo pagó uno de los dos; según el
 * reparto del hogar (proporcional al ingreso o mitad y mitad) a cada uno le
 * tocaba una parte. La diferencia entre lo que pagó y lo que le tocaba es su
 * saldo. Las transferencias de ese mes ("Liquidación del bote") lo van
 * cancelando. Los gastos compartidos sin "lo pagó" no se pueden atribuir y
 * se cuentan aparte para que alguien los complete.
 */
export interface Liquidacion {
  totalCompartido: number;
  pagadoA: number;
  pagadoB: number;
  tocaA: number;
  tocaB: number;
  /** Transferido de A a B y de B a A dentro del mes. */
  transferidoAB: number;
  transferidoBA: number;
  /** Positivo: B le debe a A. Negativo: A le debe a B. */
  neto: number;
  sinAtribuir: number;
  sinAtribuirMonto: number;
  /** Fracción del bote que le toca a A según el reparto. */
  parteA: number;
}

export function liquidarMes(
  delMes: Movimiento[],
  idA: string | null,
  idB: string | null,
  reparto: Reparto,
  participacionA: number,
): Liquidacion {
  const parteA = reparto === "mitad" ? 0.5 : participacionA;

  const compartidos = delMes.filter((m) => m.clase === "gasto" && m.compartido);
  const atribuibles = compartidos.filter(
    (m) => m.pagado_por && (m.pagado_por === idA || m.pagado_por === idB),
  );
  const sinAtribuirFilas = compartidos.filter((m) => !atribuibles.includes(m));

  const suma = (filas: Movimiento[]) => filas.reduce((s, m) => s + Number(m.monto), 0);
  const pagadoA = suma(atribuibles.filter((m) => m.pagado_por === idA));
  const pagadoB = suma(atribuibles.filter((m) => m.pagado_por === idB));
  const totalCompartido = pagadoA + pagadoB;
  const tocaA = totalCompartido * parteA;
  const tocaB = totalCompartido - tocaA;

  const transferencias = delMes.filter((m) => m.clase === "transferencia");
  const transferidoAB = suma(transferencias.filter((m) => m.pagado_por === idA));
  const transferidoBA = suma(transferencias.filter((m) => m.pagado_por === idB));

  // A pagó de más → B le debe. Lo que B ya le pasó a A lo reduce; lo que A le
  // pasó a B lo aumenta.
  const neto = pagadoA - tocaA - transferidoBA + transferidoAB;

  return {
    totalCompartido,
    pagadoA,
    pagadoB,
    tocaA,
    tocaB,
    transferidoAB,
    transferidoBA,
    neto: Math.round(neto),
    sinAtribuir: sinAtribuirFilas.length,
    sinAtribuirMonto: suma(sinAtribuirFilas),
    parteA,
  };
}
