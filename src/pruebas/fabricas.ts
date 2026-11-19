/**
 * Filas de dominio para las pruebas. Cada fábrica llena los campos que el
 * cálculo no mira con valores neutros, para que cada prueba declare solo lo
 * que le importa y se lea como el escenario que describe.
 *
 * Vive fuera de `src/lib/` porque no es cálculo: solo la importan los
 * archivos `*.test.ts`, así que nunca llega al bundle.
 */
import type { Deuda, GastoPresupuesto, Ingreso, Meta, Movimiento } from "@/models/dominio";

const HOGAR = "hogar-prueba";
const CREADO = "2026-01-01T00:00:00Z";

export function ingreso(p: Partial<Ingreso> = {}): Ingreso {
  return {
    id: "ing",
    hogar_id: HOGAR,
    usuario_id: null,
    concepto: "Salario",
    monto: 0,
    frecuencia: "mensual",
    orden: 0,
    creado_en: CREADO,
    ...p,
  };
}

export function gasto(p: Partial<GastoPresupuesto> = {}): GastoPresupuesto {
  return {
    id: "gas",
    hogar_id: HOGAR,
    usuario_id: null,
    categoria: "Otros",
    concepto: "Gasto",
    monto: 0,
    frecuencia: "mensual",
    tipo: "variable",
    orden: 0,
    creado_en: CREADO,
    ...p,
  };
}

export function deuda(p: Partial<Deuda> = {}): Deuda {
  return {
    id: "deu",
    hogar_id: HOGAR,
    usuario_id: null,
    nombre: "Deuda",
    saldo: 0,
    tasa_ea: 0,
    cuota: 0,
    dia_pago: null,
    orden: 0,
    creado_en: CREADO,
    ...p,
  };
}

export function meta(p: Partial<Meta> = {}): Meta {
  return {
    id: "met",
    hogar_id: HOGAR,
    usuario_id: null,
    nombre: "Meta",
    objetivo: 0,
    acumulado: 0,
    aporte: 0,
    es_emergencia: false,
    orden: 0,
    creado_en: CREADO,
    ...p,
  };
}

export function movimiento(p: Partial<Movimiento> = {}): Movimiento {
  return {
    id: "mov",
    hogar_id: HOGAR,
    fecha: "2026-09-15",
    concepto: "Movimiento",
    categoria: "Otros",
    monto: 0,
    clase: "gasto",
    pagado_por: null,
    compartido: false,
    extraordinario: false,
    metodo: "",
    origen: "manual",
    huella: null,
    nota: "",
    creado_en: CREADO,
    ...p,
  };
}
