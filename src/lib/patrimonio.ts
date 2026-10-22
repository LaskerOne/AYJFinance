import { simularDeudas } from "@/lib/deudas";
import {
  TIPOS_ACTIVO,
  type Activo,
  type Deuda,
  type EstrategiaDeuda,
  type GrupoActivo,
  type Meta,
} from "@/models/dominio";

/**
 * Patrimonio e inversiones.
 *
 * Patrimonio neto = lo que tienen − lo que deben. Las rentabilidades se
 * muestran en tres capas: la que anuncian (nominal), la que queda después de
 * retención en la fuente y 4×1000 (neta), y la que queda después de la
 * inflación (real), que es la que de verdad hace crecer el poder de compra.
 * Las cifras de impuestos son aproximaciones de uso general, no asesoría.
 */

const RETENCION = 0.07;
const GMF = 0.4; // 4×1000 = 0,4 % de lo retirado, una vez al año

export interface Rentabilidad {
  nominal: number;
  neta: number;
  real: number;
}

export function rentabilidad(a: Pick<Activo, "tipo" | "tasa_ea">, inflacion: number): Rentabilidad | null {
  if (a.tasa_ea === null || a.tasa_ea === undefined) return null;
  const info = TIPOS_ACTIVO[a.tipo];
  const nominal = Number(a.tasa_ea);
  // La retención se lleva una parte del rendimiento; el 4×1000 una parte del total.
  const neta = nominal * (info.retencion && nominal > 0 ? 1 - RETENCION : 1) - (info.gmf ? GMF : 0);
  const real = ((1 + neta / 100) / (1 + inflacion / 100) - 1) * 100;
  return { nominal, neta, real };
}

export interface ResumenPatrimonio {
  activos: number;
  deudas: number;
  neto: number;
  porGrupo: Record<GrupoActivo, number>;
}

export function resumenPatrimonio(activos: Activo[], deudas: Deuda[]): ResumenPatrimonio {
  const porGrupo: Record<GrupoActivo, number> = { liquido: 0, invertido: 0, retiro: 0, bienes: 0 };
  for (const a of activos) porGrupo[TIPOS_ACTIVO[a.tipo].grupo] += Number(a.valor);
  const total = Object.values(porGrupo).reduce((s, v) => s + v, 0);
  const deuda = deudas.reduce((s, d) => s + Math.max(0, Number(d.saldo)), 0);
  return { activos: total, deudas: deuda, neto: total - deuda, porGrupo };
}

export interface PuntoPatrimonio {
  anio: number;
  nominal: number;
  real: number;
  activos: number;
  deudas: number;
}

/**
 * El patrimonio año a año: cada activo crece a su rentabilidad neta más lo
 * que se le aporta, los bienes se quedan quietos (salvo que tengan una tasa,
 * que puede ser negativa para un carro que se deprecia), y las deudas bajan
 * según el plan de pagos. La serie real descuenta la inflación.
 */
export function proyectarPatrimonio(
  activos: Activo[],
  deudas: Deuda[],
  opciones: { anios: number; inflacion: number; abono: number; estrategia: EstrategiaDeuda },
): PuntoPatrimonio[] {
  const plan = simularDeudas(deudas, opciones.abono, opciones.estrategia, true);
  const saldoDeuda = (mes: number) =>
    plan.estancado ? plan.serie[0] : (plan.serie[mes] ?? 0);

  const valores = activos.map((a) => Number(a.valor));
  const tasas = activos.map((a) => {
    const r = rentabilidad(a, opciones.inflacion);
    return r ? Math.pow(1 + r.neta / 100, 1 / 12) - 1 : 0;
  });

  const puntos: PuntoPatrimonio[] = [];
  const punto = (anio: number) => {
    const totalActivos = valores.reduce((s, v) => s + v, 0);
    const deuda = saldoDeuda(anio * 12);
    const nominal = totalActivos - deuda;
    puntos.push({
      anio,
      nominal,
      real: nominal / Math.pow(1 + opciones.inflacion / 100, anio),
      activos: totalActivos,
      deudas: deuda,
    });
  };

  punto(0);
  for (let mes = 1; mes <= opciones.anios * 12; mes++) {
    for (let i = 0; i < activos.length; i++) {
      valores[i] = valores[i] * (1 + tasas[i]) + Number(activos[i].aporte_mensual);
    }
    if (mes % 12 === 0) punto(mes / 12);
  }
  return puntos;
}

/**
 * Número de libertad financiera: el capital que, retirando un porcentaje al
 * año, cubre el gasto de vida sin trabajar. Con la regla del 4 % es 25 veces
 * el gasto anual. Y cuánto tardarían en llegar con lo que ya tienen
 * invertido, lo que aportan y una rentabilidad real supuesta.
 */
export function libertadFinanciera(
  gastoMensual: number,
  tasaRetiro: number,
  capital: number,
  ahorroMensual: number,
  rentaReal: number,
): { objetivo: number; meses: number } {
  const objetivo = (gastoMensual * 12) / (tasaRetiro / 100);
  if (capital >= objetivo) return { objetivo, meses: 0 };
  const im = Math.pow(1 + rentaReal / 100, 1 / 12) - 1;
  let v = capital;
  for (let mes = 1; mes <= 1200; mes++) {
    v = v * (1 + im) + ahorroMensual;
    if (v >= objetivo) return { objetivo, meses: mes };
  }
  return { objetivo, meses: Infinity };
}

export interface Vencimiento {
  activo: Activo;
  fecha: string;
  dias: number;
  /** Valor estimado al vencer, con la tasa neta. */
  valorFinal: number;
}

export function vencimientos(activos: Activo[], inflacion: number, hoy = new Date()): Vencimiento[] {
  const inicioHoy = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate()).getTime();
  return activos
    .filter((a) => a.vencimiento)
    .map((a) => {
      const dias = Math.round((new Date(`${a.vencimiento}T00:00:00`).getTime() - inicioHoy) / 86_400_000);
      const r = rentabilidad(a, inflacion);
      const valorFinal = Number(a.valor) * Math.pow(1 + (r?.neta ?? 0) / 100, Math.max(0, dias) / 365);
      return { activo: a, fecha: a.vencimiento as string, dias, valorFinal };
    })
    .sort((x, y) => x.dias - y.dias);
}

export type Horizonte = "corto" | "medio" | "largo";

export interface MetaConHorizonte {
  meta: Meta;
  meses: number;
  horizonte: Horizonte;
}

/**
 * En cuánto tiempo se usa la plata de cada meta. Eso, más que la
 * rentabilidad, decide dónde guardarla: lo que se necesita pronto no puede
 * estar expuesto a caídas. El colchón siempre es de corto plazo.
 */
export function horizonteDeMetas(metas: Meta[]): MetaConHorizonte[] {
  return metas.map((m) => {
    const falta = Math.max(0, Number(m.objetivo) - Number(m.acumulado));
    const aporte = Number(m.aporte);
    const meses = falta <= 0 ? 0 : aporte > 0 ? Math.ceil(falta / aporte) : Infinity;
    const horizonte: Horizonte = m.es_emergencia || meses < 12 ? "corto" : meses <= 60 ? "medio" : "largo";
    return { meta: m, meses, horizonte };
  });
}
