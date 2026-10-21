/**
 * Tasa de cambio COP por USD.
 *
 * Los datos del hogar viven SIEMPRE en pesos; el dólar es solo una vista.
 * La tasa viene de open.er-api.com (gratuita, sin llave, se actualiza a
 * diario) y se guarda en el navegador: si la red falla se usa la última
 * conocida, aunque esté vieja, antes que no convertir nada.
 */

const CLAVE = "cuentas-de-dos:tasa-usd";
const URL = "https://open.er-api.com/v6/latest/USD";
const UN_DIA = 24 * 60 * 60 * 1000;

interface TasaGuardada {
  tasa: number;
  fecha: number;
}

function leerCache(): TasaGuardada | null {
  try {
    const crudo = localStorage.getItem(CLAVE);
    if (!crudo) return null;
    const v = JSON.parse(crudo) as TasaGuardada;
    return typeof v.tasa === "number" && v.tasa > 0 ? v : null;
  } catch {
    return null;
  }
}

let actual: TasaGuardada | null = leerCache();
let pidiendo: Promise<void> | null = null;
const oyentes = new Set<(tasa: number) => void>();

/** La tasa conocida ahora mismo, o null si nunca se ha podido obtener. */
export function tasaUSD(): number | null {
  return actual?.tasa ?? null;
}

/** Cuándo se obtuvo la tasa que se está usando. */
export function fechaTasa(): Date | null {
  return actual ? new Date(actual.fecha) : null;
}

export function suscribirTasa(fn: (tasa: number) => void): () => void {
  oyentes.add(fn);
  return () => oyentes.delete(fn);
}

/** Trae la tasa si la guardada ya cumplió un día (o no existe). */
export function asegurarTasa(): Promise<void> {
  if (actual && Date.now() - actual.fecha < UN_DIA) return Promise.resolve();
  if (pidiendo) return pidiendo;
  pidiendo = fetch(URL)
    .then((r) => r.json() as Promise<{ result?: string; rates?: { COP?: number } }>)
    .then((datos) => {
      const tasa = datos.rates?.COP;
      if (datos.result !== "success" || !tasa || tasa <= 0) return;
      actual = { tasa, fecha: Date.now() };
      try {
        localStorage.setItem(CLAVE, JSON.stringify(actual));
      } catch {
        // Sin almacenamiento la tasa igual sirve durante esta visita.
      }
      oyentes.forEach((fn) => fn(tasa));
    })
    .catch(() => {
      // Sin red: se queda la última tasa conocida, o ninguna.
    })
    .finally(() => {
      pidiendo = null;
    });
  return pidiendo;
}
