import { nombrePeriodo } from "@/lib/formato";
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

/** Último día de un mes (YYYY-MM) en YYYY-MM-DD. */
export function finDeMes(mes: string): string {
  const [a, m] = mes.split("-").map(Number);
  return `${mes}-${String(new Date(a, m, 0).getDate()).padStart(2, "0")}`;
}

export type MovimientoNuevo = Pick<
  Movimiento,
  "fecha" | "concepto" | "categoria" | "monto" | "clase" | "pagado_por" | "compartido" | "extraordinario" | "origen"
>;

/**
 * La transferencia que salda el bote de un mes. Se registra desde la pantalla
 * de movimientos y desde el consejo del oráculo; antes cada una armaba su
 * copia y una diferencia en el concepto o la fecha las habría separado sin
 * avisar.
 *
 * Si se salda el mes en curso, lleva la fecha de hoy; si es un mes pasado,
 * el último día de ese mes, para que cuente en el mes que liquida.
 */
export function movimientoDeLiquidacion(p: {
  /** Mes que se liquida, YYYY-MM. */
  mes: string;
  /** Quien debe y hace la transferencia. */
  deudor: string;
  monto: number;
  /** Fecha de hoy, YYYY-MM-DD. */
  hoy: string;
}): MovimientoNuevo {
  return {
    fecha: p.mes === p.hoy.slice(0, 7) ? p.hoy : finDeMes(p.mes),
    concepto: `Liquidación del bote · ${nombrePeriodo(`${p.mes}-01`)}`,
    categoria: "Otros",
    monto: p.monto,
    clase: "transferencia",
    pagado_por: p.deudor,
    compartido: false,
    extraordinario: false,
    origen: "manual",
  };
}
