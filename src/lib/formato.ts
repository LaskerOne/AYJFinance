/** Formato de números, monedas y fechas. Sin dependencias: `Intl` basta. */

export const MONEDAS = [
  { codigo: "COP", etiqueta: "COP $", locale: "es-CO", decimales: 0 },
  { codigo: "MXN", etiqueta: "MXN $", locale: "es-MX", decimales: 0 },
  { codigo: "USD", etiqueta: "USD US$", locale: "en-US", decimales: 2 },
  { codigo: "EUR", etiqueta: "EUR €", locale: "es-ES", decimales: 2 },
  { codigo: "ARS", etiqueta: "ARS $", locale: "es-AR", decimales: 0 },
  { codigo: "CLP", etiqueta: "CLP $", locale: "es-CL", decimales: 0 },
  { codigo: "PEN", etiqueta: "PEN S/", locale: "es-PE", decimales: 2 },
] as const;

const SIMBOLO: Record<string, string> = {
  COP: "$",
  MXN: "$",
  USD: "US$",
  EUR: "€",
  ARS: "$",
  CLP: "$",
  PEN: "S/",
};

function config(moneda: string) {
  return MONEDAS.find((m) => m.codigo === moneda) ?? MONEDAS[0];
}

export function formateador(moneda: string): Intl.NumberFormat {
  const c = config(moneda);
  return new Intl.NumberFormat(c.locale, {
    minimumFractionDigits: 0,
    maximumFractionDigits: c.decimales,
  });
}

/** `$ 4.800.000` — con el signo menos tipográfico, no el guion. */
export function moneda(valor: number, cod: string): string {
  if (!Number.isFinite(valor)) return "—";
  const signo = valor < 0 ? "−" : "";
  return `${signo}${SIMBOLO[cod] ?? "$"} ${formateador(cod).format(Math.abs(Math.round(valor)))}`;
}

/** Versión compacta para ejes y cifras grandes: `$ 4,8 M`. */
export function monedaCorta(valor: number, cod: string): string {
  if (!Number.isFinite(valor)) return "—";
  const abs = Math.abs(valor);
  const signo = valor < 0 ? "−" : "";
  const s = `${SIMBOLO[cod] ?? "$"} `;
  if (abs >= 1e9) return `${signo}${s}${(abs / 1e9).toFixed(1).replace(".", ",")} MM`;
  if (abs >= 1e6) return `${signo}${s}${(abs / 1e6).toFixed(abs >= 1e7 ? 0 : 1).replace(".", ",")} M`;
  if (abs >= 1e3) return `${signo}${s}${Math.round(abs / 1e3)} mil`;
  return `${signo}${s}${Math.round(abs)}`;
}

export function porcentaje(fraccion: number, decimales = 1): string {
  if (!Number.isFinite(fraccion)) return "—";
  return `${(fraccion * 100).toFixed(decimales).replace(".", ",")} %`;
}

export function porcentajeEntero(fraccion: number): string {
  return Number.isFinite(fraccion) ? `${Math.round(fraccion * 100)} %` : "—";
}

/**
 * Lee un número escrito por una persona, en cualquier convención.
 * `4.800.000`, `4,800,000`, `4800000` y `1234,56` dan lo esperado.
 */
export function aNumero(valor: unknown): number {
  if (typeof valor === "number") return Number.isFinite(valor) ? valor : 0;
  const limpio = String(valor ?? "").replace(/[^0-9,.-]/g, "");
  if (!limpio) return 0;

  const coma = limpio.lastIndexOf(",");
  const punto = limpio.lastIndexOf(".");
  let texto = limpio;

  if (coma > -1 && punto > -1) {
    // manda el último separador: ese es el decimal
    texto = coma > punto ? limpio.replace(/\./g, "").replace(",", ".") : limpio.replace(/,/g, "");
  } else if (coma > -1) {
    const decimales = limpio.length - coma - 1;
    texto =
      limpio.split(",").length === 2 && decimales > 0 && decimales < 3
        ? limpio.replace(",", ".")
        : limpio.replace(/,/g, "");
  } else if (punto > -1) {
    const decimales = limpio.length - punto - 1;
    if (!(limpio.split(".").length === 2 && decimales > 0 && decimales < 3)) {
      texto = limpio.replace(/\./g, "");
    }
  }

  const n = Number.parseFloat(texto);
  return Number.isFinite(n) ? n : 0;
}

export const MESES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

/** `14` → `1 año y 2 meses` */
export function enMeses(n: number): string {
  if (!Number.isFinite(n)) return "—";
  if (n < 12) return `${n} ${n === 1 ? "mes" : "meses"}`;
  const anios = Math.floor(n / 12);
  const resto = n % 12;
  const a = `${anios} ${anios === 1 ? "año" : "años"}`;
  return resto ? `${a} y ${resto} ${resto === 1 ? "mes" : "meses"}` : a;
}

/** Nombre del mes que queda `n` meses después de hoy. */
export function dentroDe(n: number): string {
  if (!Number.isFinite(n) || n > 600) return "";
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() + n);
  return `${MESES[d.getMonth()]} de ${d.getFullYear()}`;
}

/** `2026-09-15` → `15 de septiembre` */
export function fechaCorta(iso: string): string {
  const [a, m, d] = iso.split("-").map(Number);
  if (!a || !m || !d) return iso;
  return `${d} de ${MESES[m - 1]}`;
}

/** `2026-09-01` → `septiembre 2026` */
export function nombrePeriodo(iso: string): string {
  const [a, m] = iso.split("-").map(Number);
  if (!a || !m) return iso;
  return `${MESES[m - 1]} ${a}`;
}

/** Primer día del mes de una fecha, en formato ISO. */
export function primerDiaDelMes(fecha: Date = new Date()): string {
  const a = fecha.getFullYear();
  const m = String(fecha.getMonth() + 1).padStart(2, "0");
  return `${a}-${m}-01`;
}

export function hoyISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
