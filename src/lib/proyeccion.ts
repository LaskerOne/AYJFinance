import { gastoMensual, ingresoMensual } from "@/lib/calculos";
import { mesesConSuCuota } from "@/lib/deudas";
import { MESES } from "@/lib/formato";
import type { Deuda, Frecuencia, GastoPresupuesto, Ingreso, Meta } from "@/models/dominio";

/**
 * Proyección del flujo de caja mes a mes.
 *
 * El presupuesto piensa en "equivalente mensual": un SOAT de $1.200.000
 * cuenta como $100.000 al mes. La caja no funciona así: ese mes salen
 * $1.200.000 de golpe. Aquí cada gasto e ingreso cae en el mes en que de
 * verdad se paga, las deudas dejan de cobrar cuota cuando terminan, las
 * metas dejan de pedir aporte cuando se cumplen, y los salarios con
 * prestaciones suman prima e intereses de cesantías en sus meses de ley.
 */

/** Cada cuántos meses se repite. 0 = todos los meses (mensual, quincenal). */
const CICLO: Record<Frecuencia, number> = {
  quincenal: 0,
  mensual: 0,
  bimestral: 2,
  trimestral: 3,
  semestral: 6,
  anual: 12,
};

export interface Evento {
  texto: string;
  monto: number;
  /** entra/sale: mueve la caja. libera: una cuota o aporte que deja de salir.
   *  aviso: informativo, no mueve la caja (las cesantías van al fondo). */
  tipo: "entra" | "sale" | "libera" | "aviso";
}

export interface MesProyectado {
  /** YYYY-MM */
  periodo: string;
  nombre: string;
  ingresos: number;
  gastos: number;
  cuotas: number;
  aportes: number;
  neto: number;
  acumulado: number;
  eventos: Evento[];
}

type ConMesPago = { frecuencia: Frecuencia; mes_pago?: number | null };

/** True si un concepto periódico con mes de pago cae en `mes` (1–12). */
function caeEn(item: ConMesPago, mes: number): boolean {
  const ciclo = CICLO[item.frecuencia];
  if (!ciclo || !item.mes_pago) return false;
  return (((mes - item.mes_pago) % ciclo) + ciclo) % ciclo === 0;
}

/** Periódico con mes de pago: el monto entero en su mes, cero en los demás. */
function esPuntual(item: ConMesPago): boolean {
  return CICLO[item.frecuencia] > 0 && Boolean(item.mes_pago);
}

export function sinMesDePago(ingresos: Ingreso[], gastos: GastoPresupuesto[]): number {
  const falta = (i: ConMesPago) => CICLO[i.frecuencia] > 0 && !i.mes_pago;
  return ingresos.filter(falta).length + gastos.filter(falta).length;
}

export interface EntradaProyeccion {
  ingresos: Ingreso[];
  gastos: GastoPresupuesto[];
  deudas: Deuda[];
  metas: Meta[];
  meses?: number;
  desde?: Date;
}

export function proyectarFlujo(e: EntradaProyeccion): MesProyectado[] {
  const total = e.meses ?? 12;
  const desde = e.desde ?? new Date();

  const plazoDeuda = new Map(e.deudas.map((d) => [d.id, mesesConSuCuota(d)]));
  const plazoMeta = new Map(
    e.metas.map((m) => {
      const falta = Number(m.objetivo) - Number(m.acumulado);
      const aporte = Number(m.aporte);
      if (aporte <= 0) return [m.id, 0];
      if (Number(m.objetivo) <= 0) return [m.id, Infinity];
      return [m.id, falta <= 0 ? 0 : Math.ceil(falta / aporte)];
    }),
  );

  const salida: MesProyectado[] = [];
  let acumulado = 0;

  for (let k = 0; k < total; k++) {
    const fecha = new Date(desde.getFullYear(), desde.getMonth() + k, 1);
    const mes = fecha.getMonth() + 1;
    const eventos: Evento[] = [];

    // Ingresos: los periódicos con mes caen enteros; el resto, su equivalente.
    let ingresos = 0;
    for (const i of e.ingresos) {
      if (esPuntual(i)) {
        if (caeEn(i, mes)) {
          ingresos += Number(i.monto);
          eventos.push({ texto: i.concepto || "Ingreso", monto: Number(i.monto), tipo: "entra" });
        }
      } else {
        ingresos += ingresoMensual(i);
      }

      // Prestaciones de ley sobre el salario mensual registrado.
      if (i.con_prestaciones && CICLO[i.frecuencia] === 0) {
        const salario = ingresoMensual(i);
        if (mes === 6 || mes === 12) {
          ingresos += salario / 2;
          eventos.push({ texto: `Prima · ${i.concepto || "salario"}`, monto: salario / 2, tipo: "entra" });
        }
        if (mes === 1) {
          ingresos += salario * 0.12;
          eventos.push({ texto: "Intereses de cesantías", monto: salario * 0.12, tipo: "entra" });
        }
        if (mes === 2) {
          eventos.push({ texto: "Cesantías al fondo (no llegan a la cuenta)", monto: salario, tipo: "aviso" });
        }
      }
    }

    let gastos = 0;
    for (const g of e.gastos) {
      if (esPuntual(g)) {
        if (caeEn(g, mes)) {
          gastos += Number(g.monto);
          eventos.push({ texto: g.concepto || g.categoria, monto: Number(g.monto), tipo: "sale" });
        }
      } else {
        gastos += gastoMensual(g);
      }
    }

    let cuotas = 0;
    for (const d of e.deudas) {
      if (Number(d.saldo) <= 0.5) continue;
      const plazo = plazoDeuda.get(d.id) ?? Infinity;
      if (k < plazo) cuotas += Number(d.cuota);
      else if (k === plazo) {
        eventos.push({ texto: `Termina ${d.nombre || "una deuda"}`, monto: Number(d.cuota), tipo: "libera" });
      }
    }

    let aportes = 0;
    for (const m of e.metas) {
      const plazo = plazoMeta.get(m.id) ?? 0;
      if (k < plazo) aportes += Number(m.aporte);
      else if (k === plazo && plazo > 0) {
        eventos.push({ texto: `Se cumple ${m.nombre || "una meta"}`, monto: Number(m.aporte), tipo: "libera" });
      }
    }

    const neto = ingresos - gastos - cuotas - aportes;
    acumulado += neto;
    salida.push({
      periodo: `${fecha.getFullYear()}-${String(mes).padStart(2, "0")}`,
      nombre: MESES[mes - 1],
      ingresos,
      gastos,
      cuotas,
      aportes,
      neto,
      acumulado,
      eventos,
    });
  }
  return salida;
}

export interface Provision {
  concepto: string;
  frecuencia: Frecuencia;
  monto: number;
  /** Lo que habría que apartar cada mes para que el pago no tome por sorpresa. */
  mensual: number;
  /** Meses que faltan para el próximo pago (0 = este mes). null sin mes de pago. */
  faltan: number | null;
  proximo: string | null;
  /** Lo que ya debería estar apartado hoy para llegar completo al pago. */
  deberiaHaber: number | null;
}

/**
 * Fondos de provisión: por cada gasto que no es mensual, cuánto apartar al
 * mes y cuánto debería haber guardado ya según lo que falta para pagarlo.
 */
export function provisiones(gastos: GastoPresupuesto[], hoy = new Date()): Provision[] {
  const mesHoy = hoy.getMonth() + 1;
  return gastos
    .filter((g) => CICLO[g.frecuencia] > 0)
    .map((g) => {
      const ciclo = CICLO[g.frecuencia];
      const mensual = gastoMensual(g);
      if (!g.mes_pago) {
        return { concepto: g.concepto || g.categoria, frecuencia: g.frecuencia, monto: Number(g.monto), mensual, faltan: null, proximo: null, deberiaHaber: null };
      }
      const faltan = (((g.mes_pago - mesHoy) % ciclo) + ciclo) % ciclo;
      const proximo = MESES[(mesHoy - 1 + faltan) % 12];
      return {
        concepto: g.concepto || g.categoria,
        frecuencia: g.frecuencia,
        monto: Number(g.monto),
        mensual,
        faltan,
        proximo,
        deberiaHaber: mensual * (ciclo - faltan),
      };
    })
    .sort((a, b) => (a.faltan ?? 99) - (b.faltan ?? 99));
}

/** La próxima prima (junio o diciembre) y cuánto suma entre los salarios con prestaciones. */
export function proximaPrima(ingresos: Ingreso[], hoy = new Date()): { mes: string; monto: number; enMeses: number } | null {
  const base = ingresos
    .filter((i) => i.con_prestaciones && CICLO[i.frecuencia] === 0)
    .reduce((s, i) => s + ingresoMensual(i), 0);
  if (base <= 0) return null;
  const mesHoy = hoy.getMonth() + 1;
  const proximo = mesHoy <= 6 ? 6 : 12;
  return { mes: MESES[proximo - 1], monto: base / 2, enMeses: proximo - mesHoy };
}
