import { CATEGORIAS, type Categoria, type ClaseMovimiento, type ReglaCategoria } from "@/models/dominio";
import { aNumero } from "@/lib/formato";

/**
 * Lectura de extractos bancarios en CSV.
 * Los bancos no se ponen de acuerdo en nada: separador, orden de columnas,
 * formato de fecha, si el gasto va en negativo o en una columna aparte.
 * Aquí se detecta todo eso en vez de exigirle al usuario una plantilla.
 */

export interface FilaImportada {
  fecha: string; // ISO
  concepto: string;
  monto: number;
  clase: ClaseMovimiento;
  categoria: Categoria;
  /** True cuando la categoría la puso una regla y no el diccionario base. */
  porRegla: boolean;
  huella: string;
  incluir: boolean;
  duplicada: boolean;
}

export interface ResultadoLectura {
  filas: FilaImportada[];
  columnas: { fecha: string; concepto: string; monto: string };
  descartadas: number;
}

/** Diccionario base. Cubre los comercios y servicios más comunes en Colombia. */
const DICCIONARIO: Array<[Categoria, string[]]> = [
  ["Mercado", ["exito", "éxito", "d1", "ara ", "olimpica", "olímpica", "jumbo", "carulla", "makro", "justo", "supermercado", "fruver", "colsubsidio super"]],
  ["Transporte", ["terpel", "primax", "biomax", "esso", "mobil", "uber", "didi", "cabify", "indriver", "peaje", "parqueadero", "tullave", "civica", "cívica", "taxi"]],
  ["Servicios", ["epm", "codensa", "enel", "afinia", "air-e", "vanti", "gases", "acueducto", "emcali", "claro", "movistar", "tigo", "wom", "etb", "une ", "directv"]],
  ["Vivienda", ["arriendo", "administracion", "administración", "conjunto", "inmobiliaria", "hipotec"]],
  ["Salud", ["farmatodo", "cruz verde", "la rebaja", "drogas", "farmacia", "eps ", "sura", "colsanitas", "coomeva", "medico", "médico", "odont", "laboratorio clinico"]],
  ["Ocio", ["netflix", "spotify", "disney", "hbo", "max ", "prime video", "youtube", "cine", "cinemark", "royal films", "rappi", "restaurante", "bar ", "crepes", "juan valdez", "starbucks", "frisby", "mcdonald", "dominos", "domino's"]],
  ["Personal", ["gimnasio", "smartfit", "bodytech", "peluqueria", "peluquería", "barberia", "barbería", "zara", "falabella", "h&m", "arturo calle", "koaj", "spa "]],
  ["Educación", ["universidad", "colegio", "curso", "platzi", "udemy", "coursera", "matricula", "matrícula", "pension colegio"]],
];

const CABECERAS = {
  fecha: ["fecha", "fecha transaccion", "fecha de transaccion", "fecha movimiento", "date", "f. transaccion", "fecha operacion"],
  concepto: ["descripcion", "descripción", "concepto", "detalle", "referencia", "description", "comercio", "establecimiento", "transaccion", "transacción"],
  monto: ["valor", "monto", "importe", "amount", "valor transaccion", "debito", "débito", "credito", "crédito", "cargo", "abono"],
};

/** Detecta el separador contando cuál produce columnas más estables. */
function detectarSeparador(lineas: string[]): string {
  const candidatos = [";", ",", "\t", "|"];
  let mejor = ";";
  let mejorPuntaje = -1;
  for (const sep of candidatos) {
    const conteos = lineas.slice(0, 10).map((l) => partirLinea(l, sep).length);
    const max = Math.max(...conteos);
    if (max < 2) continue;
    const estables = conteos.filter((c) => c === max).length;
    const puntaje = max * 10 + estables;
    if (puntaje > mejorPuntaje) {
      mejorPuntaje = puntaje;
      mejor = sep;
    }
  }
  return mejor;
}

/** Partidor que respeta comillas dobles y las comillas escapadas ("") . */
function partirLinea(linea: string, sep: string): string[] {
  const salida: string[] = [];
  let actual = "";
  let entreComillas = false;

  for (let i = 0; i < linea.length; i += 1) {
    const c = linea[i];
    if (c === '"') {
      if (entreComillas && linea[i + 1] === '"') {
        actual += '"';
        i += 1;
      } else {
        entreComillas = !entreComillas;
      }
    } else if (c === sep && !entreComillas) {
      salida.push(actual.trim());
      actual = "";
    } else {
      actual += c;
    }
  }
  salida.push(actual.trim());
  return salida;
}

function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function indiceDe(cabecera: string[], claves: string[]): number {
  const norm = cabecera.map(normalizar);
  for (const clave of claves) {
    const i = norm.findIndex((c) => c === normalizar(clave));
    if (i > -1) return i;
  }
  for (const clave of claves) {
    const i = norm.findIndex((c) => c.includes(normalizar(clave)));
    if (i > -1) return i;
  }
  return -1;
}

/** Acepta dd/mm/aaaa, aaaa-mm-dd, dd-mm-aa y variantes con puntos. */
function aFechaISO(texto: string): string | null {
  const t = texto.trim().split(" ")[0];
  if (!t) return null;

  const iso = t.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  if (iso) return `${iso[1]}-${iso[2].padStart(2, "0")}-${iso[3].padStart(2, "0")}`;

  const latino = t.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})$/);
  if (latino) {
    const dia = latino[1].padStart(2, "0");
    const mes = latino[2].padStart(2, "0");
    let anio = latino[3];
    if (anio.length === 2) anio = `20${anio}`;
    return `${anio}-${mes}-${dia}`;
  }
  return null;
}

/** Huella estable para no importar dos veces el mismo movimiento. */
function huellaDe(fecha: string, monto: number, concepto: string): string {
  const base = `${fecha}|${Math.round(monto * 100)}|${normalizar(concepto).slice(0, 40)}`;
  let h = 0;
  for (let i = 0; i < base.length; i += 1) {
    h = (h << 5) - h + base.charCodeAt(i);
    h |= 0;
  }
  return `${fecha}-${Math.abs(h).toString(36)}`;
}

/** Clasifica primero con tus reglas aprendidas, luego con el diccionario. */
export function clasificar(
  concepto: string,
  reglas: ReglaCategoria[],
): { categoria: Categoria; porRegla: boolean } {
  const texto = normalizar(concepto);

  const aprendidas = [...reglas].sort((a, b) => b.patron.length - a.patron.length);
  for (const r of aprendidas) {
    if (texto.includes(normalizar(r.patron))) {
      return { categoria: r.categoria, porRegla: true };
    }
  }

  for (const [categoria, claves] of DICCIONARIO) {
    if (claves.some((c) => texto.includes(normalizar(c)))) {
      return { categoria, porRegla: false };
    }
  }

  return { categoria: "Otros", porRegla: false };
}

export function leerCSV(
  contenido: string,
  reglas: ReglaCategoria[],
  huellasExistentes: Set<string>,
): ResultadoLectura {
  const limpio = contenido.replace(/^﻿/, "");
  const lineas = limpio.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lineas.length < 2) {
    return { filas: [], columnas: { fecha: "", concepto: "", monto: "" }, descartadas: 0 };
  }

  const sep = detectarSeparador(lineas);

  // La cabecera no siempre está en la primera línea: algunos bancos meten
  // dos o tres líneas de encabezado institucional antes.
  let filaCabecera = 0;
  let cabecera = partirLinea(lineas[0], sep);
  for (let i = 0; i < Math.min(8, lineas.length); i += 1) {
    const c = partirLinea(lineas[i], sep);
    if (indiceDe(c, CABECERAS.fecha) > -1 && indiceDe(c, CABECERAS.monto) > -1) {
      filaCabecera = i;
      cabecera = c;
      break;
    }
  }

  const iFecha = indiceDe(cabecera, CABECERAS.fecha);
  const iConcepto = indiceDe(cabecera, CABECERAS.concepto);
  const iMonto = indiceDe(cabecera, CABECERAS.monto);

  // Columnas separadas de débito y crédito (muy común en Bancolombia y Davivienda)
  const iDebito = indiceDe(cabecera, ["debito", "débito", "cargo", "retiro"]);
  const iCredito = indiceDe(cabecera, ["credito", "crédito", "abono", "consignacion", "consignación"]);
  const hayDosColumnas = iDebito > -1 && iCredito > -1 && iDebito !== iCredito;

  const filas: FilaImportada[] = [];
  const vistas = new Set<string>();
  let descartadas = 0;

  for (let i = filaCabecera + 1; i < lineas.length; i += 1) {
    const celdas = partirLinea(lineas[i], sep);
    if (celdas.length < 2) {
      descartadas += 1;
      continue;
    }

    const fecha = iFecha > -1 ? aFechaISO(celdas[iFecha] ?? "") : null;
    if (!fecha) {
      descartadas += 1;
      continue;
    }

    const concepto = (iConcepto > -1 ? celdas[iConcepto] : celdas.find((c) => /[a-zA-Z]{3}/.test(c))) ?? "";

    let monto = 0;
    let clase: ClaseMovimiento = "gasto";

    if (hayDosColumnas) {
      const debito = Math.abs(aNumero(celdas[iDebito] ?? ""));
      const credito = Math.abs(aNumero(celdas[iCredito] ?? ""));
      if (debito > 0) {
        monto = debito;
        clase = "gasto";
      } else if (credito > 0) {
        monto = credito;
        clase = "ingreso";
      }
    } else if (iMonto > -1) {
      const bruto = aNumero(celdas[iMonto] ?? "");
      monto = Math.abs(bruto);
      clase = bruto > 0 ? "ingreso" : "gasto";
    }

    if (monto <= 0) {
      descartadas += 1;
      continue;
    }

    const huella = huellaDe(fecha, monto, concepto);
    if (vistas.has(huella)) {
      descartadas += 1;
      continue;
    }
    vistas.add(huella);

    const { categoria, porRegla } = clasificar(concepto, reglas);
    const duplicada = huellasExistentes.has(huella);

    filas.push({
      fecha,
      concepto: concepto.slice(0, 120),
      monto,
      clase,
      categoria,
      porRegla,
      huella,
      incluir: !duplicada,
      duplicada,
    });
  }

  filas.sort((a, b) => (a.fecha < b.fecha ? 1 : -1));

  return {
    filas,
    columnas: {
      fecha: cabecera[iFecha] ?? "—",
      concepto: cabecera[iConcepto] ?? "—",
      monto: hayDosColumnas
        ? `${cabecera[iDebito]} / ${cabecera[iCredito]}`
        : (cabecera[iMonto] ?? "—"),
    },
    descartadas,
  };
}

/**
 * Del concepto completo saca el fragmento que sirve como patrón de regla:
 * "COMPRA EXITO POBLADO 1234" → "exito poblado".
 */
export function patronDe(concepto: string): string {
  const palabras = normalizar(concepto)
    .replace(/[^a-z0-9 ]/g, " ")
    .split(" ")
    .filter((p) => p.length > 2 && !/^\d+$/.test(p))
    .filter((p) => !["compra", "pago", "pse", "tarjeta", "debito", "credito", "transferencia", "cargo", "abono"].includes(p));
  return palabras.slice(0, 2).join(" ");
}

export const CATEGORIAS_IMPORTACION = CATEGORIAS;
