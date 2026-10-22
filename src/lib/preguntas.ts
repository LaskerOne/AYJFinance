import type { Finanzas } from "@/lib/calculos";
import { gastoMensual } from "@/lib/calculos";
import { compraConTarjeta } from "@/lib/credito";
import { conAbonoUnico, simularDeudas } from "@/lib/deudas";
import { MESES } from "@/lib/formato";
import type { ResumenPatrimonio } from "@/lib/patrimonio";
import type { Puntaje } from "@/lib/salud";
import { CATEGORIAS, type Deuda, type GastoPresupuesto, type Hogar, type Movimiento } from "@/models/dominio";

/**
 * Preguntas al oráculo, en español corriente.
 *
 * No es un modelo de lenguaje: reconoce un conjunto de preguntas (si se
 * puede gastar algo, cuánto llevan gastado, cuándo salen de deudas, qué
 * pasa si abonan, cuánto ahorrar para algo…), saca de la frase el monto, el
 * plazo y la categoría, y responde con cálculos sobre sus propios datos.
 * Cuando no entiende, lo dice y muestra lo que sí sabe responder.
 */

export interface Respuesta {
  titulo: string;
  lineas: string[];
  tono: "ok" | "warn" | "crit" | "neutro";
  ir?: { texto: string; ruta: string };
  entendida: boolean;
}

export interface ContextoPregunta {
  f: Finanzas;
  movimientos: Movimiento[];
  gastos: GastoPresupuesto[];
  deudas: Deuda[];
  hogar: Hogar | null;
  resumen: ResumenPatrimonio;
  puntaje: Puntaje;
  nivel: string | null;
  etiqueta: (c: string) => string;
  $: (n: number) => string;
  meses: (n: number) => string;
  hoy?: Date;
}

export const EJEMPLOS = [
  "¿Podemos gastar 800 mil en un viaje?",
  "¿Cuánto llevamos gastado en ocio?",
  "¿Cuándo salimos de deudas?",
  "¿Qué pasa si abonamos 300 mil más al mes?",
  "Queremos ahorrar 3 millones en 6 meses",
  "¿Cómo vamos?",
];

// --- lectura de la frase ------------------------------------------------------------------

export function normalizar(t: string): string {
  return t
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[¿?¡!]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const aNum = (t: string) => Number(t.replace(",", "."));

/** «800 mil», «1,5 millones», «medio millón», «$2.000.000», «2000000». */
export function leerMonto(frase: string): number | null {
  const t = normalizar(frase);
  if (/medio millon/.test(t)) return 500_000;
  let m = t.match(/(\d+(?:[.,]\d+)?)\s*(?:millones|millon|mill|palos?)\b/);
  if (m) return Math.round(aNum(m[1]) * 1_000_000);
  m = t.match(/(\d+(?:[.,]\d+)?)\s*(?:mil|k)\b/);
  if (m) return Math.round(aNum(m[1]) * 1_000);
  m = t.match(/\$?\s*(\d{1,3}(?:[.,]\d{3})+)/);
  if (m) return Number(m[1].replace(/[.,]/g, ""));
  m = t.match(/\$?\s*(\d{4,})/);
  if (m) return Number(m[1]);
  return null;
}

/** «en 6 meses», «en un año», «para diciembre» → meses desde hoy. */
export function leerPlazo(frase: string, hoy = new Date()): number | null {
  const t = normalizar(frase);
  let m = t.match(/en (\d+) mes/);
  if (m) return Number(m[1]);
  m = t.match(/en (\d+) anos?/);
  if (m) return Number(m[1]) * 12;
  if (/en un ano|en 1 ano/.test(t)) return 12;
  if (/en un mes/.test(t)) return 1;
  for (const [i, mes] of MESES.entries()) {
    if (new RegExp(`(para|en|antes de|a) ${mes}`).test(t)) {
      const faltan = (i - hoy.getMonth() + 12) % 12;
      return faltan === 0 ? 12 : faltan;
    }
  }
  return null;
}

function leerCategoria(frase: string, etiqueta: (c: string) => string): string | null {
  const t = normalizar(frase);
  for (const c of CATEGORIAS) {
    if (t.includes(normalizar(etiqueta(c))) || t.includes(normalizar(c))) return c;
  }
  return null;
}

// --- respuestas --------------------------------------------------------------------------------

const mesIso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

export function responder(pregunta: string, c: ContextoPregunta): Respuesta {
  const t = normalizar(pregunta);
  const hoy = c.hoy ?? new Date();
  const monto = leerMonto(pregunta);
  const plazo = leerPlazo(pregunta, hoy);
  const vivas = c.deudas.filter((d) => Number(d.saldo) > 0.5);
  const estrategia = c.hogar?.estrategia_deuda ?? "avalancha";
  const abonoActual = Number(c.hogar?.abono_extra ?? 0);
  const tasaMax = Math.max(0, ...vivas.map((d) => Number(d.tasa_ea)));
  const f = c.f;

  // ¿Qué pasa si abonamos X (al mes o de una vez)?
  if (/abon|prepag|(pagar|pagamos|pagarle|meter|metemos|meterle|echar|echamos|echarle|poner|ponemos|ponerle) mas/.test(t) && monto) {
    if (vivas.length === 0) return sinDeudas();
    const unaVez = /una vez|de una|unico|la prima|de golpe/.test(t);
    const antes = simularDeudas(c.deudas, abonoActual, estrategia, true);
    const despues = unaVez
      ? simularDeudas(conAbonoUnico(c.deudas, monto, estrategia), abonoActual, estrategia, true)
      : simularDeudas(c.deudas, abonoActual + monto, estrategia, true);
    if (antes.estancado || despues.estancado) {
      return { titulo: "Con las cuotas de hoy el saldo no baja", lineas: ["Alguna deuda tiene una cuota que no cubre sus intereses: primero hay que renegociarla."], tono: "crit", ir: { texto: "Ver el plan de deudas", ruta: "/deudas" }, entendida: true };
    }
    return {
      titulo: `Saldrían de deudas ${c.meses(Math.max(0, antes.meses - despues.meses))} antes`,
      lineas: [
        `${unaVez ? `Un abono único de ${c.$(monto)}` : `${c.$(monto)} más cada mes`} adelanta el final de ${c.meses(antes.meses)} a ${c.meses(despues.meses)}.`,
        `Se ahorran ${c.$(Math.max(0, antes.intereses - despues.intereses))} en intereses.`,
        unaVez ? "Va a la deuda prioritaria según su estrategia." : monto > Math.max(0, f.libre) ? `Ojo: hoy les quedan ${c.$(Math.max(0, f.libre))} libres al mes; para sostenerlo tendrían que ajustar gastos o metas.` : "Cabe en lo que les queda libre al mes.",
      ],
      tono: "ok",
      ir: unaVez ? { texto: "Ver el plan de deudas", ruta: "/deudas" } : { texto: "Verlo en el plan", ruta: `/deudas?abono=${abonoActual + monto}` },
      entendida: true,
    };
  }

  // ¿Podemos gastar X?
  if (/(podemos|puedo|alcanza|darnos|permitir|deberiamos|vale la pena).*(gastar|comprar|pagar|viaj|dar)|^(podemos|puedo) .*\d/.test(t) && monto) {
    const libre = Math.max(0, f.libre);
    const dias = f.costoVida > 0 ? monto / (f.costoVida / 30) : 0;
    const lineas: string[] = [];
    let titulo: string;
    let tono: Respuesta["tono"];
    if (monto <= libre) {
      titulo = "Sí, cabe en lo que les queda libre este mes";
      tono = "ok";
      lineas.push(`Les quedan ${c.$(libre)} sin asignar al mes: alcanza sin tocar metas ni colchón.`);
    } else if (monto <= Math.max(0, f.disponible)) {
      titulo = "Cabe, pero pausando aportes a metas";
      tono = "warn";
      lineas.push(`Después de gastos y cuotas quedan ${c.$(f.disponible)}; tendrían que pausar ${c.$(monto - libre)} de aportes a metas este mes.`);
    } else if (monto <= f.fondo) {
      const quedaria = f.costoVida > 0 ? (f.fondo - monto) / f.costoVida : 0;
      titulo = "Solo sacándolo del colchón";
      tono = "warn";
      lineas.push(`El colchón quedaría en ${quedaria.toFixed(1).replace(".", ",")} meses de vida (hoy ${f.mesesColchon.toFixed(1).replace(".", ",")}).`);
    } else {
      const tarjeta = compraConTarjeta(monto, tasaMax > 0 ? tasaMax : 28, 12);
      titulo = "Hoy no alcanza sin endeudarse";
      tono = "crit";
      lineas.push(`Pagado con tarjeta a 12 cuotas${tasaMax > 0 ? ` al ${tasaMax.toString().replace(".", ",")} %` : ""}, costaría unos ${c.$(tarjeta.intereses)} más en intereses.`);
      lineas.push("Si lo pueden esperar, ahorrarlo primero sale más barato.");
    }
    lineas.push(`Para dimensionarlo: equivale a ${Math.round(dias)} días de su costo de vida.`);
    if (vivas.length > 0) {
      const antes = simularDeudas(c.deudas, abonoActual, estrategia, true);
      const conAbono = simularDeudas(conAbonoUnico(c.deudas, monto, estrategia), abonoActual, estrategia, true);
      if (!antes.estancado && !conAbono.estancado && antes.intereses > conAbono.intereses) {
        lineas.push(`La otra opción: abonado a la deuda más cara, ese dinero les ahorraría ${c.$(antes.intereses - conAbono.intereses)} en intereses.`);
      }
    }
    return { titulo, lineas, tono, ir: { texto: "Calcularlo con tarjeta", ruta: `/credito?compra=${monto}` }, entendida: true };
  }

  // Queremos ahorrar X (en N meses).
  if (/(ahorrar|juntar|reunir|necesitamos|meta de)/.test(t) && monto) {
    const libre = Math.max(0, f.libre);
    if (plazo) {
      const cuota = monto / plazo;
      return {
        titulo: `Necesitan apartar ${c.$(cuota)} al mes`,
        lineas: [
          `${c.$(monto)} en ${c.meses(plazo)}.`,
          cuota <= libre
            ? `Cabe en lo que les queda libre (${c.$(libre)}).`
            : libre > 0
              ? `Hoy les quedan ${c.$(libre)} libres: con eso llegarían en ${c.meses(Math.ceil(monto / libre))}, o tendrían que recortar ${c.$(cuota - libre)} al mes.`
              : "Hoy no les queda nada libre: primero hay que cuadrar el presupuesto.",
        ],
        tono: cuota <= libre ? "ok" : "warn",
        ir: { texto: "Crearla como meta", ruta: "/metas" },
        entendida: true,
      };
    }
    return libre > 0
      ? { titulo: `Llegarían en ${c.meses(Math.ceil(monto / libre))}`, lineas: [`Apartando todo lo libre (${c.$(libre)} al mes). Díganme el plazo («en 6 meses») y les digo cuánto apartar.`], tono: "neutro", ir: { texto: "Crearla como meta", ruta: "/metas" }, entendida: true }
      : { titulo: "Hoy no les queda nada libre para ahorrar", lineas: ["Lo asignado ya supera lo que entra. Primero cuadren el presupuesto y después le ponemos fecha."], tono: "warn", ir: { texto: "Ir al presupuesto", ruta: "/presupuesto" }, entendida: true };
  }

  // ¿Cuándo salimos de deudas?
  if (/deuda|libres|salimos|terminamos de pagar/.test(t)) {
    if (vivas.length === 0) return sinDeudas();
    const plan = simularDeudas(c.deudas, abonoActual, estrategia, true);
    if (plan.estancado) {
      return { titulo: "Con las cuotas actuales, nunca", lineas: ["Alguna deuda tiene una cuota que no cubre sus intereses y el saldo crece."], tono: "crit", ir: { texto: "Ver el plan de deudas", ruta: "/deudas" }, entendida: true };
    }
    const fecha = new Date(hoy.getFullYear(), hoy.getMonth() + plan.meses, 1);
    return {
      titulo: `En ${c.meses(plan.meses)}: hacia ${MESES[fecha.getMonth()]} de ${fecha.getFullYear()}`,
      lineas: [
        `Deben ${c.$(vivas.reduce((s, d) => s + Number(d.saldo), 0))} entre ${vivas.length} ${vivas.length === 1 ? "deuda" : "deudas"}, y pagarían ${c.$(plan.intereses)} en intereses de aquí al final.`,
        abonoActual > 0 ? `Cuenta su abono extra de ${c.$(abonoActual)} al mes.` : "Sin abono extra. Pregúntenme «¿qué pasa si abonamos 200 mil más?».",
      ],
      tono: "neutro",
      ir: { texto: "Ver el plan de deudas", ruta: "/deudas" },
      entendida: true,
    };
  }

  // ¿Cuánto llevamos gastado (en X)?
  if (/(cuanto|que tanto).*(gast|llevamos|hemos|van|va)|en que se (nos )?va/.test(t)) {
    const pasado = /mes pasado|anterior/.test(t);
    const fecha = pasado ? new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1) : hoy;
    const mes = mesIso(fecha);
    const cat = leerCategoria(pregunta, c.etiqueta);
    const filas = c.movimientos.filter((m) => m.fecha.startsWith(mes) && m.clase === "gasto" && (!cat || m.categoria === cat));
    const total = filas.reduce((s, m) => s + Number(m.monto), 0);
    const presupuesto = c.gastos.filter((g) => !cat || g.categoria === cat).reduce((s, g) => s + gastoMensual(g), 0);
    const nombre = cat ? c.etiqueta(cat).toLowerCase() : "total";
    return {
      titulo: `${pasado ? "En" : "Este mes, en"} ${MESES[fecha.getMonth()]}: ${c.$(total)}${cat ? ` en ${nombre}` : ""}`,
      lineas: [
        `${filas.length} ${filas.length === 1 ? "movimiento" : "movimientos"}.`,
        presupuesto > 0
          ? `El presupuesto ${cat ? `de ${nombre}` : "del mes"} es ${c.$(presupuesto)}: van en el ${Math.round((total / presupuesto) * 100)} %.`
          : "No hay presupuesto para comparar.",
      ],
      tono: presupuesto > 0 && total > presupuesto ? "warn" : "neutro",
      ir: { texto: "Ver el detalle", ruta: "/movimientos" },
      entendida: true,
    };
  }

  // ¿Cuánto nos queda?
  if (/(cuanto|que) (nos )?(queda|sobra)|libre/.test(t)) {
    return {
      titulo: f.libre >= 0 ? `Les quedan ${c.$(f.libre)} sin asignar al mes` : `Están ${c.$(-f.libre)} por encima de lo que entra`,
      lineas: [`Después de gastos y cuotas quedan ${c.$(f.disponible)}; los aportes a metas suman ${c.$(f.aportes)}.`],
      tono: f.libre >= 0 ? "ok" : "crit",
      ir: { texto: "Ver el presupuesto", ruta: "/presupuesto" },
      entendida: true,
    };
  }

  // ¿Y el colchón?
  if (/colchon|emergencia/.test(t)) {
    return {
      titulo: `El colchón cubre ${f.mesesColchon.toFixed(1).replace(".", ",")} meses de vida`,
      lineas: [
        `Tienen ${c.$(f.fondo)} y un mes les cuesta ${c.$(f.costoVida)}.`,
        `Para 3 meses faltan ${c.$(Math.max(0, f.costoVida * 3 - f.fondo))}; para 6, ${c.$(Math.max(0, f.costoVida * 6 - f.fondo))}.`,
      ],
      tono: f.mesesColchon >= 3 ? "ok" : f.mesesColchon >= 1 ? "warn" : "crit",
      ir: { texto: "Ver las metas", ruta: "/metas" },
      entendida: true,
    };
  }

  // ¿Cuánto tenemos?
  if (/patrimonio|cuanto tenemos|valemos|activos/.test(t)) {
    return {
      titulo: `Su patrimonio neto es ${c.$(c.resumen.neto)}`,
      lineas: [`Tienen ${c.$(c.resumen.activos)} y deben ${c.$(c.resumen.deudas)}.`],
      tono: c.resumen.neto >= 0 ? "ok" : "warn",
      ir: { texto: "Ver el patrimonio", ruta: "/patrimonio" },
      entendida: true,
    };
  }

  // ¿Cómo vamos?
  if (/como (vamos|estamos|va)|puntaje|salud|nivel/.test(t)) {
    const peor = [...c.puntaje.partes].sort((a, b) => a.puntos - b.puntos)[0];
    return {
      titulo: `Puntaje de salud: ${c.puntaje.total} de 100`,
      lineas: [
        c.nivel ? `Están en el nivel «${c.nivel}» de la ruta.` : "Completaron la ruta.",
        `Lo que más les resta: ${peor.nombre.toLowerCase()} (${Math.round(peor.puntos)} de 20).`,
      ],
      tono: c.puntaje.total >= 70 ? "ok" : c.puntaje.total >= 40 ? "warn" : "crit",
      ir: { texto: "Ver su ruta", ruta: "/ruta" },
      entendida: true,
    };
  }

  return {
    titulo: "Esa todavía no la sé responder",
    lineas: [
      monto === null && /gast|abon|ahorr/.test(t)
        ? "Me faltó el monto: díganmelo así, «800 mil» o «1,5 millones»."
        : "Sé responder sobre gastos, deudas, abonos, ahorro, el colchón, su patrimonio y cómo van. Prueben con alguna de estas:",
    ],
    tono: "neutro",
    entendida: false,
  };
}

function sinDeudas(): Respuesta {
  return { titulo: "No tienen deudas con saldo", lineas: ["Esa plata puede ir completa a sus metas."], tono: "ok", ir: { texto: "Ver las metas", ruta: "/metas" }, entendida: true };
}
