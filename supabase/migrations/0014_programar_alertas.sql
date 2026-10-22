-- ============================================================================
-- 0014 · Programar las alertas diarias por correo
--
-- Córranla DESPUÉS de desplegar la función `alertas` (supabase/functions/
-- alertas) y de configurar sus secretos. Todos los días a las 7:00 de Bogotá
-- la base llama a la función, que revisa cada hogar y manda los avisos
-- nuevos a quienes los activaron en Ajustes.
--
-- La llamada lleva un secreto compartido para que nadie más pueda disparar
-- la función. Ese secreto y la dirección del proyecto viven en el Vault de
-- Supabase (cifrados), no en este archivo.
--
-- ANTES de correr esta migración, una sola vez, en el SQL Editor:
--
--   -- 1. La dirección del proyecto (Settings → API → Project URL):
--   select vault.create_secret('https://SU-PROYECTO.supabase.co', 'project_url');
--
--   -- 2. Un secreto aleatorio, generado aquí mismo:
--   select vault.create_secret(replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''), 'cron_secret');
--
--   -- 3. Léanlo para copiarlo en los secretos de la función (CRON_SECRET):
--   select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret';
-- ============================================================================

create extension if not exists pg_net;

select cron.unschedule(jobid) from cron.job where jobname = 'alertas-diarias';
select cron.schedule(
  'alertas-diarias',
  '0 12 * * *',                       -- 12:00 UTC = 7:00 en Bogotá
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url')
           || '/functions/v1/alertas',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
  $$
);
