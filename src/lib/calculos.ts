import {
  CATEGORIAS,
  CATEGORIAS_ESENCIALES,
  MULTIPLICADOR_FRECUENCIA,
  type Categoria,
  type Deuda,
  type GastoPresupuesto,
  type Ingreso,
  type Meta,
  type Reparto,
} from "@/models/dominio";

/** Valor mensual equivalente de un ingreso, sea quincenal, anual o lo que sea. */
export function ingresoMensual(i: Pick<Ingreso, "monto" | "frecuencia">): number {
  return Number(i.monto) * (MULTIPLICADOR_FRECUENCIA[i.frecuencia] ?? 1);
}

/**
 * Valor mensual equivalente de un gasto. Un seguro semestral de 600.000
 * cuenta como 100.000 al mes: así se pueden sumar gastos de periodicidades
 * distintas sin que el usuario haga la división a mano.
 */
export function gastoMensual(g: Pick<GastoPresupuesto, "monto" | "frecuencia">): number {
  return Number(g.monto) * (MULTIPLICADOR_FRECUENCIA[g.frecuencia] ?? 1);
}

export interface EntradaCalculo {
  ingresos: Ingreso[];
  gastos: GastoPresupuesto[];
  deudas: Deuda[];
  metas: Meta[];
  /** Id de cada integrante. `idB` es null mientras la pareja no se una. */
  idA: string | null;
  idB: string | null;
  reparto: Reparto;
}

export interface CorteRegla {
  fraccion: number;
  valor: number;
  objetivo: number;
  direccion: "max" | "min";
  estado: "ok" | "warn" | "crit";
}

export interface Finanzas {
  ingresoA: number;
  ingresoB: number;
  ingreso: number;
  participacionA: number;
  participacionB: number;

  gastos: number;
  gastosFijos: number;
  gastosVariables: number;
  gastoComun: number;
  gastoA: number;
  gastoB: number;
  porCategoria: Array<{ categoria: Categoria; monto: number }>;

  cuotas: number;
  cuotaA: number;
  cuotaB: number;
  cuotaComun: number;
  deudaTotal: number;

  aportes: number;
  aporteA: number;
  aporteB: number;
  aporteComun: number;
  ahorrado: number;

  disponible: number;
  libre: number;
  tasaAhorro: number;

  bote: number;
  boteA: number;
  boteB: number;
  propioA: number;
  propioB: number;
  quedaA: number;
  quedaB: number;

  regla: { necesidades: CorteRegla; gustos: CorteRegla; ahorro: CorteRegla };

  costoVida: number;
  fondo: number;
  fondoObjetivo: number;
  fondoAporte: number;
  mesesColchon: number;
}

function suma<T>(filas: T[], valor: (f: T) => number): number {
  return filas.reduce((acc, f) => acc + valor(f), 0);
}

function estadoRegla(
  fraccion: number,
  objetivo: number,
  direccion: "max" | "min",
): CorteRegla["estado"] {
  if (direccion === "max") {
    if (fraccion <= objetivo) return "ok";
    return fraccion <= objetivo * 1.2 ? "warn" : "crit";
  }
  if (fraccion >= objetivo) return "ok";
  return fraccion >= objetivo / 2 ? "warn" : "crit";
}

/**
 * Todo el motor financiero en una función pura: mismos datos, mismo
 * resultado, sin tocar el DOM ni la red. Eso la hace trivial de probar.
 */
export function calcularFinanzas(e: EntradaCalculo): Finanzas {
  const deA = <T extends { usuario_id: string | null }>(f: T) => e.idA !== null && f.usuario_id === e.idA;
  const deB = <T extends { usuario_id: string | null }>(f: T) => e.idB !== null && f.usuario_id === e.idB;
  const comun = <T extends { usuario_id: string | null }>(f: T) => f.usuario_id === null;

  const ingresoA = suma(e.ingresos.filter(deA), ingresoMensual);
  const ingresoB = suma(e.ingresos.filter(deB), ingresoMensual);
  const ingresoComun = suma(e.ingresos.filter(comun), ingresoMensual);
  const ingreso = ingresoA + ingresoB + ingresoComun;

  // El ingreso del hogar se reparte por igual para medir la participación.
  const baseA = ingresoA + ingresoComun / 2;
  const baseB = ingresoB + ingresoComun / 2;
  const totalBase = baseA + baseB;
  const participacionA = totalBase > 0 ? baseA / totalBase : 0.5;
  const participacionB = 1 - participacionA;

  // Todo gasto se mensualiza antes de sumarse: mezclar un pago anual con uno
  // quincenal sin normalizar daría un total que no significa nada.
  const monto = gastoMensual;
  const gastos = suma(e.gastos, monto);
  const gastosFijos = suma(e.gastos.filter((g) => g.tipo === "fijo"), monto);
  const gastoComun = suma(e.gastos.filter(comun), monto);
  const gastoA = suma(e.gastos.filter(deA), monto);
  const gastoB = suma(e.gastos.filter(deB), monto);

  const porCategoria = CATEGORIAS.map((categoria) => ({
    categoria,
    monto: suma(e.gastos.filter((g) => g.categoria === categoria), monto),
  }))
    .filter((c) => c.monto > 0)
    .sort((x, y) => y.monto - x.monto);

  const cuota = (d: { cuota: number }) => Number(d.cuota);
  const cuotas = suma(e.deudas, cuota);
  const cuotaA = suma(e.deudas.filter(deA), cuota);
  const cuotaB = suma(e.deudas.filter(deB), cuota);
  const cuotaComun = suma(e.deudas.filter(comun), cuota);
  const deudaTotal = suma(e.deudas, (d) => Number(d.saldo));

  const aporte = (m: { aporte: number }) => Number(m.aporte);
  const aportes = suma(e.metas, aporte);
  const aporteA = suma(e.metas.filter(deA), aporte);
  const aporteB = suma(e.metas.filter(deB), aporte);
  const aporteComun = suma(e.metas.filter(comun), aporte);
  const ahorrado = suma(e.metas, (m) => Number(m.acumulado));

  const disponible = ingreso - gastos - cuotas;
  const libre = disponible - aportes;
  const tasaAhorro = ingreso > 0 ? disponible / ingreso : 0;

  // El bote común: lo que se paga entre los dos.
  const bote = gastoComun + cuotaComun + aporteComun;
  const fraccionA = e.reparto === "mitad" ? 0.5 : participacionA;
  const boteA = bote * fraccionA;
  const boteB = bote - boteA;

  const propioA = gastoA + cuotaA + aporteA;
  const propioB = gastoB + cuotaB + aporteB;
  const quedaA = baseA - boteA - propioA;
  const quedaB = baseB - boteB - propioB;

  const esenciales = suma(
    e.gastos.filter((g) => CATEGORIAS_ESENCIALES.includes(g.categoria)),
    monto,
  );
  const necesidadesValor = esenciales + cuotas;
  const gustosValor = gastos - esenciales;
  const frac = (v: number) => (ingreso > 0 ? v / ingreso : 0);

  const regla = {
    necesidades: {
      fraccion: frac(necesidadesValor),
      valor: necesidadesValor,
      objetivo: 0.5,
      direccion: "max" as const,
      estado: estadoRegla(frac(necesidadesValor), 0.5, "max"),
    },
    gustos: {
      fraccion: frac(gustosValor),
      valor: gustosValor,
      objetivo: 0.3,
      direccion: "max" as const,
      estado: estadoRegla(frac(gustosValor), 0.3, "max"),
    },
    ahorro: {
      fraccion: frac(disponible),
      valor: disponible,
      objetivo: 0.2,
      direccion: "min" as const,
      estado: estadoRegla(frac(disponible), 0.2, "min"),
    },
  };

  const costoVida = gastos + cuotas;
  const emergencia = e.metas.filter((m) => m.es_emergencia);
  const fondo = suma(emergencia, (m) => Number(m.acumulado));

  return {
    ingresoA: baseA,
    ingresoB: baseB,
    ingreso,
    participacionA,
    participacionB,
    gastos,
    gastosFijos,
    gastosVariables: gastos - gastosFijos,
    gastoComun,
    gastoA,
    gastoB,
    porCategoria,
    cuotas,
    cuotaA,
    cuotaB,
    cuotaComun,
    deudaTotal,
    aportes,
    aporteA,
    aporteB,
    aporteComun,
    ahorrado,
    disponible,
    libre,
    tasaAhorro,
    bote,
    boteA,
    boteB,
    propioA,
    propioB,
    quedaA,
    quedaB,
    regla,
    costoVida,
    fondo,
    fondoObjetivo: suma(emergencia, (m) => Number(m.objetivo)),
    fondoAporte: suma(emergencia, (m) => Number(m.aporte)),
    mesesColchon: costoVida > 0 ? fondo / costoVida : 0,
  };
}
