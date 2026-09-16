import { supabase } from "./supabase";
import type { Hogar, Invitacion, Miembro, Perfil } from "@/models/dominio";

/**
 * Resuelve en qué hogar entra la persona que acaba de iniciar sesión:
 *   1. ¿Ya es miembro de alguno? Entra a ese.
 *   2. ¿La invitaron por correo? Se une al hogar que la invitó.
 *   3. Si no, crea el suyo y lo siembra con un presupuesto de ejemplo.
 */
export async function obtenerOCrearHogar(usuarioId: string, correo: string): Promise<Hogar> {
  const { data: membresias, error: errorMiembro } = await supabase
    .from("miembros")
    .select("hogar_id")
    .eq("usuario_id", usuarioId)
    .limit(1);
  if (errorMiembro) throw errorMiembro;

  const membresia = (membresias ?? [])[0] as { hogar_id: string } | undefined;
  if (membresia) {
    const { data, error } = await supabase
      .from("hogares")
      .select("*")
      .eq("id", membresia.hogar_id)
      .single();
    if (error) throw error;
    return data as Hogar;
  }

  const { data: invitaciones, error: errorInv } = await supabase
    .from("invitaciones")
    .select("hogar_id")
    .ilike("correo", correo)
    .limit(1);
  if (errorInv) throw errorInv;

  const invitacion = (invitaciones ?? [])[0] as { hogar_id: string } | undefined;
  if (invitacion) {
    const { error } = await supabase
      .from("miembros")
      .insert({ hogar_id: invitacion.hogar_id, usuario_id: usuarioId, rol: "socio" });
    if (error) throw error;

    const { data, error: errorHogar } = await supabase
      .from("hogares")
      .select("*")
      .eq("id", invitacion.hogar_id)
      .single();
    if (errorHogar) throw errorHogar;
    return data as Hogar;
  }

  // ¿Quedó un hogar creado por mí en un intento anterior que no llegó a
  // registrar la membresía? Se reusa en vez de acumular hogares huérfanos.
  const { data: propios, error: errorPropios } = await supabase
    .from("hogares")
    .select("*")
    .eq("creado_por", usuarioId)
    .limit(1);
  if (errorPropios) throw errorPropios;

  const propio = (propios ?? [])[0] as Hogar | undefined;
  if (propio) {
    const { error } = await supabase
      .from("miembros")
      .insert({ hogar_id: propio.id, usuario_id: usuarioId, rol: "socio" });
    if (error && !error.message.includes("duplicate")) throw error;

    await supabase.rpc("sembrar_ejemplo", { p_hogar: propio.id });
    return propio;
  }

  const { data: nuevo, error: errorCrear } = await supabase
    .from("hogares")
    .insert({ nombre: "Nuestro hogar", creado_por: usuarioId })
    .select()
    .single();
  if (errorCrear) throw errorCrear;

  const hogar = nuevo as Hogar;

  const { error: errorUnir } = await supabase
    .from("miembros")
    .insert({ hogar_id: hogar.id, usuario_id: usuarioId, rol: "socio" });
  if (errorUnir) throw errorUnir;

  // Un tablero vacío no enseña nada: se siembra con un ejemplo borrable.
  const { error: errorSembrar } = await supabase.rpc("sembrar_ejemplo", { p_hogar: hogar.id });
  if (errorSembrar) console.warn("No se pudo sembrar el ejemplo:", errorSembrar.message);

  return hogar;
}

export async function actualizarHogar(id: string, cambios: Partial<Hogar>): Promise<void> {
  const { error } = await supabase.from("hogares").update(cambios).eq("id", id);
  if (error) throw error;
}

export async function integrantes(hogarId: string): Promise<Perfil[]> {
  const { data: filas, error } = await supabase
    .from("miembros")
    .select("usuario_id, unido_en")
    .eq("hogar_id", hogarId)
    .order("unido_en", { ascending: true });
  if (error) throw error;

  const ids = ((filas ?? []) as Pick<Miembro, "usuario_id">[]).map((m) => m.usuario_id);
  if (ids.length === 0) return [];

  const { data: perfiles, error: errorPerfiles } = await supabase
    .from("perfiles")
    .select("*")
    .in("id", ids);
  if (errorPerfiles) throw errorPerfiles;

  // Se respeta el orden de llegada al hogar, no el que devuelva Postgres.
  const porId = new Map((perfiles as Perfil[]).map((p) => [p.id, p]));
  return ids.map((id) => porId.get(id)).filter((p): p is Perfil => Boolean(p));
}

export async function invitar(
  hogarId: string,
  correo: string,
  invitadoPor: string,
): Promise<Invitacion> {
  const { data, error } = await supabase
    .from("invitaciones")
    .upsert(
      { hogar_id: hogarId, correo: correo.trim().toLowerCase(), invitado_por: invitadoPor },
      { onConflict: "hogar_id,correo" },
    )
    .select()
    .single();
  if (error) throw error;
  return data as Invitacion;
}

export async function invitacionesDe(hogarId: string): Promise<Invitacion[]> {
  const { data, error } = await supabase
    .from("invitaciones")
    .select("*")
    .eq("hogar_id", hogarId);
  if (error) throw error;
  return (data ?? []) as Invitacion[];
}

export async function cancelarInvitacion(id: string): Promise<void> {
  const { error } = await supabase.from("invitaciones").delete().eq("id", id);
  if (error) throw error;
}

export async function renombrarPerfil(usuarioId: string, nombre: string): Promise<void> {
  const { error } = await supabase.from("perfiles").update({ nombre }).eq("id", usuarioId);
  if (error) throw error;
}
