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

/** Catálogo aparte para los ingresos: comparten columna con las categorías
 *  de gasto pero nunca el mismo cálculo, porque todo filtra antes por clase. */
export const CATEGORIAS_INGRESO = [
  "Salario",
  "Independiente",
  "Arriendo",
  "Bonos",
  "Otros ingresos",
] as const;

export type CategoriaIngreso = (typeof CATEGORIAS_INGRESO)[number];

/**
 * Tonos del desglose de ingresos. Salen de la misma paleta verificada que
 * las categorías de gasto —son hues, no categorías— y nunca aparecen juntos
 * en un mismo gráfico, así que no compiten entre sí.
 */
export const COLOR_CATEGORIA_INGRESO: Record<CategoriaIngreso, string> = {
  Salario: "--cat-vivienda", // azul
  Independiente: "--cat-mercado", // naranja
  Arriendo: "--cat-transporte", // aguamarina
  Bonos: "--cat-servicios", // ámbar
  "Otros ingresos": "--cat-otros", // gris
};

export type Frecuencia =
  | "quincenal"
  | "mensual"
  | "bimestral"
  | "trimestral"
  | "semestral"
  | "anual";
export type TipoGasto = "fijo" | "variable";
/** `transferencia`: plata que uno le pasa al otro para saldar el bote. No es
 *  gasto ni ingreso del hogar; todo lo que suma la ignora. */
export type ClaseMovimiento = "gasto" | "ingreso" | "transferencia";
export type OrigenMovimiento = "manual" | "importado";
export type Reparto = "proporcional" | "mitad";
export type EstrategiaDeuda = "avalancha" | "bola";

/** Cuántas veces cabe en un mes. Debe coincidir con `factor_mensual()` en SQL. */
export const MULTIPLICADOR_FRECUENCIA: Record<Frecuencia, number> = {
  quincenal: 2,
  mensual: 1,
  bimestral: 1 / 2,
  trimestral: 1 / 3,
  semestral: 1 / 6,
  anual: 1 / 12,
};

export const NOMBRE_FRECUENCIA: Record<Frecuencia, string> = {
  quincenal: "Quincenal",
  mensual: "Mensual",
  bimestral: "Bimestral",
  trimestral: "Trimestral",
  semestral: "Semestral",
  anual: "Anual",
};

/** Orden de los desplegables: de lo más frecuente a lo menos. */
export const FRECUENCIAS: readonly Frecuencia[] = [
  "quincenal",
  "mensual",
  "bimestral",
  "trimestral",
  "semestral",
  "anual",
];

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
  /** Tasa de usura vigente en % E.A. y el mes (YYYY-MM) al que corresponde. */
  tasa_usura?: number | null;
  tasa_usura_mes?: string | null;
  /** Inflación anual de referencia (%), para la rentabilidad real. */
  inflacion_ref?: number | null;
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
  /** Mes (1–12) en que llega si no es mensual. Ver migración 0009. */
  mes_pago?: number | null;
  /** Salario con prima y cesantías: la proyección suma esas entradas. */
  con_prestaciones?: boolean;
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
  /** El monto es el de un ciclo completo, no el mensualizado. */
  frecuencia: Frecuencia;
  /** Mes (1–12) en que se paga si no es mensual. */
  mes_pago?: number | null;
  /** Día del mes (1–31) en que se paga: fecha de su movimiento. Ver 0015. */
  dia_pago?: number | null;
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
  /** Préstamo entre la pareja: entra al plan de pagos y a la liquidación. */
  con_pareja?: boolean;
  /** Cargos mensuales además de la cuota: entran al costo efectivo. */
  seguro_mensual?: number;
  cuota_manejo?: number;
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

/** Un movimiento usa un catálogo u otro según sea gasto o ingreso. */
export type CategoriaMovimiento = Categoria | CategoriaIngreso;

export interface Movimiento {
  id: string;
  hogar_id: string;
  fecha: string;
  concepto: string;
  categoria: CategoriaMovimiento;
  monto: number;
  clase: ClaseMovimiento;
  pagado_por: string | null;
  compartido: boolean;
  /** Compra puntual: cuenta en el gasto del mes pero no se compara contra
   *  el presupuesto, que describe lo recurrente. */
  extraordinario: boolean;
  metodo: string;
  origen: OrigenMovimiento;
  /** Gasto fijo del presupuesto del que salió, si se registró desde la
   *  lista de fijos del mes. Ver migración 0015. */
  gasto_id?: string | null;
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
  /** Total de activos al cierre (migración 0011); con deuda_total da el patrimonio. */
  activos_total?: number;
  /** Puntaje de salud (0–100) al cerrar, migración 0012. */
  puntaje?: number | null;
  cerrado_en: string;
}

// --- patrimonio ---------------------------------------------------------------

export type TipoActivo =
  | "efectivo"
  | "ahorro"
  | "cdt"
  | "fic"
  | "acciones"
  | "dolares"
  | "cripto"
  | "cesantias"
  | "pension_voluntaria"
  | "afc"
  | "pension_obligatoria"
  | "inmueble"
  | "vehiculo"
  | "otro";

/** Para qué sirve la plata según qué tan rápido se puede usar. */
export type GrupoActivo = "liquido" | "invertido" | "retiro" | "bienes";

export interface InfoTipoActivo {
  nombre: string;
  grupo: GrupoActivo;
  /** Retención en la fuente sobre rendimientos financieros (aprox. 7 %). */
  retencion: boolean;
  /** 4×1000 al retirar (las cuentas de ahorro suelen estar exentas). */
  gmf: boolean;
}

export const TIPOS_ACTIVO: Record<TipoActivo, InfoTipoActivo> = {
  efectivo: { nombre: "Efectivo / cuenta corriente", grupo: "liquido", retencion: false, gmf: false },
  ahorro: { nombre: "Cuenta de ahorros", grupo: "liquido", retencion: true, gmf: false },
  fic: { nombre: "Fondo de inversión colectiva", grupo: "liquido", retencion: true, gmf: true },
  dolares: { nombre: "Dólares", grupo: "liquido", retencion: false, gmf: true },
  cdt: { nombre: "CDT", grupo: "invertido", retencion: true, gmf: true },
  acciones: { nombre: "Acciones / ETF", grupo: "invertido", retencion: false, gmf: true },
  cripto: { nombre: "Cripto", grupo: "invertido", retencion: false, gmf: true },
  cesantias: { nombre: "Cesantías", grupo: "retiro", retencion: false, gmf: false },
  pension_voluntaria: { nombre: "Pensión voluntaria (FPV)", grupo: "retiro", retencion: false, gmf: false },
  afc: { nombre: "Cuenta AFC", grupo: "retiro", retencion: false, gmf: false },
  pension_obligatoria: { nombre: "Pensión obligatoria", grupo: "retiro", retencion: false, gmf: false },
  inmueble: { nombre: "Inmueble", grupo: "bienes", retencion: false, gmf: false },
  vehiculo: { nombre: "Vehículo", grupo: "bienes", retencion: false, gmf: false },
  otro: { nombre: "Otro", grupo: "bienes", retencion: false, gmf: false },
};

export const NOMBRE_GRUPO: Record<GrupoActivo, string> = {
  liquido: "Disponible",
  invertido: "Invertido",
  retiro: "Para el retiro",
  bienes: "Bienes",
};

export interface Activo {
  id: string;
  hogar_id: string;
  usuario_id: string | null;
  nombre: string;
  tipo: TipoActivo;
  valor: number;
  /** Rentabilidad pactada o esperada en % E.A. Null si no aplica (bienes). */
  tasa_ea: number | null;
  aporte_mensual: number;
  /** YYYY-MM-DD, para CDT y similares. */
  vencimiento: string | null;
  orden: number;
  creado_en: string;
}

/** Un acuerdo de la reunión mensual. */
export interface Decision {
  id: string;
  hogar_id: string;
  /** YYYY-MM-01 */
  periodo: string;
  texto: string;
  responsable: string | null;
  cumplida: boolean;
  /** Id de la sugerencia de la app de la que salió, si aplica. */
  origen: string | null;
  orden: number;
  creado_en: string;
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
  activos: Activo;
  decisiones: Decision;
}

export type NombreTabla = keyof MapaTablas;

/** Filas que se pueden insertar: sin los campos que pone la base. */
export type NuevaFila<T> = Omit<T, "id" | "creado_en" | "creada_en" | "cerrado_en">;
