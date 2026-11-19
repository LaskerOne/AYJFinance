/**
 * Filas de dominio para las pruebas. Cada fábrica llena los campos que el
 * cálculo no mira con valores neutros, para que cada prueba declare solo lo
 * que le importa y se lea como el escenario que describe.
 *
 * Vive fuera de `src/lib/` porque no es cálculo: solo la importan los
 * archivos `*.test.ts`, así que nunca llega al bundle.
 */
import type { Activo, Decision, Deuda, GastoPresupuesto, Hogar, Ingreso, Meta, Movimiento } from "@/models/dominio";

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

export function hogar(p: Partial<Hogar> = {}): Hogar {
  return {
    id: HOGAR,
    nombre: "Casa",
    moneda: "COP",
    reparto: "proporcional",
    estrategia_deuda: "avalancha",
    abono_extra: 0,
    etiquetas_categorias: {},
    creado_por: "a",
    creado_en: CREADO,
    ...p,
  };
}

export function decision(p: Partial<Decision> = {}): Decision {
  return {
    id: "dec",
    hogar_id: HOGAR,
    periodo: "2026-09-01",
    texto: "Decisión",
    responsable: null,
    cumplida: false,
    origen: null,
    orden: 0,
    creado_en: CREADO,
    ...p,
  };
}

export function activo(p: Partial<Activo> = {}): Activo {
  return {
    id: "act",
    hogar_id: HOGAR,
    usuario_id: null,
    nombre: "Cuenta",
    tipo: "ahorro",
    valor: 0,
    tasa_ea: null,
    aporte_mensual: 0,
    vencimiento: null,
    orden: 0,
    creado_en: CREADO,
    ...p,
  };
}
