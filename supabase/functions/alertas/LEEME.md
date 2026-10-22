# Alertas por correo: instalación

Se hace una vez. El orden importa.

## 1. Migración 0013

Peguen `supabase/migrations/0013_cierre_automatico.sql` en el SQL Editor y córranla.
Deja listo el cierre automático del mes (día 1, 6:00 a. m.) y la parte de datos de las alertas.

Si falla en `create extension if not exists pg_cron`, activen **Integrations → Cron** en el
panel de Supabase y vuelvan a correrla.

## 2. Desplegar la función

**Desde el panel** (sin instalar nada): Edge Functions → *Deploy a new function* → *Via
Editor*. Nombre: `alertas`. Peguen el contenido de `index.ts` y desplieguen.
Después, en los detalles de la función, **apaguen «Verify JWT»**: la función se protege con
su propio secreto (`CRON_SECRET`), no con la sesión de un usuario.

**O desde la terminal**, con su cuenta personal de Supabase:

```
npx supabase login
npx supabase functions deploy alertas --no-verify-jwt --project-ref SU-PROYECTO
```

## 3. Secretos en el Vault

En el SQL Editor (los comandos también están al inicio de la migración 0014):

```sql
select vault.create_secret('https://SU-PROYECTO.supabase.co', 'project_url');
select vault.create_secret(replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''), 'cron_secret');
select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret';
```

Copien el valor que devuelve la última línea para el paso 4.

## 4. Secretos de la función

Edge Functions → Secrets:

| Nombre        | Valor                                                             |
|---------------|-------------------------------------------------------------------|
| `CRON_SECRET` | el valor del paso 3                                               |
| `SMTP_USER`   | la cuenta de Gmail que ya envía los enlaces de acceso             |
| `SMTP_PASS`   | la contraseña de aplicación de esa cuenta (la misma del SMTP de Auth) |
| `APP_URL`     | la dirección de la app en Vercel                                  |

La contraseña de aplicación va directo a Supabase: no se comparte con nadie más.

## 5. Migración 0014

Peguen `supabase/migrations/0014_programar_alertas.sql` y córranla. Desde ahí, la base llama
a la función todos los días a las 7:00 a. m. de Bogotá.

## 6. Activar y probar

Cada persona activa **Ajustes → Alertas por correo** (vienen apagadas). Para ver qué avisos
saldrían hoy sin mandar nada, en el SQL Editor:

```sql
select net.http_post(
  url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/alertas',
  headers := jsonb_build_object(
    'Content-Type', 'application/json',
    'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')
  ),
  body := '{"prueba": true}'::jsonb
);
-- unos segundos después:
select status_code, content from net._http_response order by id desc limit 1;
```

Con `"prueba": true` la función calcula y devuelve los avisos, pero no manda correos ni los
marca como enviados. Sin esa línea, los manda de verdad.

## Qué avisa

- Cuotas que vencen en los próximos 3 días (necesitan el **día de pago** en Deudas).
- Pagos no mensuales: el mes en que caen y, desde el día 20, el mes anterior (necesitan el
  **mes de pago** en Presupuesto).
- Categorías que van en el 80 % o se pasaron del presupuesto del mes.
- La reunión del mes, los primeros tres días, con el resumen del mes que cerró.

Cada aviso se manda una sola vez (la tabla `alertas_enviadas` guarda cuáles salieron).
