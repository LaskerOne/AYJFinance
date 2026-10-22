import { mesesConSuCuota, tasaMensual } from "@/lib/deudas";
import type { Deuda } from "@/models/dominio";

/**
 * Matemática de crédito para el laboratorio. Todo en tasas mes vencido
 * internamente; hacia afuera, efectivo anual (E.A.), que es la única forma
 * honesta de comparar ofertas que vienen anunciadas de maneras distintas.
 */

const TOPE = 600;

// --- conversión de tasas ------------------------------------------------------

export type FormaTasa = "ea" | "mv" | "nmv" | "ntv";

export const NOMBRE_FORMA: Record<FormaTasa, string> = {
  ea: "Efectiva anual (E.A.)",
  mv: "Mes vencido (M.V.)",
  nmv: "Nominal mensual vencida (N.M.V.)",
  ntv: "Nominal trimestral vencida (N.T.V.)",
};

/** Cualquier forma (en %) → E.A. (en %). */
export function aEA(valor: number, forma: FormaTasa): number {
  const v = valor / 100;
  switch (forma) {
    case "ea":
      return valor;
    case "mv":
      return (Math.pow(1 + v, 12) - 1) * 100;
    case "nmv":
      return (Math.pow(1 + v / 12, 12) - 1) * 100;
    case "ntv":
      return (Math.pow(1 + v / 4, 4) - 1) * 100;
  }
}

/** E.A. (en %) → todas las formas (en %). */
export function desdeEA(ea: number): Record<FormaTasa, number> {
  const mv = tasaMensual(ea);
  const tv = Math.pow(1 + ea / 100, 1 / 4) - 1;
  return { ea, mv: mv * 100, nmv: mv * 12 * 100, ntv: tv * 4 * 100 };
}

// --- amortización ------------------------------------------------------------------

export interface Amortizacion {
  meses: number;
  intereses: number;
  cargos: number;
  /** Todo lo que sale del bolsillo: cuotas + cargos. */
  totalPagado: number;
  /** Pago de cada mes (cuota real + cargos), para calcular el costo efectivo. */
  pagos: number[];
  estancado: boolean;
}

/** Paga `cuota` cada mes (el último, lo que falte) hasta saldar. */
export function amortizar(saldo: number, cuota: number, im: number, cargoMensual = 0): Amortizacion {
  let s = saldo;
  let intereses = 0;
  const pagos: number[] = [];
  if (s <= 0.5) return { meses: 0, intereses: 0, cargos: 0, totalPagado: 0, pagos, estancado: false };
  if (cuota <= s * im) {
    return { meses: Infinity, intereses: Infinity, cargos: Infinity, totalPagado: Infinity, pagos, estancado: true };
  }
  while (s > 0.5 && pagos.length < TOPE) {
    const interes = s * im;
    intereses += interes;
    const pago = Math.min(cuota, s + interes);
    s = s + interes - pago;
    pagos.push(pago + cargoMensual);
  }
  const cargos = cargoMensual * pagos.length;
  const totalPagado = pagos.reduce((a, b) => a + b, 0);
  return { meses: pagos.length, intereses, cargos, totalPagado, pagos, estancado: false };
}

/** Cuota fija que salda `saldo` en `n` meses a la tasa mensual `im`. */
export function cuotaPara(saldo: number, im: number, n: number): number {
  if (n <= 0) return saldo;
  if (im === 0) return saldo / n;
  return (saldo * im) / (1 - Math.pow(1 + im, -n));
}

/**
 * Costo efectivo anual: la tasa a la que lo que se recibió (el saldo) vale lo
 * mismo que todo lo que se va a pagar (cuotas + seguros + manejo). Es la
 * tasa que de verdad cuesta la deuda. Se resuelve por bisección.
 */
export function costoEfectivoEA(saldo: number, pagos: number[]): number | null {
  if (saldo <= 0 || pagos.length === 0) return null;
  const vp = (r: number) => pagos.reduce((s, p, k) => s + p / Math.pow(1 + r, k + 1), 0);
  let bajo = 0;
  let alto = 1;
  if (vp(bajo) < saldo) return 0;
  for (let k = 0; k < 80; k++) {
    const medio = (bajo + alto) / 2;
    if (vp(medio) > saldo) bajo = medio;
    else alto = medio;
  }
  return (Math.pow(1 + (bajo + alto) / 2, 12) - 1) * 100;
}

const cargosDe = (d: Deuda) => Number(d.seguro_mensual ?? 0) + Number(d.cuota_manejo ?? 0);

export interface CostoDeuda {
  deuda: Deuda;
  pactadaEA: number;
  efectivaEA: number | null;
  cargos: number;
  restante: Amortizacion;
}

/** Lo que de verdad cuesta cada deuda de aquí a que se acabe, solo pagando cuotas. */
export function costoDeDeudas(deudas: Deuda[]): CostoDeuda[] {
  return deudas
    .filter((d) => Number(d.saldo) > 0.5)
    .map((d) => {
      const restante = amortizar(Number(d.saldo), Number(d.cuota), tasaMensual(d.tasa_ea), cargosDe(d));
      return {
        deuda: d,
        pactadaEA: Number(d.tasa_ea),
        efectivaEA: restante.estancado ? null : costoEfectivoEA(Number(d.saldo), restante.pagos),
        cargos: cargosDe(d),
        restante,
      };
    });
}

// --- abono a capital: ¿plazo o cuota? -----------------------------------------------

export interface ComparaAbono {
  sinAbono: Amortizacion;
  reducePlazo: Amortizacion;
  reduceCuota: Amortizacion;
  nuevaCuota: number;
}

/**
 * El mismo abono, aplicado de las dos formas que permite la ley: mantener la
 * cuota y terminar antes, o mantener el plazo y pagar menos cada mes.
 */
export function compararAbono(d: Deuda, abono: number): ComparaAbono {
  const im = tasaMensual(d.tasa_ea);
  const saldo = Number(d.saldo);
  const cargos = cargosDe(d);
  const nuevoSaldo = Math.max(0, saldo - abono);
  const sinAbono = amortizar(saldo, Number(d.cuota), im, cargos);
  const reducePlazo = amortizar(nuevoSaldo, Number(d.cuota), im, cargos);
  const plazo = mesesConSuCuota(d);
  const nuevaCuota = Number.isFinite(plazo) && plazo > 0 ? cuotaPara(nuevoSaldo, im, plazo) : Number(d.cuota);
  const reduceCuota = amortizar(nuevoSaldo, nuevaCuota, im, cargos);
  return { sinAbono, reducePlazo, reduceCuota, nuevaCuota };
}

// --- compra de cartera ------------------------------------------------------------------

export interface Oferta {
  ea: number;
  plazo: number;
  /** Costos que se pagan al inicio (estudio, avalúo…). */
  costosIniciales: number;
  seguroMensual: number;
}

export interface ComparaCartera {
  saldo: number;
  hoy: { cuota: number; meses: number; totalPagado: number; costo: number; estancado: boolean };
  nueva: { cuota: number; meses: number; totalPagado: number; costo: number; efectivaEA: number | null };
}

export function compararCompraCartera(deudas: Deuda[], o: Oferta): ComparaCartera {
  const saldo = deudas.reduce((s, d) => s + Number(d.saldo), 0);
  const hoyAm = deudas.map((d) => amortizar(Number(d.saldo), Number(d.cuota), tasaMensual(d.tasa_ea), cargosDe(d)));
  const estancado = hoyAm.some((a) => a.estancado);
  const hoyTotal = hoyAm.reduce((s, a) => s + a.totalPagado, 0);

  const im = tasaMensual(o.ea);
  const cuota = cuotaPara(saldo, im, o.plazo);
  const nuevaAm = amortizar(saldo, cuota, im, o.seguroMensual);
  const nuevaTotal = nuevaAm.totalPagado + o.costosIniciales;
  // El costo efectivo de la oferta cuenta los costos iniciales como plata
  // que no se recibe: entra el saldo menos esos costos.
  const efectiva = costoEfectivoEA(saldo - o.costosIniciales, nuevaAm.pagos);

  return {
    saldo,
    hoy: {
      cuota: deudas.reduce((s, d) => s + Number(d.cuota) + cargosDe(d), 0),
      meses: Math.max(0, ...hoyAm.map((a) => a.meses)),
      totalPagado: hoyTotal,
      costo: hoyTotal - saldo,
      estancado,
    },
    nueva: {
      cuota: cuota + o.seguroMensual,
      meses: nuevaAm.meses,
      totalPagado: nuevaTotal,
      costo: nuevaTotal - saldo,
      efectivaEA: efectiva,
    },
  };
}

// --- tarjeta de crédito: ¿a cuántas cuotas? -----------------------------------------------

/**
 * Compra con tarjeta a `n` cuotas, como la liquidan la mayoría de bancos en
 * Colombia: abono fijo a capital (monto / n) más intereses sobre el saldo
 * que queda. A una cuota normalmente no cobran intereses.
 */
export function compraConTarjeta(monto: number, ea: number, n: number) {
  const im = tasaMensual(ea);
  if (n <= 1) return { intereses: 0, primeraCuota: monto, ultimaCuota: monto, total: monto };
  const intereses = monto * im * ((n + 1) / 2);
  return {
    intereses,
    primeraCuota: monto / n + monto * im,
    ultimaCuota: monto / n + (monto / n) * im,
    total: monto + intereses,
  };
}
