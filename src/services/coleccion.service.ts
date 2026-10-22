import { supabase } from "./supabase";
import type { MapaTablas, NombreTabla } from "@/models/dominio";

/**
 * CRUD genérico sobre cualquier tabla del hogar.
 * Todas comparten la misma forma (columna `hogar_id` + RLS), así que una sola
 * capa sirve para las siete y no hay siete servicios casi idénticos.
 */

export async function listar<T extends NombreTabla>(
  tabla: T,
  hogarId: string,
  orden: { columna: string; ascendente?: boolean } = { columna: "orden" },
): Promise<MapaTablas[T][]> {
  const { data, error } = await supabase
    .from(tabla)
    .select("*")
    .eq("hogar_id", hogarId)
    .order(orden.columna, { ascending: orden.ascendente ?? true });
  if (error) throw error;
  return (data ?? []) as MapaTablas[T][];
}

export async function insertar<T extends NombreTabla>(
  tabla: T,
  fila: Record<string, unknown>,
): Promise<MapaTablas[T]> {
  const { data, error } = await supabase.from(tabla).insert(fila).select().single();
  if (error) throw error;
  return data as MapaTablas[T];
}

export async function insertarVarias<T extends NombreTabla>(
  tabla: T,
  filas: Record<string, unknown>[],
): Promise<number> {
  if (filas.length === 0) return 0;
  const { data, error } = await supabase.from(tabla).insert(filas).select("id");
  if (error) throw error;
  return (data ?? []).length;
}

export async function actualizar<T extends NombreTabla>(
  tabla: T,
  id: string,
  cambios: Record<string, unknown>,
): Promise<void> {
  const { error } = await supabase.from(tabla).update(cambios).eq("id", id);
  if (error) throw error;
}

export async function eliminar(tabla: NombreTabla, id: string): Promise<void> {
  const { error } = await supabase.from(tabla).delete().eq("id", id);
  if (error) throw error;
}

/** Cierra (o recalcula) el mes indicado y lo guarda en el histórico. */
export async function cerrarMes(hogarId: string, periodo: string): Promise<void> {
  const { error } = await supabase.rpc("cerrar_mes", { p_hogar: hogarId, p_periodo: periodo });
  if (error) throw error;
}

/** Guarda la corrección de categoría para que el próximo extracto la aplique. */
export async function aprenderRegla(
  hogarId: string,
  patron: string,
  categoria: string,
): Promise<void> {
  const { error } = await supabase.rpc("aprender_regla", {
    p_hogar: hogarId,
    p_patron: patron,
    p_categoria: categoria,
  });
  if (error) throw error;
}

/**
 * Guarda el puntaje de salud en el cierre del mes. Va aparte de cerrar_mes
 * porque el puntaje lo calcula la aplicación; si la columna aún no existe
 * (migración 0012 sin correr) se ignora el error: el cierre ya quedó hecho.
 */
export async function guardarPuntaje(hogarId: string, periodo: string, puntaje: number): Promise<void> {
  const { error } = await supabase
    .from("cierres_mensuales")
    .update({ puntaje: Math.max(0, Math.min(100, Math.round(puntaje))) })
    .eq("hogar_id", hogarId)
    .eq("periodo", periodo);
  if (error) console.warn("No se pudo guardar el puntaje del cierre:", error.message);
}
