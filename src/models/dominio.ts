/**
 * Modelos de dominio compartidos por toda la aplicación.
 * Reflejan exactamente las tablas de supabase/migrations/0001_esquema.sql.
 */

export const CATEGORIAS = [
  "Vivienda",
  "Mercado",
  "Servicios",
  "Transporte",
  "Salud",
  "Ocio",
  "Personal",
  "Educación",
  "Otros",
] as const;

export type Categoria = (typeof CATEGORIAS)[number];

/** Categorías que cuentan como "necesidad" en la regla 50/30/20. */
export const CATEGORIAS_ESENCIALES: readonly Categoria[] = [
  "Vivienda",
  "Mercado",
  "Servicios",
  "Transporte",
  "Salud",
  "Educación",
];

/** Variable CSS del color fijo de cada categoría. El color sigue a la
 *  categoría, nunca a su posición en el ranking. */
export const COLOR_CATEGORIA: Record<Categoria, string> = {
  Vivienda: "--cat-vivienda",
  Mercado: "--cat-mercado",
  Servicios: "--cat-servicios",
  Transporte: "--cat-transporte",
  Salud: "--cat-salud",
  Ocio: "--cat-ocio",
  Personal: "--cat-personal",
  Educación: "--cat-educacion",
  Otros: "--cat-otros",
};

export type Frecuencia = "mensual" | "quincenal" | "anual";
export type TipoGasto = "fijo" | "variable";
export type ClaseMovimiento = "gasto" | "ingreso";
export type OrigenMovimiento = "manual" | "importado";
export type Reparto = "proporcional" | "mitad";
export type EstrategiaDeuda = "avalancha" | "bola";

export const MULTIPLICADOR_FRECUENCIA: Record<Frecuencia, number> = {
  mensual: 1,
  quincenal: 2,
  anual: 1 / 12,
};

export const NOMBRE_FRECUENCIA: Record<Frecuencia, string> = {
  mensual: "Mensual",
  quincenal: "Quincenal",
  anual: "Anual",
};

export interface Perfil {
  id: string;
  nombre: string;
  correo: string;
  creado_en: string;
}

export interface Hogar {
  id: string;
  nombre: string;
  moneda: string;
  reparto: Reparto;
  estrategia_deuda: EstrategiaDeuda;
  abono_extra: number;
  /** Nombre propio de cada categoría. Las claves ausentes usan el de fábrica. */
  etiquetas_categorias: Partial<Record<Categoria, string>>;
  creado_por: string;
  creado_en: string;
}

export interface Miembro {
  hogar_id: string;
  usuario_id: string;
  rol: "socio" | "invitado";
  unido_en: string;
}

export interface Invitacion {
  id: string;
  hogar_id: string;
  correo: string;
  invitado_por: string;
  creada_en: string;
}

export interface Ingreso {
  id: string;
  hogar_id: string;
  usuario_id: string | null;
  concepto: string;
  monto: number;
  frecuencia: Frecuencia;
  orden: number;
  creado_en: string;
}

export interface GastoPresupuesto {
  id: string;
  hogar_id: string;
  usuario_id: string | null;
  categoria: Categoria;
  concepto: string;
  monto: number;
  tipo: TipoGasto;
  orden: number;
  creado_en: string;
}

export interface Deuda {
  id: string;
  hogar_id: string;
  usuario_id: string | null;
  nombre: string;
  saldo: number;
  tasa_ea: number;
  cuota: number;
  dia_pago: number | null;
  orden: number;
  creado_en: string;
}

export interface Meta {
  id: string;
  hogar_id: string;
  usuario_id: string | null;
  nombre: string;
  objetivo: number;
  acumulado: number;
  aporte: number;
  es_emergencia: boolean;
  orden: number;
  creado_en: string;
}

export interface Movimiento {
  id: string;
  hogar_id: string;
  fecha: string;
  concepto: string;
  categoria: Categoria;
  monto: number;
  clase: ClaseMovimiento;
  pagado_por: string | null;
  compartido: boolean;
  metodo: string;
  origen: OrigenMovimiento;
  huella: string | null;
  nota: string;
  creado_en: string;
}

export interface ReglaCategoria {
  id: string;
  hogar_id: string;
  patron: string;
  categoria: Categoria;
  veces: number;
  creada_en: string;
}

export interface CierreMensual {
  id: string;
  hogar_id: string;
  periodo: string;
  ingresos: number;
  gastos: number;
  cuotas: number;
  ahorro: number;
  deuda_total: number;
  por_categoria: Partial<Record<Categoria, number>>;
  cerrado_en: string;
}

/** Nombre de tabla → forma de la fila. Le da tipos al hook genérico. */
export interface MapaTablas {
  ingresos: Ingreso;
  gastos_presupuesto: GastoPresupuesto;
  deudas: Deuda;
  metas: Meta;
  movimientos: Movimiento;
  reglas_categoria: ReglaCategoria;
  cierres_mensuales: CierreMensual;
}

export type NombreTabla = keyof MapaTablas;

/** Filas que se pueden insertar: sin los campos que pone la base. */
export type NuevaFila<T> = Omit<T, "id" | "creado_en" | "creada_en" | "cerrado_en">;
