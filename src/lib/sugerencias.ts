import { simularDeudas, ordenarPorEstrategia } from "./deudas";
import type { Finanzas } from "./calculos";
import type { Deuda, EstrategiaDeuda, Meta } from "@/models/dominio";

/**
 * Motor de recomendaciones.
 *
 * Todo lo que sale de aquí es aritmética sobre los datos del hogar: cuánto
 * se ahorra en intereses, cuántos meses se adelanta la salida, qué
 * rentabilidad tendría que superar un ahorro para competir con pagar una
 * deuda. No recomienda productos ni entidades —eso sería asesoría
 * financiera personalizada— sino que da los números para decidir.
 */

export interface Sugerencia {
  id: string;
  titulo: string;
  cuerpo: string;
  /** Resultado concreto, en meses o en dinero. */
  impacto?: string;
  /** 1 se atiende primero. */
  prioridad: 1 | 2 | 3;
  tono: "ok" | "warn" | "crit" | "neutro";
  /** De dónde sale el número, para que se pueda auditar. */
  comoSeCalcula?: string;
}

export interface Formateadores {
  moneda: (n: number) => string;
  meses: (n: number) => string;
  pct: (n: number) => string;
}

interface Entrada {
  finanzas: Finanzas;
  deudas: Deuda[];
  metas: Meta[];
  estrategia: EstrategiaDeuda;
  fmt: Formateadores;
}

/** Meses de gastos cubiertos que se consideran un colchón mínimo antes de
 *  acelerar deudas. Por debajo de esto, un imprevisto devuelve a la tarjeta. */
const COLCHON_MINIMO = 1;
const COLCHON_OBJETIVO = 6;

export function generarSugerencias({
  finanzas: f,
  deudas,
  metas,
  estrategia,
  fmt,
}: Entrada): Sugerencia[] {
  const out: Sugerencia[] = [];
  const conSaldo = deudas.filter((d) => Number(d.saldo) > 0);
  const hayDeuda = conSaldo.length > 0;
  const masCara = ordenarPorEstrategia(deudas, "avalancha")[0];
  const tasaMax = masCara ? Number(masCara.tasa_ea) : 0;

  /** Diferencia entre pagar con y sin un abono adicional. */
  function impactoDeAbono(extra: number) {
    if (!hayDeuda || extra <= 0) return null;
    const sin = simularDeudas(deudas, 0, estrategia, true);
    const con = simularDeudas(deudas, extra, estrategia, true);
    if (sin.estancado || con.estancado) return null;
    return {
      mesesGanados: sin.meses - con.meses,
      interesAhorrado: sin.intereses - con.intereses,
      mesesFinales: con.meses,
    };
  }

  // ---- 1. El colchón mínimo va antes que acelerar deudas ----------------
  if (f.mesesColchon < COLCHON_MINIMO && f.costoVida > 0) {
    const falta = f.costoVida * COLCHON_MINIMO - f.fondo;
    out.push({
      id: "colchon-minimo",
      titulo: "Primero, un mes de colchón",
      cuerpo:
        `Tienen cubierto ${f.mesesColchon.toFixed(1).replace(".", ",")} meses de gastos. ` +
        `Antes de acelerar las deudas conviene llegar a uno completo: sin ese margen, ` +
        `cualquier imprevisto vuelve a la tarjeta y deshace el avance.`,
      impacto: `Faltan ${fmt.moneda(falta)}`,
      prioridad: 1,
      tono: "crit",
      comoSeCalcula: `Vivir un mes cuesta ${fmt.moneda(f.costoVida)} entre gastos y cuotas.`,
    });
  }

  // ---- 2. El sobrante sin asignar, puesto a trabajar --------------------
  if (f.libre > 0) {
    const imp = impactoDeAbono(f.libre);
    if (imp && imp.mesesGanados > 0) {
      out.push({
        id: "sobrante-a-deuda",
        titulo: "Tienen dinero sin asignar cada mes",
        cuerpo:
          `Quedan ${fmt.moneda(f.libre)} al mes que no están ni en gastos, ni en cuotas, ` +
          `ni en metas. Puestos como abono extra a las deudas, la salida se adelanta ` +
          `y los intereses bajan.`,
        impacto: `${fmt.meses(imp.mesesGanados)} menos · ${fmt.moneda(imp.interesAhorrado)} de intereses`,
        prioridad: hayDeuda ? 1 : 2,
        tono: "warn",
        comoSeCalcula:
          `Simulación mes a mes: con abono de ${fmt.moneda(f.libre)} quedan libres en ` +
          `${fmt.meses(imp.mesesFinales)}.`,
      });
    } else if (!hayDeuda) {
      out.push({
        id: "sobrante-a-metas",
        titulo: "Tienen dinero sin asignar cada mes",
        cuerpo:
          `Quedan ${fmt.moneda(f.libre)} al mes sin destino. Sin deudas que pagar, ese ` +
          `dinero rinde más asignado a una meta concreta que quedándose en la cuenta: ` +
          `lo que no tiene nombre se gasta solo.`,
        impacto: `${fmt.moneda(f.libre * 12)} al año`,
        prioridad: 2,
        tono: "warn",
      });
    }
  }

  // ---- 3. Ahorrar mientras se paga una deuda cara -----------------------
  const metasNoEmergencia = metas.filter((m) => !m.es_emergencia);
  const aporteNoEmergencia = metasNoEmergencia.reduce((s, m) => s + Number(m.aporte), 0);

  if (hayDeuda && aporteNoEmergencia > 0 && tasaMax > 0) {
    const costoAnual = aporteNoEmergencia * 12 * (tasaMax / 100);
    const imp = impactoDeAbono(aporteNoEmergencia);
    out.push({
      id: "ahorro-vs-deuda",
      titulo: "Ese ahorro tendría que rendir más del " + fmt.pct(tasaMax / 100),
      cuerpo:
        `Aportan ${fmt.moneda(aporteNoEmergencia)} al mes a metas que no son el colchón, ` +
        `mientras ${masCara?.nombre || "su deuda más cara"} cobra ${fmt.pct(tasaMax / 100)} efectivo anual. ` +
        `Abonar a esa deuda es, en la práctica, una rentabilidad garantizada de ese mismo ` +
        `porcentaje: es el listón que cualquier alternativa de ahorro tendría que superar.`,
      impacto: imp
        ? `Redirigirlo: ${fmt.meses(imp.mesesGanados)} menos · ${fmt.moneda(imp.interesAhorrado)} de intereses`
        : `Cuesta unos ${fmt.moneda(costoAnual)} al año en intereses evitables`,
      prioridad: tasaMax >= 25 ? 1 : 2,
      tono: tasaMax >= 25 ? "crit" : "warn",
      comoSeCalcula:
        `Ahorrar al mismo tiempo que se debe al ${fmt.pct(tasaMax / 100)} equivale a ` +
        `prestar barato y pedir caro.`,
    });
  }

  // ---- 4. Las cuotas que se liberan ------------------------------------
  if (conSaldo.length > 1) {
    const orden = ordenarPorEstrategia(deudas, estrategia);
    const primera = orden[0];
    if (primera && Number(primera.cuota) > 0) {
      const mesesPrimera = Math.ceil(Number(primera.saldo) / Number(primera.cuota));
      out.push({
        id: "cuotas-liberadas",
        titulo: "No se gasten la cuota que se libere",
        cuerpo:
          `${primera.nombre || "La primera deuda"} termina en unos ${fmt.meses(mesesPrimera)}. ` +
          `Sus ${fmt.moneda(Number(primera.cuota))} de cuota mensual quedarán libres: si van ` +
          `a la siguiente deuda en vez de disolverse en el gasto diario, el plan se acelera solo. ` +
          `La proyección de esta página ya asume que lo harán.`,
        impacto: `${fmt.moneda(Number(primera.cuota))} al mes para redirigir`,
        prioridad: 2,
        tono: "neutro",
      });
    }
  }

  // ---- 5. Gustos por encima del 30 % ------------------------------------
  if (f.regla.gustos.fraccion > 0.3 && f.ingreso > 0) {
    const exceso = (f.regla.gustos.fraccion - 0.3) * f.ingreso;
    const imp = impactoDeAbono(exceso);
    out.push({
      id: "recorte-gustos",
      titulo: "Los gustos pesan más de lo recomendable",
      cuerpo:
        `Ocio, gastos personales y otros suman ${fmt.pct(f.regla.gustos.fraccion)} del ingreso, ` +
        `frente al 30 % que suele recomendarse. Volver a ese techo liberaría ` +
        `${fmt.moneda(exceso)} al mes. No es pedir que dejen de salir: es saber cuánto ` +
        `cuesta en tiempo de deuda.`,
      impacto: imp
        ? `${fmt.meses(imp.mesesGanados)} menos de deuda`
        : `${fmt.moneda(exceso * 12)} al año`,
      prioridad: 3,
      tono: "warn",
    });
  }

  // ---- 6. Deudas cuya cuota no cubre los intereses -----------------------
  const ahogadas = conSaldo.filter((d) => {
    const im = Math.pow(1 + Number(d.tasa_ea) / 100, 1 / 12) - 1;
    return Number(d.cuota) <= Number(d.saldo) * im;
  });
  if (ahogadas.length > 0) {
    out.push({
      id: "cuota-insuficiente",
      titulo: "Hay deudas que están creciendo",
      cuerpo:
        `En ${ahogadas.map((d) => d.nombre || "una deuda").join(", ")} la cuota no alcanza a ` +
        `cubrir los intereses del mes: el saldo sube aunque paguen puntual. Subir esa cuota ` +
        `no es una opción de optimización, es lo primero que hay que resolver.`,
      impacto: "El saldo crece cada mes",
      prioridad: 1,
      tono: "crit",
    });
  }

  // ---- 7. Colchón completo, una vez saldadas las deudas caras -----------
  if (f.mesesColchon >= COLCHON_MINIMO && f.mesesColchon < 3 && f.costoVida > 0) {
    const falta = f.costoVida * 3 - f.fondo;
    out.push({
      id: "colchon-tres",
      titulo: "Apunten a tres meses de colchón",
      cuerpo:
        `Cubren ${f.mesesColchon.toFixed(1).replace(".", ",")} meses. Tres es el umbral donde ` +
        `un despido o una urgencia médica dejan de ser una catástrofe financiera. ` +
        `Con deudas caras encima, conviene alternar: primero la deuda, pero sin dejar el fondo en cero.`,
      impacto: `Faltan ${fmt.moneda(falta)}`,
      prioridad: 2,
      tono: "warn",
    });
  }

  if (f.mesesColchon >= COLCHON_OBJETIVO && !hayDeuda) {
    out.push({
      id: "colchon-de-sobra",
      titulo: "El colchón ya está holgado",
      cuerpo:
        `Cubren ${f.mesesColchon.toFixed(1).replace(".", ",")} meses de gastos y no tienen deudas. ` +
        `El excedente por encima de seis meses rinde poco parado: es el momento de decidir ` +
        `un destino con horizonte más largo. Qué instrumento concreto conviene depende de su ` +
        `perfil de riesgo y plazo — eso se consulta con un asesor, no se improvisa.`,
      impacto: `${fmt.moneda(Math.max(0, f.fondo - f.costoVida * COLCHON_OBJETIVO))} por encima del objetivo`,
      prioridad: 3,
      tono: "ok",
    });
  }

  // ---- 8. Reparto desequilibrado ---------------------------------------
  const brechaA = f.ingresoA > 0 ? f.quedaA / f.ingresoA : 0;
  const brechaB = f.ingresoB > 0 ? f.quedaB / f.ingresoB : 0;
  if (f.ingresoA > 0 && f.ingresoB > 0 && Math.abs(brechaA - brechaB) > 0.15) {
    out.push({
      id: "reparto-desigual",
      titulo: "El reparto deja a uno con mucho más margen",
      cuerpo:
        `Después de poner su parte, a uno le queda ${fmt.pct(Math.max(brechaA, brechaB))} de su ` +
        `ingreso y al otro ${fmt.pct(Math.min(brechaA, brechaB))}. No hay un reparto correcto ` +
        `—eso lo deciden ustedes— pero conviene que sea una decisión consciente y no el ` +
        `resultado accidental de cómo quedaron repartidos los gastos.`,
      prioridad: 3,
      tono: "neutro",
      comoSeCalcula: "Prueben el reparto proporcional en la pestaña Resumen para comparar.",
    });
  }

  // ---- 9. Tasa de ahorro -----------------------------------------------
  if (f.ingreso > 0 && f.tasaAhorro < 0) {
    out.push({
      id: "gasto-mayor-ingreso",
      titulo: "Están gastando más de lo que entra",
      cuerpo:
        `Entre gastos y cuotas se van ${fmt.moneda(f.gastos + f.cuotas)} contra ` +
        `${fmt.moneda(f.ingreso)} de ingreso. El faltante sale de algún lado: ahorros previos, ` +
        `o más deuda. Es lo primero que hay que cerrar, antes que cualquier optimización.`,
      impacto: `${fmt.moneda(Math.abs(f.disponible))} de déficit al mes`,
      prioridad: 1,
      tono: "crit",
    });
  }

  return out.sort((a, b) => a.prioridad - b.prioridad);
}

/** El listón que cualquier ahorro debe superar para competir con pagar deuda. */
export function rentabilidadObjetivo(deudas: Deuda[]): number {
  const conSaldo = deudas.filter((d) => Number(d.saldo) > 0);
  if (conSaldo.length === 0) return 0;
  return Math.max(...conSaldo.map((d) => Number(d.tasa_ea)));
}
