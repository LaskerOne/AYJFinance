import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY;

/** Falso mientras el .env no esté completo: la app muestra instrucciones
 *  en vez de estrellarse con un error críptico de red. */
export const hayConfiguracion = Boolean(url && anon && url.startsWith("http"));

export const supabase = createClient(
  hayConfiguracion ? url : "https://sin-configurar.supabase.co",
  hayConfiguracion ? anon : "sin-configurar",
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      flowType: "pkce",
    },
  },
);

/** Traduce los errores de Supabase a algo que una persona pueda accionar. */
export function mensajeDeError(error: unknown): string {
  if (!error) return "";
  const e = error as { message?: string; code?: string };
  const m = (e.message ?? String(error)).toLowerCase();

  if (m.includes("failed to fetch") || m.includes("networkerror")) {
    return "No hay conexión con el servidor. Revisa tu internet y vuelve a intentar.";
  }
  if (m.includes("row-level security") || m.includes("violates row-level")) {
    return "No tienes permiso sobre este hogar. Cierra sesión y vuelve a entrar.";
  }
  if (m.includes("duplicate key")) {
    return "Ese registro ya existe.";
  }
  if (m.includes("rate limit") || m.includes("too many")) {
    return "Demasiados intentos seguidos. Espera un minuto antes de reintentar.";
  }
  if (m.includes("invalid login") || m.includes("otp")) {
    return "El enlace no es válido o ya venció. Pide uno nuevo.";
  }
  return e.message ?? "Algo salió mal. Intenta de nuevo.";
}
