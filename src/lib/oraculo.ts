import type { Finanzas } from "@/lib/calculos";
import { gastoMensual } from "@/lib/calculos";
import { mesesConSuCuota } from "@/lib/deudas";
import { gastosHormiga } from "@/lib/habitos";
import { liquidarMes } from "@/lib/liquidacion";
import { rentabilidad } from "@/lib/patrimonio";
import { proyectarFlujo } from "@/lib/proyeccion";
import { generarSugerencias } from "@/lib/sugerencias";
import { MESES } from "@/lib/formato";
import {
  TIPOS_ACTIVO,
  type Activo,
  type Decision,
  type Deuda,
  type Frecuencia,
  type GastoPresupuesto,
  type Hogar,
  type Ingreso,
  type Meta,
  type Movimiento,
} from "@/models/dominio";

/**
 * El oráculo: el analista de la casa.
 *
 * Lee todo lo que el hogar tiene registrado (movimientos, presupuesto,
 * deudas, metas, patrimonio, decisiones y la proyección) y devuelve dos
 * clases de mensajes:
 *   · CONSEJOS: qué conviene hacer ahora, con sus cifras y a dónde ir.
 *   · TIPS: ideas de educación financiera, elegidas por lo que más les sirve
 *     según su situación, con sus propios números cuando se puede.
 * Todo es cálculo sobre sus datos: nada sale de la aplicación.
 */

export type TipoMensaje = "consejo" | "tip";
export type Fuente =
  | "movimientos"
  | "presupuesto"
  | "deudas"
  | "metas"
  | "patrimonio"
  | "pareja"
  | "proyección"
  | "educación";

/** Lo que el consejo propone hacer, para resolverlo ahí mismo con un clic. */
export type Accion =
  | { tipo: "aporte-meta"; metaId: string; sugerido: number }
  | { tipo: "dias-pago"; deudas: { id: string; nombre: string }[] }
  | { tipo: "meses-pago"; gastos: { id: string; concepto: string; frecuencia: Frecuencia }[] }
  | { tipo: "saldar-bote"; mes: string; deudor: string; monto: number; texto: string }
  | { tipo: "sumar-colchon"; metaId: string; monto: number }
  | { tipo: "mover-aporte"; desdeId: string; aporte: number; opciones: { id: string; nombre: string }[] }
  | { tipo: "marcar-cumplida"; decisionId: string };

export interface Mensaje {
  id: string;
  tipo: TipoMensaje;
  titulo: string;
  cuerpo: string;
  impacto?: string;
  /** Menor va primero. */
  prioridad: number;
  tono: "ok" | "warn" | "crit" | "neutro";
  fuente: Fuente;
  ir?: { texto: string; ruta: string };
  comoSeCalcula?: string;
  accion?: Accion;
}

export interface Lectura {
  movimientos: number;
  meses: number;
  deudas: number;
  metas: number;
  activos: number;
}

export interface Analisis {
  consejos: Mensaje[];
  tips: Mensaje[];
  lectura: Lectura;
}

export interface EntradaOraculo {
  f: Finanzas;
  movimientos: Movimiento[];
  gastos: GastoPresupuesto[];
  ingresos: Ingreso[];
  deudas: Deuda[];
  metas: Meta[];
  activos: Activo[];
  decisiones: Decision[];
  hogar: Hogar | null;
  idA: string | null;
  idB: string | null;
  nombreDe: (id: string | null) => string;
  etiqueta: (categoria: string) => string;
  $: (n: number) => string;
  meses: (n: number) => string;
  pct: (n: number) => string;
  hoy?: Date;
}

const mesIso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
/** Valor futuro de aportar `m` al mes durante `anios` a una tasa anual. */
function valorFuturo(m: number, anualPct: number, anios: number): number {
  const i = Math.pow(1 + anualPct / 100, 1 / 12) - 1;
  return m * ((Math.pow(1 + i, anios * 12) - 1) / i);
}

const corriente = (m: Movimiento) => m.clase === "gasto" && !m.extraordinario;
const suma = (filas: Movimiento[]) => filas.reduce((s, m) => s + Number(m.monto), 0);

/** Qué tan apretado o sano está cada frente, para elegir los tips. */
interface Contexto {
  tasaMax: number;
  hayDeuda: boolean;
  variasDeudas: boolean;
  tarjeta: boolean;
  hormigaAnual: number;
  inflacion: number;
  mesHoy: number;
}

// --- tips de educación financiera ----------------------------------------------------

interface Tip {
  id: string;
  titulo: string;
  /** 0 = no aplica; más alto = más útil para ellos ahora. */
  relevancia: (c: Contexto, e: EntradaOraculo) => number;
  cuerpo: (c: Contexto, e: EntradaOraculo) => string;
  ir?: { texto: string; ruta: string };
}

const TIPS: Tip[] = [
  {
    id: "pago-minimo",
    titulo: "El pago mínimo es una trampa amable",
    relevancia: (c) => (c.tarjeta ? 9 : 0),
    cuerpo: (c) =>
      `El mínimo de la tarjeta cubre sobre todo intereses: el saldo casi no baja. A ${c.tasaMax.toString().replace(".", ",")} % E.A., pagar solo el mínimo puede convertir una compra en años de cuotas. Paguen el total del mes siempre que puedan.`,
  },
  {
    id: "regla-72",
    titulo: "La regla del 72",
    relevancia: (c) => (c.hayDeuda ? 6 : 4),
    cuerpo: (c) =>
      c.hayDeuda
        ? `Dividan 72 por la tasa y sabrán en cuántos años se duplica algo. Su deuda más cara, al ${c.tasaMax.toString().replace(".", ",")} %, se duplicaría en unos ${(72 / Math.max(c.tasaMax, 1)).toFixed(1).replace(".", ",")} años si no se pagara.`
        : "Dividan 72 por la tasa anual y sabrán en cuántos años se duplica algo. Al 8 %, en unos 9 años; al 12 %, en 6.",
  },
  {
    id: "avalancha-bola",
    titulo: "Avalancha o bola de nieve",
    relevancia: (c) => (c.variasDeudas ? 7 : 0),
    cuerpo: () =>
      "Avalancha: todo lo extra a la deuda de mayor tasa; es la que menos intereses paga. Bola de nieve: a la de menor saldo; paga un poco más, pero cada deuda que desaparece da ánimo. La mejor es la que de verdad sostengan.",
    ir: { texto: "Ver su plan de deudas", ruta: "/deudas" },
  },
  {
    id: "colchon",
    titulo: "Por qué de 3 a 6 meses de colchón",
    relevancia: (_c, e) => (e.f.mesesColchon < 3 ? 8 : 0),
    cuerpo: (_c, e) =>
      `Es lo que tarda, en promedio, conseguir un nuevo ingreso o salir de una emergencia médica. A ustedes un mes les cuesta ${e.$(e.f.costoVida)}: tres meses son ${e.$(e.f.costoVida * 3)}.`,
  },
  {
    id: "pagarse-primero",
    titulo: "Páguense primero",
    relevancia: (_c, e) => (e.f.tasaAhorro < 0.15 ? 7 : 2),
    cuerpo: () =>
      "Programen la transferencia al ahorro para el mismo día en que llega el sueldo, no para fin de mes. Lo que se ahorra primero se ahorra; lo que se ahorra «con lo que sobre» casi nunca llega.",
  },
  {
    id: "estilo-de-vida",
    titulo: "Cuando sube el ingreso, que suba primero el ahorro",
    relevancia: () => 3,
    cuerpo: () =>
      "Con cada aumento, el gasto tiende a subir solo hasta comérselo. Una regla simple: la mitad de cada aumento va al ahorro antes de acostumbrarse a gastarla.",
  },
  {
    id: "costo-oportunidad",
    titulo: "El costo de oportunidad",
    relevancia: (c) => (c.hormigaAnual > 0 ? 6 : 0),
    cuerpo: (c, e) =>
      `Cada gasto es también lo que esa plata no hizo. Sus compras pequeñas suman unos ${e.$(c.hormigaAnual)} al año: ${c.hayDeuda ? "abonados a la deuda más cara, ahorrarían intereses a su tasa" : "invertidos, empezarían a rendir por su cuenta"}.`,
    ir: { texto: "Ver sus hábitos", ruta: "/habitos" },
  },
  {
    id: "cuatro-por-mil",
    titulo: "El 4×1000 se puede evitar en una cuenta",
    relevancia: (_c, e) => (e.activos.length > 0 ? 4 : 3),
    cuerpo: () =>
      "Cada retiro o transferencia paga 4 pesos por cada 1.000. Pueden marcar una cuenta de ahorros como exenta (hasta un tope mensual): úsenla para el día a día y el impuesto deja de comerse una parte de todo lo que mueven.",
  },
  {
    id: "escalera-cdt",
    titulo: "La escalera de CDT",
    relevancia: (_c, e) => (e.activos.some((a) => a.tipo === "cdt") || e.f.mesesColchon >= 3 ? 5 : 0),
    cuerpo: () =>
      "En vez de un CDT grande, varios pequeños que vencen en meses distintos. Tienen plata disponible más seguido y, si las tasas suben, solo una parte queda amarrada a la tasa vieja.",
    ir: { texto: "Ver su patrimonio", ruta: "/patrimonio" },
  },
  {
    id: "interes-compuesto",
    titulo: "El tiempo pesa más que la tasa",
    relevancia: (_c, e) => (e.f.tasaAhorro > 0 ? 4 : 2),
    cuerpo: (_c, e) =>
      `Ahorrar ${e.$(200_000)} al mes desde hoy al 4 % real llega a unos ${e.$(valorFuturo(200_000, 4, 10))} en 10 años y ${e.$(valorFuturo(200_000, 4, 20))} en 20: los segundos diez años producen más que los primeros. Empezar pronto vale más que empezar con mucho.`,
  },
  {
    id: "cesantias",
    titulo: "Las cesantías no son plata de bolsillo",
    relevancia: (_c, e) => (e.ingresos.some((i) => i.con_prestaciones) ? 5 : 1),
    cuerpo: () =>
      "Son un seguro para quedarse sin empleo y, mientras tanto, solo se retiran para vivienda o educación. Tratarlas como ahorro de largo plazo, no como un ingreso más, es lo que las hace valer.",
  },
  {
    id: "prima",
    titulo: "Decidan la prima antes de que llegue",
    relevancia: (c, e) => ((c.mesHoy === 5 || c.mesHoy === 11) && e.ingresos.some((i) => i.con_prestaciones) ? 9 : 0),
    cuerpo: () =>
      "Una plata que llega sin plan se diluye en semanas. Repartirla antes —una parte a la deuda, otra al colchón, otra al gusto— hace que rinda y que se disfrute sin culpa.",
    ir: { texto: "Plan para la prima", ruta: "/proyeccion" },
  },
  {
    id: "compras-a-cuotas",
    titulo: "A una cuota, siempre que se pueda",
    relevancia: (c) => (c.tarjeta ? 6 : 1),
    cuerpo: () =>
      "Diferir una compra en 36 cuotas puede costar casi la mitad de su valor en intereses. Si no se puede pagar a una cuota, vale la pena preguntarse si es el momento de comprarlo.",
    ir: { texto: "Calcularlo", ruta: "/credito" },
  },
  {
    id: "usura",
    titulo: "Hay un máximo legal para los intereses",
    relevancia: (c) => (c.hayDeuda ? 4 : 0),
    cuerpo: () =>
      "La tasa de usura, que certifica la Superintendencia Financiera, es el tope que se puede cobrar en un crédito de consumo. Si una tasa la supera, es ilegal y se puede reclamar.",
    ir: { texto: "Compararla con sus deudas", ruta: "/credito" },
  },
  {
    id: "comparar-ea",
    titulo: "Siempre comparen en E.A.",
    relevancia: (c) => (c.hayDeuda ? 5 : 3),
    cuerpo: () =>
      "«1,9 % mensual» suena más barato que «25 % anual», y son la misma tasa. La efectiva anual es la única forma honesta de comparar dos ofertas.",
    ir: { texto: "Traductor de tasas", ruta: "/credito" },
  },
  {
    id: "base-cero",
    titulo: "Presupuesto base cero",
    relevancia: (_c, e) => (e.f.libre < 0 ? 9 : 2),
    cuerpo: (_c, e) =>
      e.f.libre < 0
        ? `Cada peso que entra se asigna a algo, y la suma no puede pasar del ingreso. Hoy lo asignado supera en ${e.$(-e.f.libre)} lo que entra: hay que bajar metas o gastos hasta que cuadre.`
        : "Cada peso que entra se asigna a algo —gasto, deuda, meta— hasta que no quede nada sin destino. Lo que no tiene destino se gasta solo.",
    ir: { texto: "Ajustar el presupuesto", ruta: "/presupuesto" },
  },
  {
    id: "regla-24-horas",
    titulo: "La regla de las 24 horas",
    relevancia: (c) => (c.hormigaAnual > 0 ? 4 : 2),
    cuerpo: () =>
      "Ante una compra no planeada, esperen un día. Si al otro día todavía la quieren, adelante. La mayoría de las compras impulsivas no pasan esa prueba.",
  },
  {
    id: "diversificar",
    titulo: "No todos los huevos en la misma canasta",
    relevancia: (_c, e) => (e.activos.some((a) => TIPOS_ACTIVO[a.tipo].grupo === "invertido") ? 5 : 0),
    cuerpo: () =>
      "Repartir entre tipos de inversión y plazos reduce el golpe de que a uno le vaya mal. Y la plata que se va a usar pronto no debería estar donde puede caer.",
    ir: { texto: "Dónde guardar cada meta", ruta: "/patrimonio" },
  },
  {
    id: "inflacion",
    titulo: "La inflación es un impuesto silencioso",
    relevancia: (_c, e) => (e.activos.length > 0 ? 4 : 3),
    cuerpo: (c, e) =>
      `Con una inflación del ${c.inflacion.toString().replace(".", ",")} %, ${e.$(1_000_000)} quietos compran en un año lo que hoy compran ${e.$(1_000_000 / (1 + c.inflacion / 100))}. Lo guardado tiene que rendir al menos eso para no perder.`,
  },
];

// --- consejos que salen de los datos ---------------------------------------------------

const FUENTE_SUGERENCIA: Record<string, Fuente> = {
  "colchon-minimo": "metas",
  "sobrante-a-deuda": "deudas",
  "sobrante-a-metas": "metas",
  "ahorro-vs-deuda": "deudas",
  "cuotas-liberadas": "deudas",
  "recorte-gustos": "presupuesto",
  "cuota-insuficiente": "deudas",
  "colchon-tres": "metas",
  "colchon-de-sobra": "metas",
  "reparto-desigual": "pareja",
  "gasto-mayor-ingreso": "presupuesto",
};

export function analizar(e: EntradaOraculo): Analisis {
  const hoy = e.hoy ?? new Date();
  const mesHoy = mesIso(hoy);
  const mesPasadoFecha = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1);
  const mesPasado = mesIso(mesPasadoFecha);
  const dia = hoy.getDate();
  const diasMes = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0).getDate();
  const nombreMes = (d: Date) => MESES[d.getMonth()];
  const consejos: Mensaje[] = [];
  const agregar = (m: Omit<Mensaje, "tipo">) => consejos.push({ ...m, tipo: "consejo" });

  // 0 · Lo que ya sabía el motor de presupuesto y deudas.
  for (const s of generarSugerencias({
    finanzas: e.f,
    deudas: e.deudas,
    metas: e.metas,
    estrategia: e.hogar?.estrategia_deuda ?? "avalancha",
    fmt: { moneda: e.$, meses: e.meses, pct: e.pct },
  })) {
    agregar({ ...s, prioridad: s.prioridad * 10, fuente: FUENTE_SUGERENCIA[s.id] ?? "presupuesto" });
  }

  // 1 · Movimientos: registro al día.
  const ultimo = e.movimientos.reduce((max, m) => (m.fecha > max ? m.fecha : max), "");
  if (!ultimo) {
    agregar({
      id: "sin-movimientos",
      titulo: "Empiecen a registrar lo que gastan",
      cuerpo: "Sin movimientos no puedo ver cómo va el mes de verdad: solo el plan. Anoten los gastos o importen el extracto del banco.",
      prioridad: 15,
      tono: "warn",
      fuente: "movimientos",
      ir: { texto: "Anotar un movimiento", ruta: "/movimientos" },
    });
  } else {
    const dias = Math.floor((hoy.getTime() - new Date(`${ultimo}T00:00:00`).getTime()) / 86_400_000);
    if (dias >= 5) {
      agregar({
        id: "registro-atrasado",
        titulo: `Llevan ${dias} días sin registrar movimientos`,
        cuerpo: "Lo que no se anota no se puede analizar. Pónganse al día: cinco minutos ahora evitan que el cierre del mes salga incompleto.",
        prioridad: 25,
        tono: "neutro",
        fuente: "movimientos",
        ir: { texto: "Ir a Movimientos", ruta: "/movimientos" },
      });
    }
  }

  // 2 · Movimientos: el ritmo del mes contra el presupuesto.
  const delMes = e.movimientos.filter((m) => m.fecha.startsWith(mesHoy));
  const gastadoMes = suma(delMes.filter(corriente));
  const presupuestoMes = e.gastos.reduce((s, g) => s + gastoMensual(g), 0);
  const colchon = e.metas.find((m) => m.es_emergencia);
  if (dia >= 7 && presupuestoMes > 0 && gastadoMes > 0) {
    const proyeccion = (gastadoMes / dia) * diasMes;
    if (proyeccion > presupuestoMes * 1.05) {
      agregar({
        id: "ritmo-alto",
        titulo: `A este ritmo, ${nombreMes(hoy)} cierra en ${e.$(proyeccion)}`,
        cuerpo: `Llevan ${e.$(gastadoMes)} en ${dia} días. Si siguen igual, el mes se pasaría ${e.$(proyeccion - presupuestoMes)} del presupuesto (${e.$(presupuestoMes)}). Los gastos fijos grandes de inicio de mes pueden inflar el cálculo: miren qué categorías empujan.`,
        impacto: `+${e.pct(proyeccion / presupuestoMes - 1)} sobre lo planeado`,
        prioridad: 12,
        tono: "warn",
        fuente: "movimientos",
        ir: { texto: "Ver la comparativa", ruta: "/movimientos" },
        comoSeCalcula: "Gasto corriente del mes ÷ días transcurridos × días del mes.",
      });
    } else if (dia >= 15 && proyeccion < presupuestoMes * 0.85) {
      agregar({
        id: "ritmo-bajo",
        titulo: `Van por debajo del presupuesto de ${nombreMes(hoy)}`,
        cuerpo: `A este ritmo cerrarían en ${e.$(proyeccion)}, unos ${e.$(presupuestoMes - proyeccion)} menos de lo planeado. Decidan desde ya a dónde va esa diferencia —${e.f.mesesColchon < 3 ? "el colchón" : "la deuda más cara"}— antes de que se gaste sola.`,
        prioridad: 30,
        tono: "ok",
        fuente: "movimientos",
        accion: colchon ? { tipo: "sumar-colchon", metaId: colchon.id, monto: Math.round((presupuestoMes - proyeccion) / 1000) * 1000 } : undefined,
      });
    }
  }

  // 3 · Movimientos: la categoría que más se disparó frente al mes pasado, al mismo día.
  const porCat = (filas: Movimiento[]) => {
    const mapa = new Map<string, number>();
    for (const m of filas.filter(corriente)) mapa.set(m.categoria, (mapa.get(m.categoria) ?? 0) + Number(m.monto));
    return mapa;
  };
  const hastaHoyPasado = e.movimientos.filter(
    (m) => m.fecha.startsWith(mesPasado) && Number(m.fecha.slice(8, 10)) <= dia,
  );
  const ahora = porCat(delMes);
  const antes = porCat(hastaHoyPasado);
  let peor: { cat: string; ahora: number; antes: number } | null = null;
  for (const [cat, valor] of ahora) {
    const previo = antes.get(cat) ?? 0;
    if (previo <= 0 || valor - previo < 50_000 || valor < previo * 1.3) continue;
    if (!peor || valor - previo > peor.ahora - peor.antes) peor = { cat, ahora: valor, antes: previo };
  }
  if (peor) {
    agregar({
      id: `categoria-sube-${peor.cat}`,
      titulo: `${e.etiqueta(peor.cat)} va ${e.pct(peor.ahora / peor.antes - 1)} por encima de ${nombreMes(mesPasadoFecha)}`,
      cuerpo: `Al día ${dia} llevan ${e.$(peor.ahora)} en ${e.etiqueta(peor.cat).toLowerCase()}, contra ${e.$(peor.antes)} a la misma altura del mes pasado. ¿Fue algo puntual o es un hábito nuevo?`,
      impacto: `+${e.$(peor.ahora - peor.antes)}`,
      prioridad: 18,
      tono: "warn",
      fuente: "movimientos",
      ir: { texto: "Ver el detalle", ruta: "/movimientos" },
    });
  }

  // 4 · Movimientos: gastos hormiga.
  const hormiga = gastosHormiga(e.movimientos, 50_000, hoy);
  if (hormiga.mensual > 0 && presupuestoMes > 0 && hormiga.mensual / presupuestoMes >= 0.05 && hormiga.grupos[0]) {
    const top = hormiga.grupos[0];
    agregar({
      id: "hormiga",
      titulo: `Las compras pequeñas suman ${e.$(hormiga.anual)} al año`,
      cuerpo: `Promedian ${e.$(hormiga.mensual)} al mes. La que más pesa: «${top.nombre}», ${top.veces} ${top.veces === 1 ? "vez" : "veces"}. No se trata de quitarlas todas, sino de decidir cuáles valen lo que cuestan.`,
      impacto: `${e.pct(hormiga.mensual / presupuestoMes)} del gasto`,
      prioridad: 28,
      tono: "neutro",
      fuente: "movimientos",
      ir: { texto: "Ver sus hábitos", ruta: "/habitos" },
    });
  }

  // 5 · Pareja: el bote del mes pasado sin saldar.
  if (e.idB) {
    const liq = liquidarMes(
      e.movimientos.filter((m) => m.fecha.startsWith(mesPasado)),
      e.idA,
      e.idB,
      e.hogar?.reparto ?? "proporcional",
      e.f.participacionA,
    );
    if (liq.totalCompartido > 0 && Math.abs(liq.neto) >= 1) {
      agregar({
        id: "bote-pendiente",
        titulo: `El bote de ${nombreMes(mesPasadoFecha)} sigue sin saldar`,
        cuerpo: `${e.nombreDe(liq.neto > 0 ? e.idB : e.idA)} le debe ${e.$(Math.abs(liq.neto))} a ${e.nombreDe(liq.neto > 0 ? e.idA : e.idB)}. Las cuentas claras evitan las discusiones que no son de plata.`,
        prioridad: 16,
        tono: "warn",
        fuente: "pareja",
        accion: {
          tipo: "saldar-bote",
          mes: mesPasado,
          deudor: (liq.neto > 0 ? e.idB : e.idA) as string,
          monto: Math.abs(liq.neto),
          texto: `${e.nombreDe(liq.neto > 0 ? e.idB : e.idA)} ya le pasó ${e.$(Math.abs(liq.neto))}`,
        },
      });
    }
  }

  // 6 · Deudas: las que terminan pronto, las que superan la usura, las que no tienen día de pago.
  const vivas = e.deudas.filter((d) => Number(d.saldo) > 0.5);
  const porTerminar = vivas
    .map((d) => ({ d, meses: mesesConSuCuota(d) }))
    .filter((x) => x.meses > 0 && x.meses <= 2 && Number(x.d.cuota) > 0);
  for (const { d, meses } of porTerminar) {
    agregar({
      id: `termina-${d.id}`,
      titulo: `A «${d.nombre || "una deuda"}» le ${meses === 1 ? "queda 1 cuota" : `quedan ${meses} cuotas`}`,
      cuerpo: `Cuando termine se liberan ${e.$(Number(d.cuota))} al mes. Decidan hoy a dónde van —${e.f.mesesColchon < 3 ? "al colchón, que está corto" : vivas.length > 1 ? "a la siguiente deuda" : "a sus metas"}—; si no, se reparten solos en el gasto del mes.`,
      impacto: `${e.$(Number(d.cuota))} libres al mes`,
      prioridad: 14,
      tono: "ok",
      fuente: "deudas",
      ir: { texto: "Ver el plan", ruta: "/deudas" },
    });
  }
  const usura = e.hogar?.tasa_usura ? Number(e.hogar.tasa_usura) : null;
  if (usura !== null) {
    for (const d of vivas.filter((x) => Number(x.tasa_ea) > usura)) {
      agregar({
        id: `usura-${d.id}`,
        titulo: `«${d.nombre || "Una deuda"}» cobra por encima de la usura`,
        cuerpo: `Su tasa (${Number(d.tasa_ea).toString().replace(".", ",")} % E.A.) supera la tasa de usura que guardaron (${usura.toString().replace(".", ",")} %). Cobrar por encima es ilegal: pidan la revisión al banco.`,
        prioridad: 5,
        tono: "crit",
        fuente: "deudas",
        ir: { texto: "Laboratorio de crédito", ruta: "/credito" },
      });
    }
  }
  const deudasSinDia = vivas.filter((d) => !d.dia_pago && Number(d.cuota) > 0);
  const sinDia = deudasSinDia.length;
  if (sinDia > 0) {
    agregar({
      id: "sin-dia-pago",
      titulo: `${sinDia} ${sinDia === 1 ? "deuda no tiene" : "deudas no tienen"} día de pago`,
      cuerpo: "Sin el día de pago no puedo avisarles por correo cuando una cuota está por vencer.",
      prioridad: 40,
      tono: "neutro",
      fuente: "deudas",
      accion: { tipo: "dias-pago", deudas: deudasSinDia.map((d) => ({ id: d.id, nombre: d.nombre || "Sin nombre" })) },
    });
  }

  // 7 · Metas: las que se cumplen pronto y las que no tienen aporte.
  for (const m of e.metas) {
    const falta = Number(m.objetivo) - Number(m.acumulado);
    const aporte = Number(m.aporte);
    if (falta > 0 && aporte > 0 && falta <= aporte) {
      agregar({
        id: `meta-cumple-${m.id}`,
        titulo: `«${m.nombre || "Una meta"}» se cumple el próximo aporte`,
        cuerpo: `Le faltan ${e.$(falta)}. Celébrenlo, y decidan ya a qué meta pasa el aporte de ${e.$(aporte)} para que no se diluya.`,
        prioridad: 22,
        tono: "ok",
        fuente: "metas",
        accion: {
          tipo: "mover-aporte",
          desdeId: m.id,
          aporte,
          opciones: e.metas
            .filter((o) => o.id !== m.id && Number(o.objetivo) > Number(o.acumulado))
            .map((o) => ({ id: o.id, nombre: o.nombre || "Sin nombre" })),
        },
      });
    } else if (falta > 0 && aporte <= 0 && !m.es_emergencia) {
      agregar({
        id: `meta-sin-aporte-${m.id}`,
        titulo: `«${m.nombre || "Una meta"}» no tiene aporte mensual`,
        cuerpo: `Le faltan ${e.$(falta)} y no avanza sola. Un aporte, aunque sea pequeño, la vuelve un plan con fecha.`,
        prioridad: 35,
        tono: "neutro",
        fuente: "metas",
        accion: {
          tipo: "aporte-meta",
          metaId: m.id,
          sugerido: Math.max(10_000, Math.round(Math.min(falta / 12, e.f.libre > 0 ? e.f.libre : falta / 12) / 1000) * 1000),
        },
      });
    }
  }

  // 8 · Presupuesto: pagos no mensuales sin mes.
  const gastosSinMes = e.gastos.filter((g) => g.frecuencia !== "mensual" && g.frecuencia !== "quincenal" && !g.mes_pago);
  const sinMes = gastosSinMes.length;
  if (sinMes > 0) {
    agregar({
      id: "sin-mes-pago",
      titulo: `${sinMes} ${sinMes === 1 ? "pago no mensual no tiene" : "pagos no mensuales no tienen"} mes`,
      cuerpo: "Sin el mes de pago la proyección los reparte parejo y no puedo avisarles cuando se acercan.",
      prioridad: 42,
      tono: "neutro",
      fuente: "presupuesto",
      accion: {
        tipo: "meses-pago",
        gastos: gastosSinMes.map((g) => ({ id: g.id, concepto: g.concepto || g.categoria, frecuencia: g.frecuencia })),
      },
    });
  }

  // 9 · Proyección: el próximo mes en rojo con un pago puntual.
  const proximos = proyectarFlujo({ ingresos: e.ingresos, gastos: e.gastos, deudas: e.deudas, metas: e.metas, meses: 4, desde: hoy }).slice(1);
  const rojo = proximos.find((m) => m.neto < 0 && m.eventos.some((ev) => ev.tipo === "sale"));
  if (rojo) {
    const pagos = rojo.eventos.filter((ev) => ev.tipo === "sale");
    agregar({
      id: `proyeccion-rojo-${rojo.periodo}`,
      titulo: `En ${rojo.nombre} les faltarían ${e.$(-rojo.neto)}`,
      cuerpo: `Ese mes caen ${pagos.map((p) => `${p.texto} (${e.$(p.monto)})`).join(", ")}. Si empiezan a apartar desde ya, llegan sin apuro.`,
      prioridad: 13,
      tono: "warn",
      fuente: "proyección",
      ir: { texto: "Ver la proyección", ruta: "/proyeccion" },
    });
  }

  // 10 · Patrimonio: lo que no rinde y lo que falta registrar.
  const inflacion = e.hogar?.inflacion_ref ? Number(e.hogar.inflacion_ref) : 5;
  if (e.activos.length === 0) {
    agregar({
      id: "sin-activos",
      titulo: "Registren lo que tienen",
      cuerpo: "Sin sus cuentas, cesantías y pensión no puedo calcular su patrimonio ni decirles si lo guardado está rindiendo.",
      prioridad: 45,
      tono: "neutro",
      fuente: "patrimonio",
      ir: { texto: "Ir a Patrimonio", ruta: "/patrimonio" },
    });
  } else {
    for (const a of e.activos) {
      const r = rentabilidad(a, inflacion);
      if (!r || r.real >= 0 || Number(a.valor) <= 0 || TIPOS_ACTIVO[a.tipo].grupo === "bienes") continue;
      agregar({
        id: `pierde-${a.id}`,
        titulo: `«${a.nombre || TIPOS_ACTIVO[a.tipo].nombre}» pierde contra la inflación`,
        cuerpo: `Rinde ${r.neta.toFixed(1).replace(".", ",")} % después de impuestos y la inflación va en ${inflacion.toString().replace(".", ",")} %: cada año compra menos. Si no lo necesitan a la vista, busquen una opción que le gane.`,
        impacto: `${r.real.toFixed(1).replace(".", ",")} % real`,
        prioridad: 32,
        tono: "warn",
        fuente: "patrimonio",
        ir: { texto: "Ver cuánto rinde", ruta: "/patrimonio" },
      });
    }
  }

  // 11 · Decisiones: lo acordado y la reunión.
  const pendientes = e.decisiones.filter((d) => d.periodo.startsWith(mesPasado) && !d.cumplida);
  if (pendientes.length > 0) {
    agregar({
      id: "decisiones-pendientes",
      titulo: `${pendientes.length} ${pendientes.length === 1 ? "decisión" : "decisiones"} de ${nombreMes(mesPasadoFecha)} sin cumplir`,
      cuerpo: `Por ejemplo: «${pendientes[0].texto || "sin texto"}». Revisen si sigue en pie o si la sueltan.`,
      prioridad: 20,
      tono: "neutro",
      fuente: "pareja",
      ir: { texto: "Ir a la reunión", ruta: "/reunion" },
    });
  }
  if (dia >= 5 && !e.decisiones.some((d) => d.periodo.startsWith(mesHoy))) {
    agregar({
      id: "sin-reunion",
      titulo: `Aún no hacen la reunión de ${nombreMes(hoy)}`,
      cuerpo: "Media hora juntos al mes —revisar, saldar, acordar tres cosas— vale más que cualquier gráfico.",
      prioridad: 24,
      tono: "neutro",
      fuente: "pareja",
      ir: { texto: "Hacer la reunión", ruta: "/reunion" },
    });
  }

  // El aviso genérico de cuotas liberadas sobra cuando ya hay uno con nombre propio.
  const finales = porTerminar.length > 0 ? consejos.filter((c) => c.id !== "cuotas-liberadas") : consejos;

  // 12 · Seguimiento: lo que adoptaron el mes pasado, ¿se cumplió según los datos?
  const idsActuales = new Set(finales.map((c) => c.id));
  for (const d of e.decisiones.filter((x) => x.periodo.startsWith(mesPasado) && x.origen && !x.cumplida)) {
    const ev = evaluarDecision(d, { ids: idsActuales, movimientos: e.movimientos, presupuestoMes, etiqueta: e.etiqueta, $: e.$, hoy });
    if (!ev || ev.estado === "en-curso") continue;
    finales.push({
      id: `seguimiento-${d.id}`,
      tipo: "consejo",
      titulo: ev.estado === "lograda" ? `Lo lograron: «${d.texto}»` : `Sigue pendiente: «${d.texto}»`,
      cuerpo:
        ev.estado === "lograda"
          ? `${ev.texto} Márquenla como cumplida: lo que se celebra se repite.`
          : `${ev.texto} Decidan si la mantienen este mes o la sueltan.`,
      prioridad: 8,
      tono: ev.estado === "lograda" ? "ok" : "warn",
      fuente: "pareja",
      accion: ev.estado === "lograda" ? { tipo: "marcar-cumplida", decisionId: d.id } : undefined,
      ir: ev.estado === "sigue" ? { texto: "Revisarla en la reunión", ruta: "/reunion" } : undefined,
    });
  }

  // --- tips ---
  const tasaMax = Math.max(0, ...vivas.map((d) => Number(d.tasa_ea)));
  const contexto: Contexto = {
    tasaMax,
    hayDeuda: vivas.length > 0,
    variasDeudas: vivas.length > 1,
    tarjeta: vivas.some((d) => /tarjeta|tc\b|visa|master/i.test(d.nombre) || Number(d.tasa_ea) >= 25),
    hormigaAnual: hormiga.anual,
    inflacion,
    mesHoy: hoy.getMonth() + 1,
  };
  const tips: Mensaje[] = TIPS.map((t) => ({ t, r: t.relevancia(contexto, e) }))
    .filter((x) => x.r > 0)
    .sort((a, b) => b.r - a.r)
    .map(({ t, r }) => ({
      id: `tip-${t.id}`,
      tipo: "tip" as const,
      titulo: t.titulo,
      cuerpo: t.cuerpo(contexto, e),
      prioridad: 100 - r,
      tono: "neutro" as const,
      fuente: "educación" as const,
      ir: t.ir,
    }));

  const meses = new Set(e.movimientos.map((m) => m.fecha.slice(0, 7))).size;
  return {
    consejos: finales.sort((a, b) => a.prioridad - b.prioridad),
    tips,
    lectura: {
      movimientos: e.movimientos.length,
      meses,
      deudas: vivas.length,
      metas: e.metas.length,
      activos: e.activos.length,
    },
  };
}

// --- seguimiento de decisiones ---------------------------------------------------------

export interface Evaluacion {
  estado: "lograda" | "sigue" | "en-curso";
  texto: string;
}

interface ContextoEvaluacion {
  /** Ids de los consejos que el oráculo detecta hoy. */
  ids: Set<string>;
  movimientos: Movimiento[];
  presupuestoMes: number;
  etiqueta: (c: string) => string;
  $: (n: number) => string;
  hoy?: Date;
}

const sumarMeses = (mes: string, n: number) => {
  const [a, m] = mes.split("-").map(Number);
  return mesIso(new Date(a, m - 1 + n, 1));
};

/**
 * ¿Se cumplió lo que adoptaron? Para los consejos que se pueden medir
 * (una categoría que se disparó, los gastos hormiga, el ritmo del mes) se
 * compara el mes en que lo adoptaron con el siguiente; para los demás, si el
 * oráculo ya no detecta el problema, se dio por resuelto. Las decisiones
 * escritas a mano (sin consejo de origen) no se evalúan.
 */
export function evaluarDecision(d: Decision, c: ContextoEvaluacion): Evaluacion | null {
  if (!d.origen) return null;
  const hoy = c.hoy ?? new Date();
  const mesHoy = mesIso(hoy);
  const mes = d.periodo.slice(0, 7);
  const despues = sumarMeses(mes, 1);
  // Si el mes siguiente aún va en curso, se compara hasta el mismo día.
  const hasta = despues === mesHoy ? hoy.getDate() : 31;
  const delMes = (m: string, filtro: (x: Movimiento) => boolean) =>
    suma(c.movimientos.filter((x) => x.fecha.startsWith(m) && Number(x.fecha.slice(8, 10)) <= hasta && corriente(x) && filtro(x)));

  if (despues > mesHoy) {
    return c.ids.has(d.origen) ? { estado: "en-curso", texto: "En curso este mes." } : { estado: "lograda", texto: "El oráculo ya no lo detecta." };
  }

  if (d.origen.startsWith("categoria-sube-")) {
    const cat = d.origen.slice("categoria-sube-".length);
    const antes = delMes(mes, (x) => x.categoria === cat);
    const ahora = delMes(despues, (x) => x.categoria === cat);
    return ahora < antes
      ? { estado: "lograda", texto: `${c.etiqueta(cat)} bajó de ${c.$(antes)} a ${c.$(ahora)}.` }
      : { estado: "sigue", texto: `${c.etiqueta(cat)} pasó de ${c.$(antes)} a ${c.$(ahora)}.` };
  }
  if (d.origen === "hormiga") {
    const pequeno = (x: Movimiento) => Number(x.monto) <= 50_000;
    const antes = delMes(mes, pequeno);
    const ahora = delMes(despues, pequeno);
    return ahora < antes
      ? { estado: "lograda", texto: `Las compras pequeñas bajaron de ${c.$(antes)} a ${c.$(ahora)}.` }
      : { estado: "sigue", texto: `Las compras pequeñas pasaron de ${c.$(antes)} a ${c.$(ahora)}.` };
  }
  if (d.origen === "ritmo-alto" && c.presupuestoMes > 0) {
    const gastado = delMes(despues, () => true);
    const tope = (c.presupuestoMes * hasta) / 31;
    return gastado <= tope
      ? { estado: "lograda", texto: `El gasto corriente quedó en ${c.$(gastado)}, dentro del presupuesto.` }
      : { estado: "sigue", texto: `El gasto corriente va en ${c.$(gastado)}, por encima de lo planeado.` };
  }
  return c.ids.has(d.origen)
    ? { estado: "sigue", texto: "El oráculo todavía lo detecta en sus datos." }
    : { estado: "lograda", texto: "Según los datos, ya quedó resuelto." };
}

/** Consejos y tips intercalados: dos consejos y luego un tip, mientras alcancen. */
export function intercalar(consejos: Mensaje[], tips: Mensaje[]): Mensaje[] {
  const salida: Mensaje[] = [];
  let c = 0;
  let t = 0;
  while (c < consejos.length || t < tips.length) {
    for (let k = 0; k < 2 && c < consejos.length; k++) salida.push(consejos[c++]);
    if (t < tips.length) salida.push(tips[t++]);
  }
  return salida;
}
