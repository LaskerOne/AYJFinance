import type { Finanzas } from "@/lib/calculos";
import type { ResumenPatrimonio } from "@/lib/patrimonio";
import { TIPOS_ACTIVO, type Activo, type Deuda, type Meta } from "@/models/dominio";

/**
 * Salud financiera en un número y en un camino.
 *
 * El puntaje (0–100) junta cinco medidas de 20 puntos: endeudamiento,
 * capacidad de ahorro, colchón, presupuesto cuadrado y patrimonio. Cada una
 * es lineal entre un piso y una meta, así que mejorar un poco siempre suma
 * algo y nunca hay saltos arbitrarios.
 *
 * La ruta son seis niveles en orden: no se trata de hacerlo todo a la vez
 * sino de saber cuál es el siguiente paso.
 */

const entre = (v: number, piso: number, meta: number) =>
  Math.max(0, Math.min(1, (v - piso) / (meta - piso)));

export interface ParteDelPuntaje {
  nombre: string;
  puntos: number;
  detalle: string;
}

export interface Puntaje {
  total: number;
  partes: ParteDelPuntaje[];
}

export function puntajeSalud(f: Finanzas, p: ResumenPatrimonio): Puntaje {
  const dti = f.ingreso > 0 ? f.cuotas / f.ingreso : 0;
  const libreSobreIngreso = f.ingreso > 0 ? f.libre / f.ingreso : 0;
  const gastoAnual = f.gastos * 12;
  const patrimonioEnAnios = gastoAnual > 0 ? p.neto / gastoAnual : 0;

  const partes: ParteDelPuntaje[] = [
    {
      nombre: "Endeudamiento",
      // 30 % o menos suma todo; 60 % o más, nada.
      puntos: 20 * (1 - entre(dti, 0.3, 0.6)),
      detalle: "Cuotas sobre ingreso: 30 % o menos da los 20 puntos.",
    },
    {
      nombre: "Capacidad de ahorro",
      puntos: 20 * entre(f.tasaAhorro, 0, 0.2),
      detalle: "Lo que queda tras gastos y cuotas: 20 % del ingreso da los 20 puntos.",
    },
    {
      nombre: "Colchón",
      puntos: 20 * entre(f.mesesColchon, 0, 6),
      detalle: "Seis meses de vida cubiertos dan los 20 puntos.",
    },
    {
      nombre: "Presupuesto cuadrado",
      // Cuadrado o con sobrante: todo. Un descuadre del 10 % del ingreso: nada.
      puntos: 20 * entre(libreSobreIngreso, -0.1, 0),
      detalle: "Que los aportes a metas no superen lo que queda libre.",
    },
    {
      nombre: "Patrimonio",
      // Un año de gastos de patrimonio neto da todo; negativo, nada.
      puntos: 20 * entre(patrimonioEnAnios, 0, 1),
      detalle: "Un patrimonio neto de al menos un año de gastos da los 20 puntos.",
    },
  ];
  const total = Math.round(partes.reduce((s, x) => s + x.puntos, 0));
  return { total, partes };
}

export function textoPuntaje(total: number): { tono: "ok" | "warn" | "crit"; texto: string } {
  if (total >= 70) return { tono: "ok", texto: "Sólida" };
  if (total >= 40) return { tono: "warn", texto: "En construcción" };
  return { tono: "crit", texto: "Frágil" };
}

// --- la ruta ---------------------------------------------------------------------

export interface Nivel {
  n: number;
  titulo: string;
  porque: string;
  logrado: boolean;
  /** 0–1 hacia el criterio del nivel. */
  progreso: number;
  /** Dónde están hoy frente al criterio, con sus cifras (ya formateadas). */
  estado: string;
  /** Qué hacer para cumplirlo. */
  siguiente: string;
}

export interface EntradaRuta {
  f: Finanzas;
  p: ResumenPatrimonio;
  deudas: Deuda[];
  activos: Activo[];
  metas: Meta[];
  $: (n: number) => string;
}

/** Deuda cara: la de consumo o tarjeta, por encima del 15 % E.A. */
export const TASA_CARA = 15;

export function rutaDeMadurez({ f, p, deudas, activos, metas, $ }: EntradaRuta): Nivel[] {
  const caras = deudas.filter((d) => Number(d.saldo) > 0 && Number(d.tasa_ea) >= TASA_CARA);
  const saldoCaro = caras.reduce((s, d) => s + Number(d.saldo), 0);
  const metasConAporte = metas.filter((m) => !m.es_emergencia && Number(m.aporte) > 0).length;
  const retiro = activos.filter((a) => TIPOS_ACTIVO[a.tipo].grupo === "retiro");
  const aporteRetiro = retiro.reduce((s, a) => s + Number(a.aporte_mensual), 0);
  const invertido = p.porGrupo.invertido + p.porGrupo.retiro;

  const niveles: Omit<Nivel, "n">[] = [
    {
      titulo: "Presupuesto cuadrado",
      porque: "Sin un plan que cierre, todo lo demás se financia con deuda o con el colchón.",
      logrado: f.disponible >= 0 && f.libre >= 0,
      progreso: f.libre >= 0 ? 1 : f.ingreso > 0 ? Math.max(0, 1 + f.libre / (f.ingreso * 0.1)) : 0,
      estado:
        f.libre >= 0
          ? `Les quedan ${$(f.libre)} sin asignar al mes.`
          : `Los aportes a metas superan en ${$(-f.libre)} lo que queda libre.`,
      siguiente: "Bajen los aportes a metas o los gastos hasta que lo asignado no supere lo que entra.",
    },
    {
      titulo: "Un mes de colchón",
      porque: "Un imprevisto sin colchón se vuelve deuda cara. Un mes ya rompe ese ciclo.",
      logrado: f.mesesColchon >= 1,
      progreso: Math.min(1, f.mesesColchon),
      estado: `Tienen ${f.mesesColchon.toFixed(1).replace(".", ",")} meses; un mes son ${$(f.costoVida)}.`,
      siguiente: "Aporten primero al fondo de emergencia, aunque las otras metas esperen.",
    },
    {
      titulo: "Sin deudas caras",
      porque: `Una deuda por encima del ${TASA_CARA} % E.A. le gana a casi cualquier inversión: pagarla es la mejor rentabilidad.`,
      logrado: caras.length === 0,
      // Qué parte de lo que deben ya no es cara.
      progreso: caras.length === 0 ? 1 : p.deudas > 0 ? 1 - saldoCaro / p.deudas : 0,
      estado:
        caras.length === 0
          ? "Ninguna deuda pasa del umbral."
          : `${caras.length} ${caras.length === 1 ? "deuda cara suma" : "deudas caras suman"} ${$(saldoCaro)}.`,
      siguiente: "Lancen todo excedente a la más cara (avalancha) y no abran deuda nueva de consumo.",
    },
    {
      titulo: "Colchón completo",
      porque: "De tres a seis meses cubren la pérdida de un empleo o una emergencia médica sin endeudarse.",
      logrado: f.mesesColchon >= 3,
      progreso: Math.min(1, f.mesesColchon / 3),
      estado: `Llevan ${f.mesesColchon.toFixed(1).replace(".", ",")} de 3 meses mínimos.`,
      siguiente: "Sigan aportando al fondo hasta 3 meses, y a 6 si el ingreso depende de una sola persona.",
    },
    {
      titulo: "Invertir para las metas",
      porque: "Con lo básico cubierto, la plata de las metas debe ganarle a la inflación.",
      logrado: f.tasaAhorro >= 0.15 && (metasConAporte > 0 || p.porGrupo.invertido > 0),
      progreso: Math.min(1, f.tasaAhorro / 0.15) * (metasConAporte > 0 || p.porGrupo.invertido > 0 ? 1 : 0.5),
      estado: `Ahorran el ${(f.tasaAhorro * 100).toFixed(1).replace(".", ",")} % y tienen ${metasConAporte} ${metasConAporte === 1 ? "meta" : "metas"} con aporte.`,
      siguiente: "Lleguen al 15 % de ahorro y pongan cada meta en el producto que corresponde a su plazo.",
    },
    {
      titulo: "Ahorro para el retiro",
      porque: "La pensión obligatoria suele no alcanzar para mantener el nivel de vida. Lo que se empieza temprano, se multiplica.",
      logrado: aporteRetiro > 0 && invertido >= f.gastos * 12,
      progreso: Math.min(1, (aporteRetiro > 0 ? 0.3 : 0) + 0.7 * Math.min(1, f.gastos > 0 ? invertido / (f.gastos * 12) : 0)),
      estado: `Aportan ${$(aporteRetiro)} al mes al retiro; lo invertido equivale a ${f.gastos > 0 ? (invertido / (f.gastos * 12)).toFixed(1).replace(".", ",") : "0"} años de gastos.`,
      siguiente: "Abran un aporte mensual a pensión voluntaria o AFC y crezcan lo invertido hasta un año de gastos.",
    },
  ];
  return niveles.map((x, i) => ({ ...x, n: i + 1, progreso: Math.max(0, Math.min(1, x.progreso)) }));
}

/** El nivel en el que están: el primero que no han logrado. */
export function nivelActual(niveles: Nivel[]): number {
  const primero = niveles.find((x) => !x.logrado);
  return primero ? primero.n : niveles.length + 1;
}
