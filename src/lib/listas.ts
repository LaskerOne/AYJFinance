/**
 * Cambios inmutables sobre las listas de filas que guarda HogarContext.
 *
 * Los usan las escrituras optimistas (crear, editar, borrar) y los eventos de
 * Realtime. Antes cada uno escribía su versión dentro del contexto, sin
 * pruebas, y es justo la parte más delicada de la sincronización: el eco del
 * WebSocket repite lo que uno mismo acaba de insertar, y no puede duplicarlo.
 *
 * Cuando el cambio no altera nada, devuelven la misma lista (misma
 * referencia): así React no vuelve a pintar por un eco.
 */

export type ConId = { id: string };

/** Agrega la fila al final, salvo que ya exista una con su id. */
export function insertarSiFalta<T extends ConId>(lista: T[], fila: T): T[] {
  return lista.some((f) => f.id === fila.id) ? lista : [...lista, fila];
}

/** Cambia la fila con ese id por la nueva. Si no está, no hace nada. */
export function reemplazarPorId<T extends ConId>(lista: T[], fila: T): T[] {
  return lista.some((f) => f.id === fila.id) ? lista.map((f) => (f.id === fila.id ? fila : f)) : lista;
}

/** Mezcla los cambios en la fila con ese id. Si no está, no hace nada. */
export function fusionarPorId<T extends ConId>(lista: T[], id: string, cambios: Partial<T>): T[] {
  return lista.some((f) => f.id === id) ? lista.map((f) => (f.id === id ? { ...f, ...cambios } : f)) : lista;
}

/** Quita la fila con ese id. Si no está, no hace nada. */
export function quitarPorId<T extends ConId>(lista: T[], id: string): T[] {
  return lista.some((f) => f.id === id) ? lista.filter((f) => f.id !== id) : lista;
}

/** Lo que importa de un evento de Realtime, sin depender de los tipos de Supabase. */
export interface CambioRemoto {
  tipo: "INSERT" | "UPDATE" | "DELETE";
  nueva: { id?: string } | null;
  vieja: { id?: string } | null;
}

/** Aplica un evento de Realtime a la lista de su tabla. */
export function aplicarCambioRemoto<T extends ConId>(lista: T[], cambio: CambioRemoto): T[] {
  const nueva = cambio.nueva?.id ? (cambio.nueva as T) : null;
  const viejaId = cambio.vieja?.id;
  if (cambio.tipo === "INSERT" && nueva) return insertarSiFalta(lista, nueva);
  if (cambio.tipo === "UPDATE" && nueva) return reemplazarPorId(lista, nueva);
  if (cambio.tipo === "DELETE" && viejaId) return quitarPorId(lista, viejaId);
  return lista;
}
