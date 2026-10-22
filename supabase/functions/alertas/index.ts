/**
 * Alertas diarias por correo · Supabase Edge Function (Deno)
 *
 * La llama pg_cron todos los días (migración 0014). Por cada hogar revisa:
 *   · cuotas de deuda que vencen en los próximos 3 días (según "día de pago"),
 *   · pagos no mensuales que caen este mes o el próximo (según "mes de pago"),
 *   · categorías que van en el 80 % o se pasaron del presupuesto del mes,
 *   · la reunión del mes, los primeros días de cada mes,
 * y manda un solo correo con los avisos nuevos a quienes los activaron en
 * Ajustes. Cada aviso se manda una vez: alertas_enviadas guarda su clave.
 *
 * Secretos que necesita (Edge Functions → Secrets en el panel):
 *   CRON_SECRET  el mismo valor guardado en el Vault como 'cron_secret'
 *   SMTP_USER    la cuenta de Gmail que ya envía los enlaces de acceso
 *   SMTP_PASS    la contraseña de aplicación de esa cuenta
 *   APP_URL      la dirección pública de la app (la de Vercel)
 * SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY los pone Supabase solo.
 *
 * Las reglas de dinero (equivalente mensual por frecuencia, ciclos de pago)
 * replican las de src/lib/calculos.ts y src/lib/proyeccion.ts: si cambian
 * allá, hay que cambiarlas aquí.
 */
import { createClient } from "npm:@supabase/supabase-js@2";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

type Frecuencia = "quincenal" | "mensual" | "bimestral" | "trimestral" | "semestral" | "anual";

const FACTOR: Record<Frecuencia, number> = {
  quincenal: 2,
  mensual: 1,
  bimestral: 1 / 2,
  trimestral: 1 / 3,
  semestral: 1 / 6,
  anual: 1 / 12,
};
const CICLO: Record<Frecuencia, number> = {
  quincenal: 0,
  mensual: 0,
  bimestral: 2,
  trimestral: 3,
  semestral: 6,
  anual: 12,
};
const MESES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

// --- tipos de lo que se lee de la base ------------------------------------------

export interface Hoy {
  anio: number;
  mes: number; // 1–12
  dia: number;
}

interface DeudaFila {
  id: string;
  nombre: string;
  saldo: number;
  cuota: number;
  dia_pago: number | null;
}
interface GastoFila {
  id: string;
  categoria: string;
  concepto: string;
  monto: number;
  frecuencia: Frecuencia;
  mes_pago: number | null;
}
interface MovimientoFila {
  categoria: string;
  monto: number;
  clase: string;
  extraordinario: boolean;
}
interface CierreFila {
  ingresos: number;
  gastos: number;
  cuotas: number;
  puntaje: number | null;
}

export interface DatosHogar {
  etiquetas: Record<string, string>;
  deudas: DeudaFila[];
  gastos: GastoFila[];
  /** Movimientos del mes en curso. */
  movimientos: MovimientoFila[];
  /** Cierre del mes anterior, si existe. */
  cierrePasado: CierreFila | null;
}

export interface Alerta {
  clave: string;
  titulo: string;
  detalle: string;
}

// --- fechas en Bogotá ---------------------------------------------------------------

export function hoyEnBogota(ahora = new Date()): Hoy {
  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Bogota",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(ahora);
  const valor = (t: string) => Number(partes.find((p) => p.type === t)?.value);
  return { anio: valor("year"), mes: valor("month"), dia: valor("day") };
}

const diasDelMes = (anio: number, mes: number) => new Date(Date.UTC(anio, mes, 0)).getUTCDate();
const clavesMes = (anio: number, mes: number) => `${anio}-${String(mes).padStart(2, "0")}`;
const siguiente = (anio: number, mes: number) => (mes === 12 ? { anio: anio + 1, mes: 1 } : { anio, mes: mes + 1 });
const anterior = (anio: number, mes: number) => (mes === 1 ? { anio: anio - 1, mes: 12 } : { anio, mes: mes - 1 });

function caeEn(g: Pick<GastoFila, "frecuencia" | "mes_pago">, mes: number): boolean {
  const ciclo = CICLO[g.frecuencia];
  if (!ciclo || !g.mes_pago) return false;
  return (((mes - g.mes_pago) % ciclo) + ciclo) % ciclo === 0;
}

// --- las reglas -------------------------------------------------------------------------

export function calcularAlertas(d: DatosHogar, hoy: Hoy, $: (n: number) => string): Alerta[] {
  const alertas: Alerta[] = [];
  const nombreCat = (c: string) => d.etiquetas[c]?.trim() || c;
  const sig = siguiente(hoy.anio, hoy.mes);

  // 1 · Cuotas que vencen en los próximos 3 días.
  for (const deuda of d.deudas) {
    if (Number(deuda.saldo) <= 0.5 || !deuda.dia_pago || Number(deuda.cuota) <= 0) continue;
    const diaEste = Math.min(deuda.dia_pago, diasDelMes(hoy.anio, hoy.mes));
    let falta: number;
    let vence: { anio: number; mes: number; dia: number };
    if (diaEste >= hoy.dia) {
      falta = diaEste - hoy.dia;
      vence = { anio: hoy.anio, mes: hoy.mes, dia: diaEste };
    } else {
      const diaSig = Math.min(deuda.dia_pago, diasDelMes(sig.anio, sig.mes));
      falta = diasDelMes(hoy.anio, hoy.mes) - hoy.dia + diaSig;
      vence = { ...sig, dia: diaSig };
    }
    if (falta > 3) continue;
    const nombre = deuda.nombre || "una deuda";
    alertas.push({
      clave: `cuota:${deuda.id}:${clavesMes(vence.anio, vence.mes)}`,
      titulo:
        falta === 0
          ? `Hoy se paga la cuota de ${nombre}`
          : `La cuota de ${nombre} vence en ${falta} ${falta === 1 ? "día" : "días"}`,
      detalle: `${$(Number(deuda.cuota))} el ${vence.dia} de ${MESES[vence.mes - 1]}.`,
    });
  }

  // 2 · Pagos que no son mensuales: el mes en que caen y, desde el 20, el mes anterior.
  for (const g of d.gastos) {
    if (!CICLO[g.frecuencia] || !g.mes_pago) continue;
    const concepto = g.concepto || nombreCat(g.categoria);
    if (caeEn(g, hoy.mes)) {
      alertas.push({
        clave: `pago:${g.id}:${clavesMes(hoy.anio, hoy.mes)}`,
        titulo: `Este mes se paga ${concepto}`,
        detalle: `${$(Number(g.monto))}. Si apartaron su parte cada mes, ya debería estar guardado.`,
      });
    } else if (hoy.dia >= 20 && caeEn(g, sig.mes)) {
      alertas.push({
        clave: `prepago:${g.id}:${clavesMes(sig.anio, sig.mes)}`,
        titulo: `En ${MESES[sig.mes - 1]} se paga ${concepto}`,
        detalle: `${$(Number(g.monto))}. Revisen en Proyección cuánto llevan apartado.`,
      });
    }
  }

  // 3 · Categorías que van en el 80 % o se pasaron del presupuesto del mes.
  const presupuesto = new Map<string, number>();
  for (const g of d.gastos) {
    presupuesto.set(g.categoria, (presupuesto.get(g.categoria) ?? 0) + Number(g.monto) * (FACTOR[g.frecuencia] ?? 1));
  }
  const ejecutado = new Map<string, number>();
  for (const m of d.movimientos) {
    if (m.clase !== "gasto" || m.extraordinario) continue;
    ejecutado.set(m.categoria, (ejecutado.get(m.categoria) ?? 0) + Number(m.monto));
  }
  for (const [cat, tope] of presupuesto) {
    if (tope <= 0) continue;
    const gastado = ejecutado.get(cat) ?? 0;
    const fraccion = gastado / tope;
    const mesClave = clavesMes(hoy.anio, hoy.mes);
    if (fraccion >= 1) {
      alertas.push({
        clave: `cat:${cat}:${mesClave}:100`,
        titulo: `Se pasaron del presupuesto de ${nombreCat(cat)}`,
        detalle: `Llevan ${$(gastado)} de ${$(tope)} este mes (${Math.round(fraccion * 100)} %).`,
      });
    } else if (fraccion >= 0.8) {
      const quedan = diasDelMes(hoy.anio, hoy.mes) - hoy.dia;
      alertas.push({
        clave: `cat:${cat}:${mesClave}:80`,
        titulo: `${nombreCat(cat)} va en el ${Math.round(fraccion * 100)} % del presupuesto`,
        detalle: `Llevan ${$(gastado)} de ${$(tope)}, ${
          quedan === 0 ? "y hoy es el último día del mes" : quedan === 1 ? "y falta 1 día del mes" : `y faltan ${quedan} días del mes`
        }.`,
      });
    }
  }

  // 4 · La reunión del mes, los primeros tres días.
  if (hoy.dia <= 3) {
    const ant = anterior(hoy.anio, hoy.mes);
    const c = d.cierrePasado;
    alertas.push({
      clave: `reunion:${clavesMes(hoy.anio, hoy.mes)}`,
      titulo: `Es hora de la reunión de ${MESES[hoy.mes - 1]}`,
      detalle: c
        ? `${MESES[ant.mes - 1]} cerró con ${$(Number(c.ingresos))} de ingresos y ${$(Number(c.gastos) + Number(c.cuotas))} de salidas${c.puntaje !== null ? `; su puntaje de salud quedó en ${c.puntaje} de 100` : ""}. Media hora juntos para revisar y acordar lo del mes.`
        : `Media hora juntos para revisar ${MESES[ant.mes - 1]}, dejar las cuentas claras y acordar lo del mes.`,
    });
  }

  return alertas;
}

// --- el tip del día -----------------------------------------------------------------------
// Una idea de educación financiera que rota cada día. Va al final del correo
// solo cuando ya hay avisos que mandar: nunca genera un correo por sí sola.

const TIPS_DEL_DIA: Array<[string, string]> = [
  ["Páguense primero", "Programen la transferencia al ahorro para el día en que llega el sueldo, no para fin de mes."],
  ["El pago mínimo es una trampa amable", "Cubre sobre todo intereses: el saldo casi no baja. Paguen el total de la tarjeta siempre que puedan."],
  ["La regla del 72", "Dividan 72 por la tasa anual y sabrán en cuántos años se duplica algo, a favor o en contra."],
  ["Siempre comparen en E.A.", "«1,9 % mensual» y «25 % anual» son casi la misma tasa. La efectiva anual es la única forma honesta de comparar."],
  ["La regla de las 24 horas", "Ante una compra no planeada, esperen un día. La mayoría de las compras impulsivas no pasan esa prueba."],
  ["De 3 a 6 meses de colchón", "Es lo que tarda, en promedio, salir de una emergencia o conseguir un nuevo ingreso sin endeudarse."],
  ["El 4×1000 se puede evitar en una cuenta", "Marquen una cuenta de ahorros como exenta (hasta un tope mensual) y úsenla para el día a día."],
  ["La escalera de CDT", "Varios CDT que vencen en meses distintos dan plata disponible más seguido y reparten el riesgo de tasa."],
  ["Cuando sube el ingreso, que suba el ahorro", "Una regla simple: la mitad de cada aumento va al ahorro antes de acostumbrarse a gastarla."],
  ["Las cesantías no son plata de bolsillo", "Son un seguro para quedarse sin empleo; mientras tanto, solo se retiran para vivienda o educación."],
  ["El tiempo pesa más que la tasa", "Empezar a invertir diez años antes vale más que duplicar el aporte después."],
  ["A una cuota, siempre que se pueda", "Diferir una compra a 36 cuotas puede costar casi la mitad de su valor en intereses."],
  ["La inflación es un impuesto silencioso", "La plata quieta no pierde pesos, pierde lo que puede comprar. Lo guardado tiene que rendir al menos eso."],
  ["Cada peso con un destino", "Lo que no tiene destino se gasta solo. Asignen cada peso del ingreso a un gasto, una deuda o una meta."],
];

export function tipDelDia(hoy: Hoy): [string, string] {
  const inicio = Date.UTC(hoy.anio, 0, 0);
  const dia = Math.floor((Date.UTC(hoy.anio, hoy.mes - 1, hoy.dia) - inicio) / 86_400_000);
  return TIPS_DEL_DIA[dia % TIPS_DEL_DIA.length];
}

// --- el correo ------------------------------------------------------------------------------

const escapar = (t: string) =>
  t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export function componerCorreo(hogar: string, alertas: Alerta[], appUrl: string, tip?: [string, string]) {
  const asunto =
    alertas.length === 1 ? `Cuentas de Dos · ${alertas[0].titulo}` : `Cuentas de Dos · ${alertas.length} avisos para hoy`;
  const texto = [
    `${hogar}:`,
    "",
    ...alertas.flatMap((a) => [`• ${a.titulo}`, `  ${a.detalle}`, ""]),
    ...(tip ? [`Para aprender: ${tip[0]}`, `  ${tip[1]}`, ""] : []),
    `Abrir la app: ${appUrl}`,
    "",
    "Reciben este correo porque activaron las alertas en Ajustes. Se apagan desde ahí mismo.",
  ].join("\n");

  const filas = alertas
    .map(
      (a) => `<tr><td style="padding:14px 18px;border-top:1px solid #2c2f34">
<div style="font:600 15px/1.4 Arial,sans-serif;color:#eceef1">${escapar(a.titulo)}</div>
<div style="font:13px/1.55 Arial,sans-serif;color:#a6abb3;margin-top:4px">${escapar(a.detalle)}</div>
</td></tr>`,
    )
    .join("");
  const html = `<!doctype html><html><body style="margin:0;padding:24px;background:#0e0f11">
<table role="presentation" width="100%" style="max-width:560px;margin:0 auto;background:#1a1c1f;border:1px solid #2c2f34;border-radius:14px;border-collapse:separate">
<tr><td style="padding:18px 18px 12px">
<div style="font:700 11px/1 Arial,sans-serif;letter-spacing:.14em;text-transform:uppercase;color:#ff9d4a">Cuentas de Dos</div>
<div style="font:700 19px/1.3 Arial,sans-serif;color:#eceef1;margin-top:8px">${escapar(hogar)}</div>
</td></tr>
${filas}
${tip ? `<tr><td style="padding:14px 18px;border-top:1px solid #2c2f34"><div style="border-left:4px solid #8f7cea;padding:2px 0 2px 12px"><div style="font:700 10px/1 Arial,sans-serif;letter-spacing:.12em;text-transform:uppercase;color:#b3a6f4">Para aprender</div><div style="font:600 14px/1.4 Arial,sans-serif;color:#eceef1;margin-top:6px">${escapar(tip[0])}</div><div style="font:13px/1.55 Arial,sans-serif;color:#a6abb3;margin-top:3px">${escapar(tip[1])}</div></div></td></tr>` : ""}
<tr><td style="padding:16px 18px 20px;border-top:1px solid #2c2f34">
<a href="${escapar(appUrl)}" style="display:inline-block;background:#ff8a1f;color:#1c0d02;font:700 14px Arial,sans-serif;text-decoration:none;padding:10px 18px;border-radius:999px">Abrir la app</a>
<div style="font:12px/1.5 Arial,sans-serif;color:#7e848c;margin-top:14px">Reciben este correo porque activaron las alertas en Ajustes. Se apagan desde ahí mismo.</div>
</td></tr></table></body></html>`;
  return { asunto, texto, html };
}

// --- el servidor ---------------------------------------------------------------------------

const moneda = new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 });
const $ = (n: number) => moneda.format(Math.round(n));

async function atender(req: Request): Promise<Response> {
  const secreto = Deno.env.get("CRON_SECRET");
  if (!secreto || req.headers.get("x-cron-secret") !== secreto) {
    return new Response("No autorizado", { status: 401 });
  }
  // {"prueba": true} calcula y devuelve los avisos sin mandar ni registrar nada.
  const cuerpo = await req.json().catch(() => ({}));
  const prueba = cuerpo?.prueba === true;

  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false },
  });
  const appUrl = Deno.env.get("APP_URL") ?? "";
  const hoy = hoyEnBogota();
  const sig = siguiente(hoy.anio, hoy.mes);
  const ant = anterior(hoy.anio, hoy.mes);
  const desde = `${clavesMes(hoy.anio, hoy.mes)}-01`;
  const hasta = `${clavesMes(sig.anio, sig.mes)}-01`;

  const [hogares, miembros, perfiles, deudas, gastos, movimientos, cierres, enviadas] = await Promise.all([
    sb.from("hogares").select("id, nombre, etiquetas_categorias"),
    sb.from("miembros").select("hogar_id, usuario_id"),
    sb.from("perfiles").select("id, correo, alertas_correo").eq("alertas_correo", true),
    sb.from("deudas").select("id, hogar_id, nombre, saldo, cuota, dia_pago"),
    sb.from("gastos_presupuesto").select("id, hogar_id, categoria, concepto, monto, frecuencia, mes_pago"),
    sb.from("movimientos").select("hogar_id, categoria, monto, clase, extraordinario").gte("fecha", desde).lt("fecha", hasta),
    sb.from("cierres_mensuales").select("hogar_id, ingresos, gastos, cuotas, puntaje").eq("periodo", `${clavesMes(ant.anio, ant.mes)}-01`),
    sb.from("alertas_enviadas").select("hogar_id, clave"),
  ]);
  const fallo = [hogares, miembros, perfiles, deudas, gastos, movimientos, cierres, enviadas].find((r) => r.error);
  if (fallo?.error) return Response.json({ error: fallo.error.message }, { status: 500 });

  const yaEnviadas = new Set((enviadas.data ?? []).map((e) => `${e.hogar_id}|${e.clave}`));
  const correoDe = new Map((perfiles.data ?? []).filter((p) => p.correo).map((p) => [p.id, p.correo as string]));
  const deHogar = <T extends { hogar_id: string }>(filas: T[] | null, id: string) => (filas ?? []).filter((f) => f.hogar_id === id);

  const smtp =
    prueba
      ? null
      : new SMTPClient({
          connection: {
            hostname: "smtp.gmail.com",
            port: 465,
            tls: true,
            auth: { username: Deno.env.get("SMTP_USER")!, password: Deno.env.get("SMTP_PASS")! },
          },
        });

  const resultados: unknown[] = [];
  try {
    for (const h of hogares.data ?? []) {
      const destinatarios = deHogar(miembros.data, h.id)
        .map((m) => correoDe.get(m.usuario_id))
        .filter((c): c is string => Boolean(c));
      if (destinatarios.length === 0) continue;

      const alertas = calcularAlertas(
        {
          etiquetas: (h.etiquetas_categorias ?? {}) as Record<string, string>,
          deudas: deHogar(deudas.data, h.id) as unknown as DeudaFila[],
          gastos: deHogar(gastos.data, h.id) as unknown as GastoFila[],
          movimientos: deHogar(movimientos.data, h.id) as unknown as MovimientoFila[],
          cierrePasado: (deHogar(cierres.data, h.id)[0] as unknown as CierreFila) ?? null,
        },
        hoy,
        $,
      ).filter((a) => !yaEnviadas.has(`${h.id}|${a.clave}`));
      if (alertas.length === 0) continue;

      if (smtp) {
        const correo = componerCorreo(h.nombre || "Su hogar", alertas, appUrl, tipDelDia(hoy));
        try {
          await smtp.send({
            from: `Cuentas de Dos <${Deno.env.get("SMTP_USER")}>`,
            to: destinatarios,
            subject: correo.asunto,
            content: correo.texto,
            html: correo.html,
          });
          await sb.from("alertas_enviadas").insert(alertas.map((a) => ({ hogar_id: h.id, clave: a.clave })));
          resultados.push({ hogar: h.id, enviadas: alertas.length });
        } catch (e) {
          resultados.push({ hogar: h.id, error: String(e) });
        }
      } else {
        resultados.push({ hogar: h.id, destinatarios: destinatarios.length, alertas });
      }
    }
  } finally {
    await smtp?.close();
  }

  return Response.json({ fecha: hoy, prueba, resultados });
}

Deno.serve(atender);
