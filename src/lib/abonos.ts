import { simularDeudas, type Simulacion } from "@/lib/deudas";
import type { Deuda, EstrategiaDeuda } from "@/models/dominio";

/**
 * Cuánto abonar a capital cada mes, por fuera de las cuotas.
 *
 * La plata para abonar sale de lo libre del presupuesto (lo que no está ni en
 * gastos, ni en cuotas, ni en metas). No se recomienda todo: un mes real
 * nunca cuadra exacto con el plan, y si el abono se come el margen, el primer
 * imprevisto vuelve a la tarjeta y deshace el avance. Cuánto se guarda de
 * margen depende del colchón: sin colchón, la mayor parte va primero ahí.
 */

const REDONDEO = 10_000;
const abajo = (v: number) => Math.max(0, Math.floor(v / REDONDEO) * REDONDEO);
const arriba = (v: number) => Math.ceil(v / REDONDEO) * REDONDEO;

export interface EscenarioAbono {
  nombre: string;
  abono: number;
  meses: number;
  intereses: number;
  mesesGanados: number;
  interesAhorrado: number;
  /** Intereses que se ahorra cada peso abonado: cuánto rinde el abono. */
  rendimiento: number;
}

export interface RecomendacionAbono {
  /** El abono que el oráculo propone; 0 si no hay de dónde. */
  recomendado: number;
  /** Todo lo libre: el techo sin tocar gastos ni metas. */
  maximo: number;
  /** Qué parte de lo libre se propone y por qué. */
  fraccion: number;
  razon: string;
  base: Simulacion;
  escenarios: EscenarioAbono[];
  /** El abono que haría falta para salir en la mitad del tiempo. */
  mitad: { meses: number; abono: number } | null;
}

function escenario(
  nombre: string,
  deudas: Deuda[],
  estrategia: EstrategiaDeuda,
  abono: number,
  base: Simulacion,
): EscenarioAbono | null {
  const s = simularDeudas(deudas, abono, estrategia, true);
  if (s.estancado || base.estancado) return null;
  const totalAbonado = abono * s.meses;
  return {
    nombre,
    abono,
    meses: s.meses,
    intereses: s.intereses,
    mesesGanados: base.meses - s.meses,
    interesAhorrado: base.intereses - s.intereses,
    rendimiento: totalAbonado > 0 ? (base.intereses - s.intereses) / totalAbonado : 0,
  };
}

/** El abono mínimo (redondeado a 10 000) para quedar libres en `meses`. */
export function abonoParaTerminarEn(
  deudas: Deuda[],
  estrategia: EstrategiaDeuda,
  meses: number,
): number | null {
  if (meses < 1) return null;
  const saldo = deudas.reduce((s, d) => s + Math.max(0, Number(d.saldo)), 0);
  let lo = 0;
  let hi = saldo; // abonar todo el saldo de una vez siempre alcanza
  if (simularDeudas(deudas, hi, estrategia, true).meses > meses) return null;
  for (let i = 0; i < 40 && hi - lo > 1_000; i++) {
    const medio = (lo + hi) / 2;
    const s = simularDeudas(deudas, medio, estrategia, true);
    if (!s.estancado && s.meses <= meses) hi = medio;
    else lo = medio;
  }
  return arriba(hi);
}

export function recomendarAbono(e: {
  deudas: Deuda[];
  estrategia: EstrategiaDeuda;
  libre: number;
  mesesColchon: number;
}): RecomendacionAbono | null {
  const vivas = e.deudas.filter((d) => Number(d.saldo) > 0.5);
  if (vivas.length === 0) return null;
  const base = simularDeudas(vivas, 0, e.estrategia, true);

  const [fraccion, razon] =
    e.mesesColchon < 1
      ? [0.4, "Sin un mes de colchón, más de la mitad de lo libre va primero al fondo de emergencia."]
      : e.mesesColchon < 3
        ? [0.6, "El colchón todavía no llega a tres meses: una parte de lo libre sigue yendo ahí."]
        : [0.8, "Con el colchón completo, casi todo lo libre puede ir a capital; queda un 20 % de margen para los meses que no cuadran."];

  const maximo = abajo(e.libre);
  const recomendado = abajo(e.libre * fraccion);

  const candidatos: Array<[string, number]> = [
    ["Suave", abajo(recomendado / 2)],
    ["Recomendado", recomendado],
    ["Todo lo libre", maximo],
  ];
  const vistos = new Set<number>();
  const escenarios = candidatos
    .filter(([, v]) => v > 0 && !vistos.has(v) && (vistos.add(v), true))
    .map(([n, v]) => escenario(n, vivas, e.estrategia, v, base))
    .filter((x): x is EscenarioAbono => x !== null);

  let mitad: RecomendacionAbono["mitad"] = null;
  if (!base.estancado && base.meses >= 4) {
    const objetivo = Math.ceil(base.meses / 2);
    const abono = abonoParaTerminarEn(vivas, e.estrategia, objetivo);
    if (abono !== null) mitad = { meses: objetivo, abono };
  }

  return { recomendado, maximo, fraccion, razon, base, escenarios, mitad };
}
