import { createClient } from "@supabase/supabase-js";

/**
 * El panel de Supabase muestra la URL con el sufijo del endpoint REST, así
 * que es fácil copiarla como `https://xxx.supabase.co/rest/v1/`. El cliente
 * agrega su propia ruta y terminaría pidiendo `/rest/v1/auth/v1/otp`, que
 * responde "Invalid path specified in request URL". Aquí se normaliza para
 * que cualquiera de las dos formas funcione.
 */
function urlBase(valor: string | undefined): string {
  return (valor ?? "")
    .trim()
    .replace(/\/+$/, "")
    .replace(/\/(rest|auth|realtime|storage)\/v\d+$/i, "")
    .replace(/\/+$/, "");
}

const url = urlBase(import.meta.env.VITE_SUPABASE_URL);
const anon = (import.meta.env.VITE_SUPABASE_ANON_KEY ?? "").trim();

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
  if (m.includes("not authorized") || m.includes("email address not authorized")) {
    return (
      "Ese correo no está autorizado para recibir el enlace. El servicio de " +
      "pruebas de Supabase solo escribe a los miembros del proyecto: para " +
      "invitar a otra persona hay que configurar un SMTP propio."
    );
  }
  if (m.includes("rate limit") || m.includes("too many") || m.includes("over_email_send_rate")) {
    return (
      "Se agotaron los envíos de esta hora. El servicio de pruebas de Supabase " +
      "permite solo 2 correos por hora; espera a la siguiente hora, o configura " +
      "un SMTP propio para quitar el límite."
    );
  }
  if (m.includes("invalid login") || m.includes("otp") || m.includes("expired")) {
    return "El enlace no es válido o ya venció. Pide uno nuevo.";
  }
  return e.message ?? "Algo salió mal. Intenta de nuevo.";
}
